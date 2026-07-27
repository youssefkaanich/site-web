<?php

namespace App\Http\Controllers;

use App\Services\CommandeStore;
use Illuminate\Http\Request;

class CommandeController extends Controller
{
    public function index()
    {
        // Un seul chargement de la liste, puis nettoyage/vieillissement en
        // mémoire avec au plus 2 appels réseau groupés (au lieu d'un appel
        // Firestore par ligne à chaque affichage de la page).
        $commandes = CommandeStore::toutes();
        $commandes = CommandeStore::nettoyerDoublons($commandes);
        $commandes = CommandeStore::vieillirStatuts($commandes);

        return \Inertia\Inertia::render('Gestion', [
            'commandes' => $commandes,
            'extraction' => ExtractionController::statut(),
        ]);
    }

    public function store(Request $request)
    {
        CommandeStore::creer($this->validated($request));

        return redirect()->route('gestion');
    }

    public function update(Request $request, string $id)
    {
        CommandeStore::mettreAJour($id, $this->validated($request));

        return redirect()->route('gestion');
    }

    public function destroy(string $id)
    {
        CommandeStore::supprimerDefinitivement($id);

        return redirect()->route('gestion');
    }

    /** Supprime définitivement plusieurs commandes sélectionnées. */
    public function destroySelection(Request $request)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'string'])['ids'];

        CommandeStore::supprimerDefinitivementPlusieurs($ids);

        return redirect()->route('gestion');
    }

    /** Envoie à la corbeille (récupérable) toutes les commandes au statut "ancienne". */
    public function viderAnciennes()
    {
        $ids = collect(CommandeStore::toutes())
            ->filter(fn (array $c) => ($c['statut'] ?? null) === 'ancienne')
            ->pluck('id')
            ->all();

        CommandeStore::envoyerCorbeillePlusieurs($ids);

        return redirect()->route('gestion');
    }

    /** Affiche les commandes envoyées à la corbeille. */
    public function corbeille()
    {
        return \Inertia\Inertia::render('Corbeille', [
            'commandes' => CommandeStore::corbeille(),
        ]);
    }

    /** Restaure une commande depuis la corbeille. */
    public function restaurer(string $id)
    {
        CommandeStore::restaurer($id);

        return redirect()->route('corbeille');
    }

    /** Restaure plusieurs commandes sélectionnées dans la corbeille. */
    public function restaurerSelection(Request $request)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'string'])['ids'];

        CommandeStore::restaurerPlusieurs($ids);

        return redirect()->route('corbeille');
    }

    /** Supprime définitivement plusieurs commandes sélectionnées dans la corbeille. */
    public function supprimerSelection(Request $request)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'string'])['ids'];

        CommandeStore::supprimerDefinitivementPlusieurs($ids);

        return redirect()->route('corbeille');
    }

    /** Tableau de bord : statistiques et graphiques calculés à partir des commandes Firestore. */
    public function analyse()
    {
        $commandes = collect(CommandeStore::toutes());

        $parStatut = $commandes
            ->groupBy(fn (array $c) => $c['statut'] ?? 'Inconnu')
            ->map->count()
            ->sortDesc();

        $parSource = $commandes
            ->groupBy(fn (array $c) => $c['Source'] ?? 'Inconnu')
            ->map->count()
            ->sortDesc();

        $parJour = collect();
        for ($i = 13; $i >= 0; $i--) {
            $parJour[now()->subDays($i)->format('Y-m-d')] = 0;
        }
        foreach ($commandes as $c) {
            if (empty($c['Date_mail'])) {
                continue;
            }
            try {
                $jour = \Carbon\Carbon::parse($c['Date_mail'])->format('Y-m-d');
            } catch (\Exception $e) {
                continue;
            }
            if ($parJour->has($jour)) {
                $parJour[$jour] = $parJour[$jour] + 1;
            }
        }

        $topArticles = $commandes
            ->filter(fn (array $c) => !empty($c['Article']))
            ->groupBy('Article')
            ->map->count()
            ->sortDesc()
            ->take(5);

        $topDestinations = $commandes
            ->filter(fn (array $c) => !empty($c['Destination']))
            ->groupBy('Destination')
            ->map->count()
            ->sortDesc()
            ->take(5);

        return \Inertia\Inertia::render('Analyse', [
            'total' => $commandes->count(),
            'urgentes' => $commandes->where('Urgent', 'OUI')->count(),
            'parStatut' => $parStatut,
            'parSource' => $parSource,
            'parJour' => $parJour,
            'topArticles' => $topArticles,
            'topDestinations' => $topDestinations,
        ]);
    }

    /** Colonnes communes à l'export et à l'import Excel (champ Firestore -> libellé affiché). */
    private static function colonnesExcel(): array
    {
        return [
            'id' => 'ID',
            'Message_ID' => 'Message ID',
            'Date_mail' => 'Date mail',
            'Emetteur' => 'Émetteur',
            'Source' => 'Source',
            'Article' => 'Article',
            'Designation' => 'Désignation',
            'Qte_demandee' => 'Qté demandée',
            'Reste_a_livrer' => 'Reste à livrer',
            'Qte_en_rupture' => 'Qté en rupture',
            'Qte_allouee' => 'Qté allouée',
            'Qte_a_allouer' => 'Qté à allouer',
            'Site_exp' => 'Site exp.',
            'UV' => 'UV',
            'Destination' => 'Destination',
            'Echeance' => 'Échéance',
            'Echeance_date' => 'Date échéance',
            'Urgent' => 'Urgent',
            'Note' => 'Note',
            'statut' => 'Statut',
        ];
    }

    /**
     * Importe des commandes depuis un fichier Excel au même format que
     * "Exporter Excel". Une ligne dont la colonne ID correspond à une
     * commande existante la met à jour ; sinon une nouvelle commande est créée.
     */
    public function importer(Request $request)
    {
        $request->validate(['fichier' => 'required|file|mimes:xlsx,xls']);

        $labelVersChamp = array_flip(self::colonnesExcel());

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('fichier')->getRealPath());
        $lignes = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($lignes)) {
            return response()->json(['erreur' => 'Le fichier est vide.'], 422);
        }

        $entetes = array_map(fn ($e) => trim((string) $e), $lignes[0]);
        $champParColonne = [];
        foreach ($entetes as $i => $label) {
            if (isset($labelVersChamp[$label])) {
                $champParColonne[$i] = $labelVersChamp[$label];
            }
        }

        if (empty($champParColonne)) {
            return response()->json([
                'erreur' => 'Aucune colonne reconnue. Utilise le même format que le bouton "Exporter Excel".',
            ], 422);
        }

        $indexId = array_search('id', $champParColonne);
        $idsExistants = collect(CommandeStore::toutes())->pluck('id')->flip();

        $crees = 0;
        $misAJour = 0;

        foreach (array_slice($lignes, 1) as $ligne) {
            if (collect($ligne)->every(fn ($v) => $v === null || $v === '')) {
                continue; // ligne vide
            }

            $donnees = [];
            foreach ($champParColonne as $i => $champ) {
                if ($champ === 'id') {
                    continue;
                }
                $valeur = $ligne[$i] ?? null;
                $donnees[$champ] = ($valeur === '' ? null : $valeur);
            }

            $idBrut = $indexId !== false ? trim((string) ($ligne[$indexId] ?? '')) : '';

            if ($idBrut !== '' && $idsExistants->has($idBrut)) {
                CommandeStore::mettreAJour($idBrut, $donnees);
                $misAJour++;
            } else {
                CommandeStore::creer($donnees);
                $crees++;
            }
        }

        return response()->json(['crees' => $crees, 'misAJour' => $misAJour]);
    }

    /** Télécharge toutes les commandes en vrai fichier Excel (.xlsx). */
    public function export()
    {
        $colonnes = self::colonnesExcel();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $feuille = $spreadsheet->getActiveSheet();
        $feuille->setTitle('Commandes');

        $feuille->fromArray(array_values($colonnes), null, 'A1');
        $feuille->getStyle('A1:'.\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($colonnes)).'1')
            ->getFont()->setBold(true);

        $ligne = 2;
        foreach (CommandeStore::toutes() as $commande) {
            $valeurs = [];
            foreach (array_keys($colonnes) as $champ) {
                $valeurs[] = $commande[$champ] ?? null;
            }
            $feuille->fromArray($valeurs, null, 'A'.$ligne);
            $ligne++;
        }

        foreach (range('A', \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($colonnes))) as $colonne) {
            $feuille->getColumnDimension($colonne)->setAutoSize(true);
        }

        $nomFichier = 'commandes_sopal_'.now()->format('Y-m-d_His').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save('php://output');
        }, $nomFichier, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'Message_ID' => 'nullable|string|max:255',
            'Date_mail' => 'nullable|string|max:255',
            'Emetteur' => 'nullable|string|max:255',
            'Source' => 'nullable|string|max:255',
            'Article' => 'nullable|string|max:255',
            'Designation' => 'nullable|string|max:255',
            'Qte_demandee' => 'nullable|numeric',
            'Reste_a_livrer' => 'nullable|numeric',
            'Qte_en_rupture' => 'nullable|numeric',
            'Qte_allouee' => 'nullable|numeric',
            'Qte_a_allouer' => 'nullable|numeric',
            'Site_exp' => 'nullable|string|max:255',
            'UV' => 'nullable|string|max:255',
            'Destination' => 'nullable|string|max:255',
            'Echeance' => 'nullable|string|max:255',
            'Echeance_date' => 'nullable|string|max:255',
            'Urgent' => 'nullable|string|max:10',
            'Note' => 'nullable|string',
            'statut' => 'nullable|string|max:255',
        ]);
    }
}
