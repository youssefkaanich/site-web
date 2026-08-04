<?php

namespace App\Http\Controllers;

use App\Services\MouvementStore;
use App\Services\StockHistoriqueStore;
use App\Support\DateSopal;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Points d'accès du stock historique : import du fichier de mouvements et
 * calculs interrogés en JavaScript par la page Stock / Production.
 *
 * Il n'y a pas de page dédiée — une page qui n'aurait porté que deux boutons
 * d'import ne se justifiait pas. Le rendu est fait par StockController::page().
 */
class StockHistoriqueController extends Controller
{
    /** Les gros fichiers de mouvements dépassent la limite par défaut. */
    private const MEMOIRE = '1024M';

    /** Import du 2e fichier Excel (mouvements de stock). */
    public function importer(Request $request)
    {
        $request->validate([
            'fichier' => 'required|file|mimes:xlsx,xls',
        ]);

        ini_set('memory_limit', self::MEMOIRE);

        $dossierTmp = storage_path('app/stock_mouvements_tmp');
        if (!is_dir($dossierTmp)) {
            mkdir($dossierTmp, 0755, true);
        }

        $nomOriginal = $request->file('fichier')->getClientOriginalName();
        $chemin = $dossierTmp.'/'.uniqid('mvt_').'.'.$request->file('fichier')->getClientOriginalExtension();
        $request->file('fichier')->move($dossierTmp, basename($chemin));

        try {
            $resultat = MouvementStore::importer($chemin, $nomOriginal);

            if (!$resultat['ok']) {
                return response()->json(['erreur' => $resultat['erreur']], 422);
            }

            return response()->json($resultat['import']);
        } finally {
            @unlink($chemin);
        }
    }

    public function supprimer(string $id)
    {
        return MouvementStore::supprimer($id)
            ? response()->json(['ok' => true])
            : response()->json(['erreur' => "Cet import n'existe plus."], 404);
    }

    /** Vue 1 — stock d'un article à une date/heure précise. */
    public function article(Request $request)
    {
        $request->validate([
            'article' => 'required|string',
            'instant' => 'required|string',
        ]);

        [$contexte, $erreur] = $this->preparer($request);
        if ($erreur) {
            return $erreur;
        }

        $instant = $this->instant($request->query('instant'));
        if (!$instant) {
            return response()->json(['erreur' => "Date ou heure illisible."], 422);
        }

        if ($instant->lt($contexte['instantReference'])) {
            return response()->json([
                'erreur' => 'Cette date est ANTÉRIEURE à la photo de stock du '
                    .$contexte['instantReference']->format('d/m/Y à H:i:s')
                    .'. Le stock ne peut pas être reconstitué avant cette date.',
            ], 422);
        }

        return response()->json(
            StockHistoriqueStore::article($contexte, $request->query('article'), $instant)
            + ['instant' => DateSopal::pourAffichage($instant)]
        );
    }

    /** Vue 2 — évolution d'un article dans le temps. */
    public function evolution(Request $request)
    {
        $request->validate(['article' => 'required|string']);

        [$contexte, $erreur] = $this->preparer($request);
        if ($erreur) {
            return $erreur;
        }

        $jusqua = $request->query('jusqua') ? $this->instant($request->query('jusqua')) : null;
        $article = trim($request->query('article'));

        return response()->json([
            'article' => $article,
            'designation' => \App\Models\MouvementStock::where('Article', $article)->value('Designation'),
            'points' => StockHistoriqueStore::evolution($contexte, $article, $jusqua),
        ]);
    }

    /** Vue 3 — stock de tous les articles à une date/heure donnée. */
    public function tous(Request $request)
    {
        $request->validate(['instant' => 'required|string']);

        [$contexte, $erreur] = $this->preparer($request);
        if ($erreur) {
            return $erreur;
        }

        $instant = $this->instant($request->query('instant'));
        if (!$instant) {
            return response()->json(['erreur' => 'Date ou heure illisible.'], 422);
        }

        if ($instant->lt($contexte['instantReference'])) {
            return response()->json([
                'erreur' => 'Cette date est ANTÉRIEURE à la photo de stock du '
                    .$contexte['instantReference']->format('d/m/Y à H:i:s').'.',
            ], 422);
        }

        return response()->json([
            'instant' => DateSopal::pourAffichage($instant),
            'lignes' => StockHistoriqueStore::tous($contexte, $instant),
        ]);
    }

    /** Charge le contexte (les 2 fichiers) ou renvoie la réponse d'erreur toute prête. */
    private function preparer(Request $request): array
    {
        ini_set('memory_limit', self::MEMOIRE);

        $contexte = StockHistoriqueStore::contexte($request->query('mouvements'));

        return $contexte['ok']
            ? [$contexte, null]
            : [null, response()->json(['erreur' => $contexte['erreur']], 422)];
    }

    /** Lit l'instant envoyé par le formulaire (format natif du champ HTML : "2026-07-31T14:30"). */
    private function instant(?string $valeur): ?Carbon
    {
        if (!$valeur) {
            return null;
        }

        try {
            return Carbon::parse($valeur);
        } catch (\Throwable) {
            return null;
        }
    }
}
