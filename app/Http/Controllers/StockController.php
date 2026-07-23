<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

class StockController extends Controller
{
    private const DOSSIER_PYTHON = 'C:\\STAGE\\projet sopal';
    private const SCRIPT = 'basestock.py';

    /** Nombre maximum d'imports gardés dans l'historique (les plus anciens sont supprimés au-delà). */
    private const HISTORIQUE_MAX = 10;

    public function page()
    {
        return \Inertia\Inertia::render('StockProduction');
    }

    private function dossierHistorique(): string
    {
        $dossier = storage_path('app/stock_production_historique');
        if (!is_dir($dossier)) {
            mkdir($dossier, 0755, true);
        }

        return $dossier;
    }

    /**
     * Reçoit le fichier Excel importé, le fait nettoyer par basestock.py
     * (colonnes retirées, 2e ligne = en-têtes), sauvegarde le résultat dans
     * l'historique (storage/app/stock_production_historique) puis le renvoie
     * en JSON pour affichage direct dans le tableau.
     */
    public function importer(Request $request)
    {
        $request->validate([
            'fichier' => 'required|file|mimes:xlsx,xls',
        ]);

        $dossierTmp = storage_path('app/stock_production_tmp');
        if (!is_dir($dossierTmp)) {
            mkdir($dossierTmp, 0755, true);
        }

        $id = (string) Str::uuid();
        $entree = "{$dossierTmp}/{$id}_entree.xlsx";
        $sortie = "{$dossierTmp}/{$id}_sortie.xlsx";

        $request->file('fichier')->move($dossierTmp, basename($entree));
        $nomFichierOriginal = $request->file('fichier')->getClientOriginalName();

        try {
            $resultat = Process::path(self::DOSSIER_PYTHON)
                ->env(ExtractionController::env())
                ->timeout(60)
                ->run(['python', self::SCRIPT, $entree, $sortie]);

            if (!$resultat->successful()) {
                return response()->json([
                    'erreur' => "Le script basestock.py a échoué : ".trim($resultat->errorOutput() ?: $resultat->output()),
                ], 422);
            }

            if (!file_exists($sortie)) {
                return response()->json(['erreur' => 'Le fichier nettoyé est introuvable après traitement.'], 422);
            }

            $titreStock = self::extraireTitre($resultat->output());
            [$colonnes, $lignes] = self::lireXlsx($sortie);

            $entree_historique = [
                'id' => $id,
                'nomFichier' => $nomFichierOriginal,
                'titreStock' => $titreStock,
                'horodatage' => now()->toIso8601String(),
                'colonnes' => $colonnes,
                'lignes' => $lignes,
            ];
            file_put_contents(
                $this->dossierHistorique()."/{$id}.json",
                json_encode($entree_historique, JSON_UNESCAPED_UNICODE)
            );
            self::purgerAncienHistorique($this->dossierHistorique());

            return response()->json([
                'id' => $id,
                'nomFichier' => $nomFichierOriginal,
                'titreStock' => $titreStock,
                'colonnes' => $colonnes,
                'lignes' => $lignes,
            ]);
        } finally {
            @unlink($entree);
            @unlink($sortie);
        }
    }

    /** Liste des imports sauvegardés (métadonnées seulement, pas les lignes) pour le sélecteur d'historique. */
    public function historique()
    {
        $fichiers = glob($this->dossierHistorique().'/*.json') ?: [];
        usort($fichiers, fn ($a, $b) => filemtime($b) <=> filemtime($a));

        $liste = array_map(function ($chemin) {
            $donnees = json_decode(file_get_contents($chemin), true);

            return [
                'id' => $donnees['id'] ?? pathinfo($chemin, PATHINFO_FILENAME),
                'nomFichier' => $donnees['nomFichier'] ?? '(sans nom)',
                'titreStock' => $donnees['titreStock'] ?? null,
                'horodatage' => $donnees['horodatage'] ?? null,
                'nombreLignes' => count($donnees['lignes'] ?? []),
            ];
        }, $fichiers);

        return response()->json($liste);
    }

    /** Recharge un import précédemment sauvegardé (colonnes + lignes complètes). */
    public function charger(string $id)
    {
        $chemin = $this->dossierHistorique()."/{$id}.json";

        if (!file_exists($chemin)) {
            return response()->json(['erreur' => 'Cet import n\'existe plus.'], 404);
        }

        $donnees = json_decode(file_get_contents($chemin), true);

        return response()->json([
            'id' => $donnees['id'],
            'nomFichier' => $donnees['nomFichier'],
            'titreStock' => $donnees['titreStock'] ?? null,
            'colonnes' => $donnees['colonnes'],
            'lignes' => $donnees['lignes'],
        ]);
    }

    /**
     * Page de détail d'un article : cherche toutes ses lignes (= tous ses
     * emplacements) dans un import déjà sauvegardé, et les organise en
     * onglets (infos générales / emplacements / commandes liées).
     */
    public function article(string $id, string $article)
    {
        $chemin = $this->dossierHistorique()."/{$id}.json";

        if (!file_exists($chemin)) {
            abort(404, "Cet import n'existe plus.");
        }

        $donnees = json_decode(file_get_contents($chemin), true);

        $colonneArticle = collect($donnees['colonnes'])
            ->first(fn ($c) => self::normaliserLabel($c['label']) === 'article');

        if (!$colonneArticle) {
            abort(404, "Ce fichier n'a pas de colonne \"Article\".");
        }

        $lignesArticle = collect($donnees['lignes'])
            ->filter(fn ($l) => (string) ($l[$colonneArticle['key']] ?? '') === $article)
            ->values();

        if ($lignesArticle->isEmpty()) {
            abort(404, "Article \"{$article}\" introuvable dans cet import.");
        }

        return \Inertia\Inertia::render('StockArticleDetail', [
            'idImport' => $id,
            'article' => $article,
            'nomFichier' => $donnees['nomFichier'],
            'titreStock' => $donnees['titreStock'] ?? null,
            'colonnes' => $donnees['colonnes'],
            'colonneArticleKey' => $colonneArticle['key'],
            'lignes' => $lignesArticle,
        ]);
    }

    /** Compare des noms de colonnes en ignorant accents/espaces/tirets/casse (même logique que basestock.py). */
    private static function normaliserLabel(?string $label): string
    {
        $sansAccents = iconv('UTF-8', 'ASCII//TRANSLIT', (string) $label);
        $sansAccents = $sansAccents !== false ? $sansAccents : (string) $label;

        return strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $sansAccents));
    }

    /** Lit la ligne JSON affichée par basestock.py sur sa sortie standard pour en extraire le titre (date/heure du stock). */
    private static function extraireTitre(string $sortieScript): ?string
    {
        $derniereLigne = trim(collect(explode("\n", trim($sortieScript)))->last() ?? '');
        $donnees = json_decode($derniereLigne, true);

        return $donnees['titre'] ?? null;
    }

    /** Ne garde que les HISTORIQUE_MAX imports les plus récents. */
    private static function purgerAncienHistorique(string $dossier): void
    {
        $fichiers = glob($dossier.'/*.json') ?: [];
        usort($fichiers, fn ($a, $b) => filemtime($b) <=> filemtime($a));

        foreach (array_slice($fichiers, self::HISTORIQUE_MAX) as $ancien) {
            @unlink($ancien);
        }
    }

    /** Lit un .xlsx et retourne [colonnes, lignes] au même format que le reste de l'app. */
    private static function lireXlsx(string $chemin): array
    {
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($chemin);
        $feuille = $spreadsheet->getActiveSheet();
        $lignesBrutes = $feuille->toArray(null, true, true, false);

        if (empty($lignesBrutes)) {
            return [[], []];
        }

        $entetes = array_map(
            fn ($e, $i) => (string) ($e !== null && $e !== '' ? $e : "Colonne {$i}"),
            $lignesBrutes[0],
            array_keys($lignesBrutes[0])
        );

        $lignesDonnees = array_slice($lignesBrutes, 1);

        $lignes = [];
        foreach ($lignesDonnees as $index => $ligne) {
            $objet = ['_id' => $index];
            foreach ($entetes as $i => $label) {
                $objet["col_{$i}"] = $ligne[$i] ?? '';
            }
            $lignes[] = $objet;
        }

        $colonnes = [];
        foreach ($entetes as $i => $label) {
            $valeurs = collect(array_column($lignesDonnees, $i))->filter(fn ($v) => $v !== '' && $v !== null);
            $numerique = $valeurs->isNotEmpty() && $valeurs->every(fn ($v) => is_numeric($v));
            $colonnes[] = ['key' => "col_{$i}", 'label' => $label, 'numeric' => $numerique];
        }

        return [$colonnes, $lignes];
    }
}
