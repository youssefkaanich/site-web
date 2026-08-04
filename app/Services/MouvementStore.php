<?php

namespace App\Services;

use App\Http\Controllers\ExtractionController;
use App\Models\MouvementImport;
use App\Models\MouvementStock;
use App\Support\ArticleSopal;
use App\Support\DateSopal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

/**
 * Import du fichier de MOUVEMENTS de stock (2e fichier Excel) et rangement
 * EN BASE DE DONNÉES (tables mouvements_imports et mouvements_stock).
 *
 * Le fichier brut est confié à basemouvements.py — lire ces fichiers avec
 * PhpSpreadsheet demanderait 50 s et 635 Mo, au-dessus de la limite mémoire de
 * PHP, quand xlrd fait le même travail en 4 s.
 *
 * FILTRE PRODUITS FINIS : seuls les articles dont le 5e caractère est A ou B
 * sont conservés (voir ArticleSopal). C'est ce caractère qui distingue un
 * produit fini d'une matière première ou d'un composant.
 */
class MouvementStore
{
    private const DOSSIER_PYTHON = 'C:\\STAGE\\projet sopal';
    private const SCRIPT = 'basemouvements.py';

    /** Nombre d'imports conservés : au-delà, le plus ancien et ses lignes sont supprimés. */
    private const HISTORIQUE_MAX = 5;

    /** Les fichiers réels montent à ~185 000 lignes : la lecture Python prend ~5 s, on laisse large. */
    private const DELAI_MAX = 300;

    /** Lignes insérées par requête. Au-delà, MySQL refuse le paquet (max_allowed_packet). */
    private const TAILLE_LOT = 1000;

    /**
     * Lit le fichier, écarte ce qui n'est pas un produit fini, et enregistre
     * le reste en base.
     *
     * @return array{ok: bool, erreur?: string, import?: array}
     */
    public static function importer(string $cheminFichier, string $nomOriginal): array
    {
        $id = (string) Str::uuid();
        $sortie = storage_path("app/{$id}_mouvements.json");

        try {
            $resultat = Process::path(self::DOSSIER_PYTHON)
                ->env(ExtractionController::env())
                ->timeout(self::DELAI_MAX)
                ->run(['python', self::SCRIPT, $cheminFichier, $sortie]);

            if (!$resultat->successful()) {
                return ['ok' => false, 'erreur' => 'Lecture du fichier impossible : '.trim($resultat->errorOutput() ?: $resultat->output())];
            }

            if (!file_exists($sortie)) {
                return ['ok' => false, 'erreur' => "Le fichier n'a produit aucun résultat exploitable."];
            }

            $brut = json_decode(file_get_contents($sortie), true);
            if (!is_array($brut) || empty($brut['lignes'])) {
                return ['ok' => false, 'erreur' => "Aucun mouvement trouvé. Vérifie qu'il s'agit bien de l'export « Mouvements de stock » (MVTSTOTRSVCR)."];
            }

            return self::enregistrer($id, $nomOriginal, $brut);
        } finally {
            @unlink($sortie);
        }
    }

    /** Convertit les lignes brutes en enregistrements et les insère par lots. */
    private static function enregistrer(string $id, string $nomOriginal, array $brut): array
    {
        $champs = array_flip($brut['champs'] ?? []);
        $index = fn (string $nom, int $defaut) => $champs[$nom] ?? $defaut;

        // 'date' = date de CRÉATION : c'est elle qui va avec l'heure de
        // création. La date d'imputation (comptable) est conservée à part.
        $iDate = $index('date', 0);
        $iImputation = $index('imputation', 1);
        $iCode = $index('code', 1);
        $iDesignation = $index('designation', 2);
        $iHeure = $index('heure', 3);
        $iQuantite = $index('quantite', 4);
        $iTransaction = $index('transaction', 5);
        $iPiece = $index('piece', 6);
        $iEmplacement = $index('emplacement', 7);

        $ecartes = ['article' => 0, 'date' => 0, 'quantite' => 0];
        $articles = [];
        $debut = null;
        $fin = null;
        $total = 0;
        $lot = [];

        DB::connection('mysql')->beginTransaction();

        try {
            foreach ($brut['lignes'] as $ligne) {
                $code = trim((string) ($ligne[$iCode] ?? ''));

                // Filtre produits finis : 5e caractère A ou B.
                if ($code === '' || !ArticleSopal::estValide($code)) {
                    $ecartes['article']++;
                    continue;
                }

                $instant = DateSopal::parserDateHeure($ligne[$iDate] ?? null, $ligne[$iHeure] ?? null);
                if (!$instant) {
                    $ecartes['date']++;
                    continue;
                }

                $quantite = str_replace([' ', "\u{a0}", ','], ['', '', '.'], (string) ($ligne[$iQuantite] ?? ''));
                if ($quantite === '' || !is_numeric($quantite)) {
                    $ecartes['quantite']++;
                    continue;
                }

                $lot[] = [
                    'import_id' => $id,
                    'Article' => $code,
                    'Designation' => self::tronquer($ligne[$iDesignation] ?? null, 255),
                    'instant' => $instant->format('Y-m-d H:i:s'),
                    'date_imputation' => DateSopal::parserDate($ligne[$iImputation] ?? null)?->format('Y-m-d'),
                    'quantite' => (float) $quantite,
                    'Transaction' => self::tronquer($ligne[$iTransaction] ?? null, 100),
                    'Piece_origine' => self::tronquer($ligne[$iPiece] ?? null, 120),
                    'Emplacement' => self::tronquer($ligne[$iEmplacement] ?? null, 60),
                ];

                $articles[$code] = true;
                $total++;
                $horodatage = $instant->getTimestamp();
                $debut = $debut === null ? $horodatage : min($debut, $horodatage);
                $fin = $fin === null ? $horodatage : max($fin, $horodatage);

                if (count($lot) >= self::TAILLE_LOT) {
                    MouvementStock::insert($lot);
                    $lot = [];
                }
            }

            if ($lot) {
                MouvementStock::insert($lot);
            }

            if ($total === 0) {
                DB::connection('mysql')->rollBack();

                return [
                    'ok' => false,
                    'erreur' => 'Aucun produit fini trouvé : les '.count($brut['lignes'])
                        .' lignes lues ont toutes été écartées (code article dont le 5e caractère n\'est ni A ni B, date illisible ou quantité absente).',
                ];
            }

            $import = MouvementImport::create([
                'id' => $id,
                'nom_fichier' => $nomOriginal,
                'titre' => $brut['titre'] ?? null,
                'lignes_lues' => count($brut['lignes']),
                'mouvements' => $total,
                'articles' => count($articles),
                'ecartes_article' => $ecartes['article'],
                'ecartes_date' => $ecartes['date'],
                'ecartes_quantite' => $ecartes['quantite'],
                // Compté par basemouvements.py, qui a la colonne Statut sous les yeux.
                'ecartes_statut' => (int) ($brut['ecartes_statut'] ?? 0),
                'debut' => $debut ? date('Y-m-d H:i:s', $debut) : null,
                'fin' => $fin ? date('Y-m-d H:i:s', $fin) : null,
            ]);

            DB::connection('mysql')->commit();
        } catch (\Throwable $e) {
            DB::connection('mysql')->rollBack();

            return ['ok' => false, 'erreur' => "L'enregistrement en base a échoué : ".$e->getMessage()];
        }

        self::purger();

        return ['ok' => true, 'import' => self::resume($import)];
    }

    /** Coupe une valeur à la longueur de sa colonne : une désignation trop longue ne doit pas faire échouer tout l'import. */
    private static function tronquer($valeur, int $longueur): ?string
    {
        $texte = trim((string) ($valeur ?? ''));

        return $texte === '' ? null : mb_substr($texte, 0, $longueur);
    }

    /** Métadonnées d'un import, au format attendu par la page. */
    public static function resume(MouvementImport $import): array
    {
        return [
            'id' => $import->id,
            'nomFichier' => $import->nom_fichier,
            'titre' => $import->titre,
            'horodatage' => $import->created_at?->toIso8601String(),
            'lues' => $import->lignes_lues,
            'nombreMouvements' => $import->mouvements,
            'nombreArticles' => $import->articles,
            'ignores' => [
                'article' => $import->ecartes_article,
                'date' => $import->ecartes_date,
                'quantite' => $import->ecartes_quantite,
                'statut' => $import->ecartes_statut,
            ],
            'debut' => $import->debut?->getTimestamp(),
            'fin' => $import->fin?->getTimestamp(),
        ];
    }

    /** Liste des imports, du plus récent au plus ancien. */
    public static function liste(): array
    {
        return MouvementImport::orderByDesc('created_at')
            ->get()
            ->map(fn ($i) => self::resume($i))
            ->all();
    }

    public static function charger(?string $id): ?MouvementImport
    {
        return $id ? MouvementImport::find($id) : null;
    }

    public static function dernier(): ?MouvementImport
    {
        return MouvementImport::orderByDesc('created_at')->first();
    }

    /** Supprime un import ET ses lignes. */
    public static function supprimer(string $id): bool
    {
        $import = MouvementImport::find($id);
        if (!$import) {
            return false;
        }

        MouvementStock::where('import_id', $id)->delete();
        $import->delete();

        return true;
    }

    private static function purger(): void
    {
        $aSupprimer = MouvementImport::orderByDesc('created_at')
            ->skip(self::HISTORIQUE_MAX)
            ->take(100)
            ->pluck('id');

        foreach ($aSupprimer as $id) {
            self::supprimer($id);
        }
    }
}
