<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
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

    public function start(string $source, Request $request)
    {
        if (!isset(self::SCRIPTS[$source])) {
            abort(404);
        }

        // Enregistrée AVANT le lancement : env() la relit pour la passer au
        // script Python.
        $periode = (string) $request->input('periode', '');
        if (isset(self::PERIODES[$periode])) {
            Cache::forever('extraction:periode', $periode);
        }

        if (self::estActif($source)) {
            return back();
        }

        $pid = self::lancerCache($source, self::SCRIPTS[$source]);

        Cache::forever("extraction:{$source}:pid", $pid);
        Cache::forever("extraction:{$source}:demarre_a", time());
        Cache::forever("extraction:{$source}:vu_vivant_a", time());

        return back();
    }

    /**
     * Lance le script Python complètement détaché (via PowerShell Start-Process),
     * sans fenêtre visible et sans dépendre du processus PHP qui l'a démarré.
     * Retourne le PID réel de python.exe.
     *
     * La sortie standard ET les erreurs (tracebacks Python en cas de plantage)
     * sont redirigées vers storage/logs/extraction_{source}.log : sans ça,
     * un script qui plante en silence (fenêtre cachée) ne laisse AUCUNE trace
     * exploitable pour comprendre pourquoi l'extraction s'est arrêtée toute seule.
     */
    private static function lancerCache(string $source, string $script): int
    {
        // Start-Process refuse de rediriger stdout et stderr vers le MÊME fichier,
        // d'où deux fichiers séparés (le traceback d'un plantage sort sur stderr).
        $sortiePath = storage_path("logs/extraction_{$source}.out.log");
        $erreurPath = storage_path("logs/extraction_{$source}.err.log");

        $commandePs = sprintf(
            '$p = Start-Process -FilePath python -ArgumentList %s -WorkingDirectory %s -WindowStyle Hidden -RedirectStandardOutput %s -RedirectStandardError %s -PassThru; $p.Id',
            self::psQuote($script),
            self::psQuote(self::DOSSIER_PYTHON),
            self::psQuote($sortiePath),
            self::psQuote($erreurPath)
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
        $journalGmail = self::lireJournal('gmail');
        $journalOutlook = self::lireJournal('outlook');

        return [
            'gmail' => self::estActif('gmail'),
            'outlook' => self::estActif('outlook'),
            'message_gmail' => end($journalGmail)['message'] ?? null,
            'message_outlook' => end($journalOutlook)['message'] ?? null,
            'journal_gmail' => $journalGmail,
            'journal_outlook' => $journalOutlook,
            // Sélecteur de période affiché à côté des boutons d'extraction.
            'periode' => self::periode(),
            'periodes' => self::PERIODES,
        ];
    }

    /**
     * Journal d'activité écrit par le script Python (voir ecrire_statut côté
     * Python) : liste de {message, horodatage}, du plus ancien au plus
     * récent — affiché comme un petit panneau façon console dans l'interface.
     */
    private static function lireJournal(string $source): array
    {
        $chemin = storage_path("app/statut_extraction/{$source}.json");

        if (!file_exists($chemin)) {
            return [];
        }

        $donnees = json_decode(file_get_contents($chemin), true);

        return $donnees['lignes'] ?? [];
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

    /**
     * Périodes proposées par le sélecteur placé à côté du bouton « Extraire ».
     * La clé est ce qui transite ; la valeur est ce que comprend le script
     * Python (voir DEPUIS dans extract_gmail_commandes.py).
     *
     * Liste FERMÉE : une valeur envoyée à la main qui n'y figure pas est
     * ignorée au profit du défaut, pour qu'aucune chaîne arbitraire ne
     * parvienne au script.
     */
    public const PERIODES = [
        '1jours' => "Aujourd'hui",
        '7jours' => '1 semaine',
        '14jours' => '2 semaines',
        '30jours' => '1 mois',
    ];

    public const PERIODE_DEFAUT = '30jours';

    /** Période retenue pour la prochaine extraction (mémorisée entre deux visites). */
    public static function periode(): string
    {
        $valeur = Cache::get('extraction:periode', self::PERIODE_DEFAUT);

        return isset(self::PERIODES[$valeur]) ? $valeur : self::PERIODE_DEFAUT;
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
            // Période choisie sur le site ; le script s'en sert pour DEPUIS.
            'SOPAL_DEPUIS' => self::periode(),
            'SOPAL_DB_HOST' => config('database.connections.mysql.host'),
            'SOPAL_DB_PORT' => (string) config('database.connections.mysql.port'),
            'SOPAL_DB_NAME' => config('database.connections.mysql.database'),
            'SOPAL_DB_USER' => config('database.connections.mysql.username'),
            'SOPAL_DB_PASSWORD' => config('database.connections.mysql.password'),
        ];
    }
}
