<?php

namespace App\Services;

use App\Http\Controllers\ExtractionController;
use App\Models\StockImport;
use App\Models\StockLigne;
use App\Support\ArticleSopal;
use App\Support\DateSopal;
use App\Support\LecteurXlsx;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

/**
 * Import et lecture du fichier de STOCK (photo du stock à un instant donné,
 * export INVLISTELOCALL de l'ERP), stocké en base de données.
 *
 * Le fichier brut est d'abord nettoyé par basestock.py : colonnes inutiles
 * retirées, emplacements hors périmètre écartés, statuts Q et R* supprimés.
 * Ce qui en ressort est ensuite filtré sur les produits finis (5e caractère
 * A ou B, voir ArticleSopal) puis enregistré.
 */
class StockStore
{
    private const DOSSIER_PYTHON = 'C:\\STAGE\\projet sopal';
    private const SCRIPT = 'basestock.py';

    /** Nombre d'imports conservés : au-delà, le plus ancien et ses lignes sont supprimés. */
    private const HISTORIQUE_MAX = 10;

    private const DELAI_MAX = 120;

    /** Lignes insérées par requête. */
    private const TAILLE_LOT = 500;

    /**
     * @return array{ok: bool, erreur?: string, import?: array}
     */
    public static function importer(string $cheminEntree, string $nomOriginal): array
    {
        $id = (string) Str::uuid();
        $sortie = storage_path("app/{$id}_stock.xlsx");

        try {
            $resultat = Process::path(self::DOSSIER_PYTHON)
                ->env(ExtractionController::env())
                ->timeout(self::DELAI_MAX)
                ->run(['python', self::SCRIPT, $cheminEntree, $sortie]);

            if (!$resultat->successful()) {
                return ['ok' => false, 'erreur' => 'Le nettoyage du fichier a échoué : '.trim($resultat->errorOutput() ?: $resultat->output())];
            }

            if (!file_exists($sortie)) {
                return ['ok' => false, 'erreur' => 'Le fichier nettoyé est introuvable après traitement.'];
            }

            $titre = self::titreDepuisSortie($resultat->output());
            [$colonnes, $lignes] = LecteurXlsx::tableau(LecteurXlsx::grille($sortie), 0);

            if (empty($colonnes)) {
                return ['ok' => false, 'erreur' => "Ce fichier ne contient aucune colonne exploitable."];
            }

            return self::enregistrer($id, $nomOriginal, $titre, $colonnes, $lignes);
        } finally {
            @unlink($sortie);
        }
    }

    /** Filtre les produits finis et insère le reste par lots. */
    private static function enregistrer(string $id, string $nomOriginal, ?string $titre, array $colonnes, array $lignes): array
    {
        $cle = fn (?array $c) => $c['key'] ?? null;
        $cArticle = $cle(LecteurXlsx::trouverColonne($colonnes, 'article'));
        $cDesignation = $cle(LecteurXlsx::trouverColonne($colonnes, 'designation'));
        $cQuantite = $cle(LecteurXlsx::trouverColonne($colonnes, 'qtestock', 'qte', 'quantite'));
        $cEmplacement = $cle(LecteurXlsx::trouverColonne($colonnes, 'emplac'));
        $cStatut = $cle(LecteurXlsx::trouverColonne($colonnes, 'statut'));

        if (!$cArticle) {
            return ['ok' => false, 'erreur' => "Ce fichier n'a pas de colonne « Article ». Vérifie qu'il s'agit bien de l'export de stock (INVLISTELOCALL)."];
        }

        DB::connection('mysql')->beginTransaction();

        try {
            $gardees = 0;
            $lot = [];

            foreach ($lignes as $ligne) {
                $article = trim((string) ($ligne[$cArticle] ?? ''));

                // Produits finis uniquement : écarte aussi les lignes de
                // sous-total et les en-têtes répétés, qui n'ont pas de code valide.
                if ($article === '' || !ArticleSopal::estValide($article)) {
                    continue;
                }

                $lot[] = [
                    'import_id' => $id,
                    'Article' => $article,
                    'Designation' => self::tronquer($cDesignation ? ($ligne[$cDesignation] ?? null) : null, 255),
                    'Quantite' => (float) str_replace([' ', "\u{a0}", ','], ['', '', '.'], (string) ($cQuantite ? ($ligne[$cQuantite] ?? 0) : 0)),
                    'Emplacement' => self::tronquer($cEmplacement ? ($ligne[$cEmplacement] ?? null) : null, 60),
                    'Statut' => self::tronquer($cStatut ? ($ligne[$cStatut] ?? null) : null, 20),
                    'donnees' => json_encode($ligne, JSON_UNESCAPED_UNICODE),
                ];
                $gardees++;

                if (count($lot) >= self::TAILLE_LOT) {
                    StockLigne::insert($lot);
                    $lot = [];
                }
            }

            if ($lot) {
                StockLigne::insert($lot);
            }

            if ($gardees === 0) {
                DB::connection('mysql')->rollBack();

                return ['ok' => false, 'erreur' => 'Aucun produit fini trouvé : les '.count($lignes).' lignes du fichier ont toutes été écartées (5e caractère du code article ni A ni B).'];
            }

            $import = StockImport::create([
                'id' => $id,
                'nom_fichier' => $nomOriginal,
                'titre_stock' => $titre,
                // Analysée une seule fois, à l'import.
                'instant_reference' => DateSopal::dansTitre($titre),
                'colonnes' => $colonnes,
                'lignes_lues' => count($lignes),
                'lignes_gardees' => $gardees,
            ]);

            DB::connection('mysql')->commit();
        } catch (\Throwable $e) {
            DB::connection('mysql')->rollBack();

            return ['ok' => false, 'erreur' => "L'enregistrement en base a échoué : ".$e->getMessage()];
        }

        self::purger();

        return ['ok' => true, 'import' => self::contenu($import)];
    }

    private static function tronquer($valeur, int $longueur): ?string
    {
        $texte = trim((string) ($valeur ?? ''));

        return $texte === '' ? null : mb_substr($texte, 0, $longueur);
    }

    /** Import complet, au format attendu par la page Stock / Production. */
    public static function contenu(StockImport $import): array
    {
        return [
            'id' => $import->id,
            'nomFichier' => $import->nom_fichier,
            'titreStock' => $import->titre_stock,
            'colonnes' => $import->colonnes,
            'lignes' => StockLigne::where('import_id', $import->id)
                ->orderBy('id')
                ->pluck('donnees')
                ->all(),
        ];
    }

    /** Métadonnées seules, pour le sélecteur d'historique. */
    public static function liste(): array
    {
        return StockImport::orderByDesc('created_at')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'nomFichier' => $i->nom_fichier,
                'titreStock' => $i->titre_stock,
                'horodatage' => $i->created_at?->toIso8601String(),
                'nombreLignes' => $i->lignes_gardees,
            ])
            ->all();
    }

    public static function charger(?string $id): ?StockImport
    {
        return $id ? StockImport::find($id) : null;
    }

    public static function dernier(): ?StockImport
    {
        return StockImport::orderByDesc('created_at')->first();
    }

    /** Supprime un import ET ses lignes. */
    public static function supprimer(string $id): bool
    {
        $import = StockImport::find($id);
        if (!$import) {
            return false;
        }

        StockLigne::where('import_id', $id)->delete();
        $import->delete();

        return true;
    }

    /**
     * Quantité en stock par article, additionnée sur tous les emplacements.
     *
     * Fait par MySQL (GROUP BY indexé) : c'est l'appel le plus fréquent du
     * site (page Analyse, service des commandes, stock historique).
     *
     * @return array{id: ?string, quantites: array<string, float>, titreStock: ?string, nomFichier: ?string, instantReference: ?\Carbon\Carbon}
     */
    public static function quantitesParArticle(?string $id = null): array
    {
        $import = $id ? self::charger($id) : self::dernier();

        if (!$import) {
            return ['id' => null, 'quantites' => [], 'titreStock' => null, 'nomFichier' => null, 'instantReference' => null];
        }

        $quantites = StockLigne::where('import_id', $import->id)
            ->groupBy('Article')
            ->selectRaw('Article, SUM(Quantite) as total')
            ->pluck('total', 'Article')
            ->map(fn ($v) => (float) $v)
            ->all();

        return [
            'id' => $import->id,
            'quantites' => $quantites,
            'titreStock' => $import->titre_stock,
            'nomFichier' => $import->nom_fichier,
            'instantReference' => $import->instant_reference,
        ];
    }

    /** Lignes d'un article (un emplacement par ligne), au format d'affichage. */
    public static function lignesArticle(string $idImport, string $article): array
    {
        return StockLigne::where('import_id', $idImport)
            ->where('Article', trim($article))
            ->orderBy('id')
            ->pluck('donnees')
            ->all();
    }

    /** Import le plus récent contenant cet article — point d'entrée depuis la page Commandes. */
    public static function dernierAvecArticle(string $article): ?StockImport
    {
        $idImport = StockLigne::where('Article', trim($article))
            ->join('stock_imports', 'stock_imports.id', '=', 'stock_lignes.import_id')
            ->orderByDesc('stock_imports.created_at')
            ->value('stock_lignes.import_id');

        return $idImport ? StockImport::find($idImport) : null;
    }

    /** Lit la ligne JSON affichée par basestock.py sur sa sortie standard. */
    private static function titreDepuisSortie(string $sortieScript): ?string
    {
        $derniere = trim(collect(explode("\n", trim($sortieScript)))->last() ?? '');

        return json_decode($derniere, true)['titre'] ?? null;
    }

    private static function purger(): void
    {
        $aSupprimer = StockImport::orderByDesc('created_at')
            ->skip(self::HISTORIQUE_MAX)
            ->take(100)
            ->pluck('id');

        foreach ($aSupprimer as $id) {
            self::supprimer($id);
        }
    }
}
