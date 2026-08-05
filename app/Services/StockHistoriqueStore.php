<?php

namespace App\Services;

use App\Http\Controllers\StockController;
use App\Models\MouvementImport;
use App\Models\MouvementStock;
use App\Support\DateSopal;
use Carbon\Carbon;

/**
 * Calcul du stock à n'importe quel instant, à partir des DEUX fichiers Excel :
 *
 *   fichier 1 (stock)      = une photo du stock à un instant précis
 *   fichier 2 (mouvements) = les entrées/sorties qui ont suivi, en base
 *
 *   stock(article, T) = stock de référence de l'article
 *                     + somme des mouvements de cet article
 *                       dont l'instant est dans ]référence, T]
 *
 * La borne basse est STRICTEMENT ouverte : la photo de stock contient déjà les
 * mouvements antérieurs, les recompter les compterait deux fois.
 *
 * Les quantités sont additionnées TELLES QUELLES, quelle que soit la
 * transaction : le fichier ERP les fournit déjà signées.
 *
 * Le stock de référence est repris de StockController::quantitesParArticle(),
 * qui sait déjà additionner les lignes d'un même article (un article occupe
 * plusieurs emplacements, donc plusieurs lignes).
 */
class StockHistoriqueStore
{
    /**
     * Contextes déjà assemblés pendant cette requête.
     *
     * `contexte()` agrège tout le stock par article : une page qui l'appelle
     * quatre fois payait quatre fois ce calcul. Le résultat est identique dans
     * une même requête, on le garde donc en mémoire — sans persistance, pour
     * qu'un import fait juste après soit bien pris en compte à la requête
     * suivante.
     */
    private static array $contextesCharges = [];

    /**
     * Assemble les deux sources et vérifie qu'elles sont exploitables ensemble.
     *
     * @return array{ok: bool, erreur?: string, reference?: array, import?: MouvementImport, instantReference?: Carbon}
     */
    public static function contexte(?string $idMouvements = null): array
    {
        $cle = $idMouvements ?? '_dernier';
        if (isset(self::$contextesCharges[$cle])) {
            return self::$contextesCharges[$cle];
        }

        return self::$contextesCharges[$cle] = self::assembler($idMouvements);
    }

    /** Vide le cache de requête — à appeler après un import, qui change les données. */
    public static function oublier(): void
    {
        self::$contextesCharges = [];
    }

    private static function assembler(?string $idMouvements): array
    {
        $reference = StockController::quantitesParArticle();

        if (empty($reference['quantites'])) {
            return ['ok' => false, 'erreur' => "Aucun fichier de stock n'a encore été importé. Commence par importer le fichier de stock de référence dans Stock / Production."];
        }

        $instant = DateSopal::dansTitre($reference['titreStock']);
        if (!$instant) {
            return [
                'ok' => false,
                'erreur' => "La date de référence n'a pas pu être lue dans l'en-tête du fichier de stock"
                    .($reference['titreStock'] ? " (« {$reference['titreStock']} »)" : '')
                    .'. Le calcul historique a besoin de cette date.',
            ];
        }

        $import = $idMouvements ? MouvementStore::charger($idMouvements) : MouvementStore::dernier();

        if (!$import) {
            return ['ok' => false, 'erreur' => "Aucun fichier de mouvements n'a encore été importé."];
        }

        return [
            'ok' => true,
            'reference' => $reference,
            'import' => $import,
            'instantReference' => $instant,
        ];
    }

    /**
     * Désignation de chaque article : code -> libellé.
     *
     * Prises en priorité dans `stock_lignes`, où la colonne est couverte par
     * un index : 68 ms, contre 797 ms pour la même requête sur
     * `mouvements_stock` (84 000 lignes, désignation hors index). Seuls les
     * articles absents de la photo de stock — quelques centaines — sont
     * cherchés côté mouvements.
     */
    private static function designations(array $contexte): array
    {
        $duStock = \App\Models\StockLigne::where('import_id', $contexte['reference']['id'])
            ->groupBy('Article')
            ->selectRaw('Article, MAX(Designation) as designation')
            ->pluck('designation', 'Article')
            ->all();

        $manquants = array_values(array_diff(
            MouvementStock::where('import_id', $contexte['import']->id)
                ->distinct()
                ->pluck('Article')
                ->all(),
            array_keys($duStock)
        ));

        if (!$manquants) {
            return $duStock;
        }

        $desMouvements = MouvementStock::where('import_id', $contexte['import']->id)
            ->whereIn('Article', $manquants)
            ->groupBy('Article')
            ->selectRaw('Article, MAX(Designation) as designation')
            ->pluck('designation', 'Article')
            ->all();

        return $duStock + $desMouvements;
    }

    /** Requête de base : les mouvements d'un import postérieurs à la photo de stock. */
    private static function requete(array $contexte)
    {
        return MouvementStock::where('import_id', $contexte['import']->id)
            ->where('instant', '>', $contexte['instantReference']);
    }

    /**
     * Détail du stock d'UN article à un instant donné (vue 1).
     */
    public static function article(array $contexte, string $article, Carbon $instant): array
    {
        $article = trim($article);
        $stockReference = (float) ($contexte['reference']['quantites'][$article] ?? 0);

        $retenus = self::requete($contexte)
            ->where('Article', $article)
            ->where('instant', '<=', $instant)
            ->orderBy('instant')
            ->get();

        // Mouvements postérieurs à la date demandée : comptés pour l'expliquer
        // à l'écran, mais évidemment pas additionnés.
        $horsPeriode = self::requete($contexte)
            ->where('Article', $article)
            ->where('instant', '>', $instant)
            ->count();

        $variation = 0.0;
        $detail = [];

        foreach ($retenus as $mouvement) {
            $variation += $mouvement->quantite;
            $detail[] = [
                'instant' => DateSopal::pourAffichage($mouvement->instant),
                'quantite' => $mouvement->quantite,
                'transaction' => $mouvement->Transaction,
                'piece' => $mouvement->Piece_origine,
                'emplacement' => $mouvement->Emplacement,
                'stockApres' => round($stockReference + $variation, 3),
            ];
        }

        return [
            'article' => $article,
            'designation' => $retenus->first()?->Designation
                ?? MouvementStock::where('Article', $article)->value('Designation'),
            'stockReference' => round($stockReference, 3),
            'variation' => round($variation, 3),
            'stock' => round($stockReference + $variation, 3),
            'mouvements' => $detail,
            'horsPeriode' => $horsPeriode,
            'presentEnReference' => isset($contexte['reference']['quantites'][$article]),
        ];
    }

    /**
     * Courbe d'évolution d'un article (vue 2) : un point de départ à la date de
     * référence, puis un point après chaque mouvement.
     */
    public static function evolution(array $contexte, string $article, ?Carbon $jusqua = null): array
    {
        $article = trim($article);
        $stock = (float) ($contexte['reference']['quantites'][$article] ?? 0);

        $points = [[
            'instant' => DateSopal::pourAffichage($contexte['instantReference']),
            'stock' => round($stock, 3),
            'quantite' => null,
        ]];

        $requete = self::requete($contexte)->where('Article', $article);
        if ($jusqua) {
            $requete->where('instant', '<=', $jusqua);
        }

        foreach ($requete->orderBy('instant')->get() as $mouvement) {
            $stock += $mouvement->quantite;
            $instant = DateSopal::pourAffichage($mouvement->instant);
            $dernier = count($points) - 1;

            // Plusieurs mouvements à la même seconde : un seul point, sinon la
            // courbe affiche des marches verticales illisibles.
            if ($points[$dernier]['instant'] === $instant) {
                $points[$dernier]['stock'] = round($stock, 3);
                $points[$dernier]['quantite'] += $mouvement->quantite;
            } else {
                $points[] = [
                    'instant' => $instant,
                    'stock' => round($stock, 3),
                    'quantite' => $mouvement->quantite,
                ];
            }
        }

        return $points;
    }

    /**
     * Stock de TOUS les articles à un instant donné (vue 3).
     *
     * L'addition est faite par MySQL (GROUP BY) : inutile de rapatrier les
     * 84 000 lignes en PHP pour les additionner.
     */
    public static function tous(array $contexte, Carbon $instant): array
    {
        $reference = $contexte['reference']['quantites'];

        $agregats = self::requete($contexte)
            ->where('instant', '<=', $instant)
            ->groupBy('Article')
            ->selectRaw('Article, MAX(Designation) as designation, SUM(quantite) as variation, COUNT(*) as nombre')
            ->get()
            ->keyBy('Article');

        // Union des deux sources : un article peut n'exister que dans la photo
        // (aucun mouvement depuis) ou que dans les mouvements (créé après).
        //
        // On part de TOUS les articles du fichier de mouvements, pas seulement
        // de ceux qui ont bougé dans la fenêtre : sinon la liste changerait de
        // taille à chaque date choisie, ce qui donnerait l'impression que des
        // articles disparaissent.
        // Liste complète des articles ET leur désignation. La désignation
        // manque dans l'agrégat pour les articles sans mouvement dans la
        // fenêtre : elle est donc reprise à part (voir designations()).
        $designations = self::designations($contexte);

        $codes = array_unique(array_merge(array_keys($reference), array_keys($designations)));
        sort($codes);

        $lignes = [];
        foreach ($codes as $code) {
            $stockReference = (float) ($reference[$code] ?? 0);
            $agregat = $agregats->get($code);
            $variation = (float) ($agregat->variation ?? 0);

            $lignes[] = [
                'article' => $code,
                'designation' => $agregat->designation ?? $designations[$code] ?? null,
                'stockReference' => round($stockReference, 3),
                'variation' => round($variation, 3),
                'stock' => round($stockReference + $variation, 3),
                'nombreMouvements' => (int) ($agregat->nombre ?? 0),
                'presentEnReference' => isset($reference[$code]),
            ];
        }

        return $lignes;
    }

    /**
     * Mouvements d'un article REGROUPÉS PAR HEURE, pour la fiche article.
     *
     * Une même heure porte souvent plusieurs sorties (plusieurs livraisons
     * saisies à la suite) : les regrouper donne un rythme d'activité lisible,
     * là où la liste ligne à ligne est trop dense.
     *
     * Contrairement aux trois vues, AUCUN filtrage sur la date de référence :
     * la fiche article montre tout l'historique disponible dans le fichier.
     */
    public static function parHeure(string $article, ?string $idImport = null): array
    {
        $idImport ??= MouvementStore::dernier()?->id;
        if (!$idImport) {
            return [];
        }

        return MouvementStock::where('import_id', $idImport)
            ->where('Article', trim($article))
            ->groupByRaw("DATE_FORMAT(instant, '%Y-%m-%d %H:00:00')")
            ->selectRaw("
                DATE_FORMAT(instant, '%Y-%m-%d %H:00:00') as heure,
                SUM(quantite) as variation,
                SUM(CASE WHEN quantite > 0 THEN quantite ELSE 0 END) as entrees,
                SUM(CASE WHEN quantite < 0 THEN quantite ELSE 0 END) as sorties,
                COUNT(*) as nombre
            ")
            ->orderByRaw("DATE_FORMAT(instant, '%Y-%m-%d %H:00:00')")
            ->get()
            ->map(fn ($l) => [
                'heure' => $l->heure,
                'variation' => round((float) $l->variation, 3),
                'entrees' => round((float) $l->entrees, 3),
                'sorties' => round((float) $l->sorties, 3),
                'nombre' => (int) $l->nombre,
            ])
            ->all();
    }

    /**
     * Stock d'un article à la DERNIÈRE date connue : la photo de stock, plus
     * tous les mouvements enregistrés depuis.
     *
     * C'est ce chiffre qui est affiché en tête de la fiche article : la
     * quantité du fichier de stock seule est déjà périmée dès qu'un mouvement
     * a eu lieu.
     *
     * Retourne null si l'un des deux fichiers manque — la fiche se rabat alors
     * sur la quantité du fichier de stock.
     */
    public static function stockDerniereDate(string $article): ?array
    {
        $contexte = self::contexte();
        if (!$contexte['ok']) {
            return null;
        }

        $article = trim($article);
        $reference = (float) ($contexte['reference']['quantites'][$article] ?? 0);

        $mouvements = self::requete($contexte)->where('Article', $article);

        $variation = (float) $mouvements->clone()->sum('quantite');
        $nombre = $mouvements->clone()->count();
        $derniere = $mouvements->clone()->max('instant');

        return [
            'reference' => round($reference, 3),
            'instantReference' => DateSopal::pourAffichage($contexte['instantReference']),
            'variation' => round($variation, 3),
            'stock' => round($reference + $variation, 3),
            'nombreMouvements' => $nombre,
            // Dernier mouvement connu, ou la date de la photo s'il n'y en a aucun.
            'derniereDate' => $derniere
                ? DateSopal::pourAffichage(Carbon::parse($derniere))
                : DateSopal::pourAffichage($contexte['instantReference']),
        ];
    }

    /**
     * Variation de stock de CHAQUE article depuis la photo de stock, en une
     * seule requête agrégée.
     *
     * Sert au tableau de Stock / Production : sans elle, il afficherait les
     * quantités du fichier, périmées dès qu'un mouvement a eu lieu.
     *
     * @return array{import: ?string, variations: array<string, float>}
     */
    public static function variationsParArticle(): array
    {
        $contexte = self::contexte();
        if (!$contexte['ok']) {
            return ['import' => null, 'variations' => []];
        }

        return [
            // Id de l'import de stock auquel ces variations se rapportent :
            // les appliquer à un import plus ancien donnerait un faux chiffre.
            'import' => $contexte['reference']['id'],
            'variations' => self::requete($contexte)
                ->groupBy('Article')
                ->selectRaw('Article, SUM(quantite) as total')
                ->pluck('total', 'Article')
                ->map(fn ($v) => round((float) $v, 3))
                ->all(),
        ];
    }

    /**
     * STOCK FINAL par article : la photo de stock, plus tous les mouvements
     * enregistrés depuis.
     *
     * C'est le stock RÉEL, celui sur lequel il faut raisonner avant de servir
     * une commande. Toutes les pages qui affichent ou consomment du stock
     * passent par ici.
     *
     * À ne pas confondre avec StockStore::quantitesParArticle(), qui rend la
     * photo BRUTE : elle sert de point de départ au calcul historique, et y
     * ajouter les mouvements les compterait deux fois.
     *
     * Le format de retour est identique à celui de quantitesParArticle(), pour
     * que les appelants puissent basculer sans rien changer d'autre.
     *
     * @return array{id: ?string, quantites: array<string, float>, titreStock: ?string, nomFichier: ?string, derniereDate: ?string, aJour: bool}
     */
    public static function quantitesFinales(): array
    {
        $contexte = self::contexte();

        // Pas de fichier de mouvements : le stock final est la photo elle-même.
        if (!$contexte['ok']) {
            return StockController::quantitesParArticle() + ['derniereDate' => null, 'aJour' => false];
        }

        $quantites = $contexte['reference']['quantites'];

        foreach (self::variationsParArticle()['variations'] as $article => $variation) {
            $quantites[$article] = round(($quantites[$article] ?? 0) + $variation, 3);
        }

        return [
            'id' => $contexte['reference']['id'],
            'quantites' => $quantites,
            'titreStock' => $contexte['reference']['titreStock'],
            'nomFichier' => $contexte['reference']['nomFichier'],
            'derniereDate' => $contexte['import']->fin
                ? DateSopal::pourAffichage($contexte['import']->fin)
                : null,
            'aJour' => true,
        ];
    }

    /** Détail ligne à ligne des mouvements d'un article (fiche article). */
    public static function lignesArticle(string $article, ?string $idImport = null): array
    {
        $idImport ??= MouvementStore::dernier()?->id;
        if (!$idImport) {
            return [];
        }

        return MouvementStock::where('import_id', $idImport)
            ->where('Article', trim($article))
            ->orderByDesc('instant')
            ->get()
            ->map(fn ($m) => [
                'instant' => DateSopal::pourAffichage($m->instant),
                'quantite' => $m->quantite,
                'transaction' => $m->Transaction,
                'piece' => $m->Piece_origine,
                'emplacement' => $m->Emplacement,
            ])
            ->all();
    }

    /** Liste des articles proposés dans les sélecteurs : union des deux sources. */
    public static function articlesDisponibles(array $contexte): array
    {
        $designations = self::designations($contexte);

        $codes = array_unique(array_merge(
            array_keys($contexte['reference']['quantites']),
            array_keys($designations)
        ));
        sort($codes);

        return array_map(fn ($code) => [
            'article' => $code,
            'designation' => $designations[$code] ?? null,
        ], $codes);
    }
}
