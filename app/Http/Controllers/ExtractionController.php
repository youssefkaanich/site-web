<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;

class ExtractionController extends Controller
{
    private const DOSSIER_PYTHON = 'C:\\STAGE\\projet sopal';

    private const SCRIPTS = [
        'gmail' => 'extract_gmail_commandes.py',
        'outlook' => 'extract_outlook_commandes.py',
    ];

    /** Durée maximale d'une surveillance avant arrêt automatique (1 jour). */
    private const DUREE_MAX_SECONDES = 86400;

    public function start(string $source)
    {
        if (!isset(self::SCRIPTS[$source])) {
            abort(404);
        }

        if (self::estActif($source)) {
            return back();
        }

        $pid = self::lancerCache(self::SCRIPTS[$source]);

        Cache::forever("extraction:{$source}:pid", $pid);
        Cache::forever("extraction:{$source}:demarre_a", time());
        Cache::forever("extraction:{$source}:vu_vivant_a", time());

        return back();
    }

    /**
     * Lance le script Python complètement détaché (via PowerShell Start-Process),
     * sans fenêtre visible et sans dépendre du processus PHP qui l'a démarré.
     * Retourne le PID réel de python.exe.
     */
    private static function lancerCache(string $script): int
    {
        $commandePs = sprintf(
            '$p = Start-Process -FilePath python -ArgumentList %s -WorkingDirectory %s -WindowStyle Hidden -PassThru; $p.Id',
            self::psQuote($script),
            self::psQuote(self::DOSSIER_PYTHON)
        );

        $result = Process::env(self::env())
            ->run(['powershell', '-NoProfile', '-Command', $commandePs]);

        return (int) trim($result->output());
    }

    private static function psQuote(string $valeur): string
    {
        return "'".str_replace("'", "''", $valeur)."'";
    }

    public function stop(string $source)
    {
        if (!isset(self::SCRIPTS[$source])) {
            abort(404);
        }

        self::arreter($source);

        return back();
    }

    private static function arreter(string $source): void
    {
        $pid = Cache::get("extraction:{$source}:pid");

        if ($pid) {
            Process::env(self::env())->run(['taskkill', '/PID', $pid, '/T', '/F']);
        }

        Cache::forget("extraction:{$source}:pid");
        Cache::forget("extraction:{$source}:demarre_a");
        Cache::forget("extraction:{$source}:vu_vivant_a");
    }

    /** Statut des deux extractions, utilisé par CommandeController pour l'afficher sur la page. */
    public static function statut(): array
    {
        return [
            'gmail' => self::estActif('gmail'),
            'outlook' => self::estActif('outlook'),
            'message_gmail' => self::lireMessage('gmail'),
            'message_outlook' => self::lireMessage('outlook'),
        ];
    }

    /** Dernier message d'activité écrit par le script Python (voir ecrire_statut côté Python). */
    private static function lireMessage(string $source): ?string
    {
        $chemin = storage_path("app/statut_extraction/{$source}.json");

        if (!file_exists($chemin)) {
            return null;
        }

        $donnees = json_decode(file_get_contents($chemin), true);

        return $donnees['message'] ?? null;
    }

    private static function estActif(string $source): bool
    {
        $pid = Cache::get("extraction:{$source}:pid");
        if (!$pid) {
            return false;
        }

        $demarre = Cache::get("extraction:{$source}:demarre_a");

        // Arrêt automatique après la durée maximale (1 jour), même si le processus tourne encore.
        if ($demarre && (time() - $demarre) >= self::DUREE_MAX_SECONDES) {
            self::arreter($source);

            return false;
        }

        $result = Process::env(self::env())->run(['tasklist', '/FI', "PID eq {$pid}"]);
        $vivant = str_contains($result->output(), (string) $pid);

        if ($vivant) {
            Cache::forever("extraction:{$source}:vu_vivant_a", time());

            return true;
        }

        // `tasklist` peut parfois rater un processus qui tourne pourtant bien
        // (ralentissement ponctuel de Windows). On ne déclare "mort" que si
        // ça fait plusieurs secondes qu'on ne l'a plus vu, pas au premier raté.
        $vuVivantA = Cache::get("extraction:{$source}:vu_vivant_a", $demarre);
        if ($vuVivantA && (time() - $vuVivantA) < 10) {
            return true;
        }

        Cache::forget("extraction:{$source}:pid");
        Cache::forget("extraction:{$source}:demarre_a");
        Cache::forget("extraction:{$source}:vu_vivant_a");

        return false;
    }

    /** Variables d'environnement nécessaires pour lancer un script Python depuis PHP sur Windows. */
    public static function env(): array
    {
        return [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'PATH' => getenv('PATH'),
            'TEMP' => getenv('TEMP'),
            'TMP' => getenv('TMP'),
            'PYTHONIOENCODING' => 'utf-8',
            'PYTHONUTF8' => '1',
            'SOPAL_APP_PASSWORD' => env('SOPAL_APP_PASSWORD'),
            'CEREBRAS_API_KEY' => env('CEREBRAS_API_KEY'),
            'FIREBASE_CREDENTIALS' => config('firebase.credentials'),
        ];
    }
}
