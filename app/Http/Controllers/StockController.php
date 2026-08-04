<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Services\CommandeStore;
use App\Services\StockHistoriqueStore;
use App\Services\StockStore;
use App\Support\LecteurXlsx;
use Illuminate\Http\Request;

/**
 * Page Stock / Production : import du fichier de stock de l'ERP et
 * consultation des articles.
 *
 * Depuis le 04/08/2026 les imports sont rangés EN BASE (tables stock_imports
 * et stock_lignes) et non plus en fichiers JSON — voir StockStore, qui porte
 * toute la logique d'accès.
 */
class StockController extends Controller
{
    /** Les gros fichiers de stock dépassent la limite par défaut. */
    private const MEMOIRE = '1024M';

    /**
     * Page Stock / Production.
     *
     * Elle porte deux choses : le tableau du dernier import (chargé par la
     * page elle-même en JavaScript) et les vues de stock historique, qui ont
     * besoin de la liste des articles et de la date de référence. Ces
     * dernières sont fournies ici pour éviter un aller-retour supplémentaire
     * au chargement.
     */
    public function page()
    {
        $contexte = StockHistoriqueStore::contexte();

        return \Inertia\Inertia::render('StockProduction', [
            'historiquePret' => $contexte['ok'],
            'historiqueErreur' => $contexte['ok'] ? null : $contexte['erreur'],
            'reference' => $contexte['ok'] ? [
                'nomFichier' => $contexte['reference']['nomFichier'],
                'instant' => \App\Support\DateSopal::pourAffichage($contexte['instantReference']),
                'nombreArticles' => count($contexte['reference']['quantites']),
            ] : null,
            'mouvements' => $contexte['ok'] ? \App\Services\MouvementStore::resume($contexte['import']) : null,
            'articlesHistorique' => $contexte['ok'] ? StockHistoriqueStore::articlesDisponibles($contexte) : [],
            'importsMouvements' => \App\Services\MouvementStore::liste(),
            // Variation de chaque article depuis la photo de stock, pour que le
            // tableau affiche le stock à jour et non la quantité du fichier.
            'variationsMouvements' => StockHistoriqueStore::variationsParArticle(),
        ]);
    }

    /**
     * Reçoit le fichier Excel importé, le fait nettoyer par basestock.py
     * (colonnes retirées, emplacements hors périmètre et statuts Q/R écartés),
     * garde les seuls produits finis et enregistre le tout en base.
     */
    public function importer(Request $request)
    {
        $request->validate([
            'fichier' => 'required|file|mimes:xlsx,xls',
        ]);

        ini_set('memory_limit', self::MEMOIRE);

        $dossierTmp = storage_path('app/stock_production_tmp');
        if (!is_dir($dossierTmp)) {
            mkdir($dossierTmp, 0755, true);
        }

        $nomOriginal = $request->file('fichier')->getClientOriginalName();
        $entree = $dossierTmp.'/'.uniqid('stock_').'.'.$request->file('fichier')->getClientOriginalExtension();
        $request->file('fichier')->move($dossierTmp, basename($entree));

        try {
            $resultat = StockStore::importer($entree, $nomOriginal);

            return $resultat['ok']
                ? response()->json($resultat['import'])
                : response()->json(['erreur' => $resultat['erreur']], 422);
        } finally {
            @unlink($entree);
        }
    }

    /** Liste des imports sauvegardés (métadonnées seulement) pour le sélecteur d'historique. */
    public function historique()
    {
        return response()->json(StockStore::liste());
    }

    /** Recharge un import précédemment sauvegardé (colonnes + lignes complètes). */
    public function charger(string $id)
    {
        $import = StockStore::charger($id);

        return $import
            ? response()->json(StockStore::contenu($import))
            : response()->json(['erreur' => "Cet import n'existe plus."], 404);
    }

    public function supprimerHistorique(string $id)
    {
        return StockStore::supprimer($id)
            ? response()->json(['ok' => true])
            : response()->json(['erreur' => "Cet import n'existe plus."], 404);
    }

    /**
     * Page de détail d'un article : toutes ses lignes (= tous ses
     * emplacements), ses commandes liées et ses mouvements de stock.
     */
    public function article(string $id, string $article)
    {
        $import = StockStore::charger($id);

        if (!$import) {
            abort(404, "Cet import n'existe plus.");
        }

        $lignes = StockStore::lignesArticle($id, $article);

        if (empty($lignes)) {
            abort(404, "Article \"{$article}\" introuvable dans cet import.");
        }

        $colonneArticle = LecteurXlsx::trouverColonne($import->colonnes, 'article');

        // Quantité déjà sortie du stock via la page Analyse, pour CET import
        // (les services d'un import précédent ne comptent plus, voir
        // ServiceStore). Le fichier n'est pas modifié : on affiche à côté la
        // quantité du fichier, ce qui a été servi, et le disponible réel.
        $servie = (float) Service::where('Article', $article)
            ->where('import_id', $id)
            ->sum('quantite');

        return \Inertia\Inertia::render('StockArticleDetail', [
            'idImport' => $id,
            'article' => $article,
            'nomFichier' => $import->nom_fichier,
            'titreStock' => $import->titre_stock,
            'colonnes' => $import->colonnes,
            'colonneArticleKey' => $colonneArticle['key'] ?? null,
            'lignes' => $lignes,
            'commandesLiees' => self::commandesLiees($article),
            'qteServie' => $servie,
            'mouvementsParHeure' => StockHistoriqueStore::parHeure($article),
            'mouvementsDetail' => StockHistoriqueStore::lignesArticle($article),
            'stockDerniereDate' => StockHistoriqueStore::stockDerniereDate($article),
        ]);
    }

    /**
     * Retrouve un article dans le dernier import de stock le contenant, et
     * redirige vers sa page de détail — point d'entrée depuis la page
     * Commandes, qui ne connaît pas l'id de l'import.
     */
    public function articleDernier(string $article)
    {
        $import = StockStore::dernierAvecArticle($article);

        if ($import) {
            return redirect()->route('stockProduction.article', ['id' => $import->id, 'article' => $article]);
        }

        // Cas courant (pas une vraie erreur) : beaucoup de commandes portent
        // sur un article absent du dernier import de stock — on affiche quand
        // même la fiche, avec une quantité de 0, les commandes liées et les
        // mouvements restant utiles à voir.
        return \Inertia\Inertia::render('StockArticleDetail', [
            'idImport' => null,
            'article' => $article,
            'nomFichier' => null,
            'titreStock' => null,
            'colonnes' => [],
            'colonneArticleKey' => null,
            'lignes' => [],
            'commandesLiees' => self::commandesLiees($article),
            'nonTrouveEnStock' => true,
            'mouvementsParHeure' => StockHistoriqueStore::parHeure($article),
            'mouvementsDetail' => StockHistoriqueStore::lignesArticle($article),
            'stockDerniereDate' => StockHistoriqueStore::stockDerniereDate($article),
        ]);
    }

    /**
     * Commandes portant sur ce même article — lien simple par nom d'article
     * (pas de vraie clé étrangère, les deux jeux de données n'ont jamais été
     * rapprochés avant), trim() pour tolérer un espace de saisie différent.
     */
    private static function commandesLiees(string $article): array
    {
        return collect(CommandeStore::toutes())
            ->filter(fn (array $c) => trim((string) ($c['Article'] ?? '')) === trim($article))
            ->values()
            ->all();
    }

    /**
     * Quantité en stock par article, d'après l'import le plus récent.
     * Conservée ici parce que tout le site l'appelle par ce nom ; le calcul
     * lui-même est dans StockStore.
     */
    public static function quantitesParArticle(): array
    {
        return StockStore::quantitesParArticle();
    }
}
