<?php

namespace App\Http\Controllers;

use App\Services\CommandeStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CommandeController extends Controller
{
    /**
     * $service (injecté via Route::defaults, voir routes/web.php) : null pour
     * la vue globale (/commandes), "Export" ou "Commercial" pour les
     * sous-pages dédiées (/commandes/export, /commandes/commercial) — même
     * action, réutilisée pour les 3 routes, filtrée par la colonne `Job`.
     *
     * $groupeChamp / $groupeValeur (Export -> "Objet", Commercial -> "Emetteur") :
     * sous-sous-page par groupe, ex. /commandes/export/objet/Recap-Commande.
     * $groupeChamp est fixé via Route::defaults (comme $service), $groupeValeur
     * est le vrai paramètre d'URL. Filtré ici côté serveur (pas envoyé au
     * front puis filtré en JS) : la page ne reçoit que les commandes du
     * groupe demandé, et l'URL est partageable/navigable au clavier.
     */
    public function index(Request $request)
    {
        // Lus explicitement PAR NOM (Request::route()) plutôt que via des
        // paramètres de méthode : Laravel résout les arguments du contrôleur
        // par POSITION dans le tableau des paramètres de route (URI d'abord,
        // puis defaults() dans l'ordre d'appel), pas par nom -- avec 3
        // paramètres dont l'ordre varie selon la route (ex: {groupeValeur}
        // dans l'URI passe avant service/groupeChamp fixés par defaults()),
        // ça décalait silencieusement les valeurs d'un argument à l'autre.
        $service = $request->route('service');
        $categorie = $request->route('categorie');   // null | 'export' | 'chantier'
        $groupeChamp = $request->route('groupeChamp');
        $groupeValeur = $request->route('groupeValeur');

        $commandes = CommandeStore::toutes();

        // La page se recharge automatiquement toutes les 15-30s (voir
        // Gestion.jsx) : refaire le nettoyage des doublons à CHAQUE
        // rechargement scanne toute la table pour rien la plupart du temps.
        // Cache::add ne pose le verrou que s'il n'existe pas déjà -> ce bloc
        // ne tourne donc plus qu'une fois par minute max, quel que soit le
        // nombre de rechargements entre-temps.
        if (Cache::add('commandes:verrou_nettoyage', true, 60)) {
            $commandes = CommandeStore::nettoyerDoublons($commandes);
        }

        // Codes article invalides masqués (filtre d'affichage, rien n'est
        // supprimé en base) -- appliqué ici pour que les compteurs par groupe
        // calculés plus bas comptent la même chose que ce que le tableau
        // affiche réellement.
        $commandes = self::filtrerArticlesValides($commandes);

        // Compteurs des 2 sous-onglets de "Commande ferme", calculés sur la
        // liste COMPLÈTE (avant le filtre de vue) pour que chaque onglet
        // affiche son propre total quel que soit celui qui est actif.
        $sousOnglets = $service === 'Export'
            ? [
                'export' => count(array_filter($commandes, fn (array $c) => self::correspondACategorie($c, 'export'))),
                'chantier' => count(array_filter($commandes, fn (array $c) => self::correspondACategorie($c, 'chantier'))),
            ]
            : null;

        // Filtre de la vue courante AVANT l'envoi à React (pas juste côté
        // front) : la catégorie porte à la fois le service et le type de
        // commande (voir correspondACategorie).
        if ($categorie !== null) {
            $commandes = array_values(array_filter(
                $commandes,
                fn (array $c) => self::correspondACategorie($c, $categorie)
            ));
        }

        // Compteurs par groupe (valeurs distinctes de $groupeChamp), calculés
        // sur la liste déjà filtrée par service -- sert à afficher les boutons
        // de sous-navigation ("Grouper par ..."), toujours envoyés même sans
        // groupe sélectionné pour construire les liens.
        $groupes = [];
        if ($groupeChamp !== null) {
            $compteurs = [];
            foreach ($commandes as $c) {
                $valeur = trim((string) ($c[$groupeChamp] ?? '')) ?: '(non renseigné)';
                $compteurs[$valeur] = ($compteurs[$valeur] ?? 0) + 1;
            }
            arsort($compteurs);
            $groupes = collect($compteurs)
                ->map(fn ($nombre, $valeur) => ['valeur' => $valeur, 'nombre' => $nombre])
                ->values()
                ->all();

            if ($groupeValeur !== null) {
                $commandes = array_values(array_filter(
                    $commandes,
                    fn (array $c) => (trim((string) ($c[$groupeChamp] ?? '')) ?: '(non renseigné)') === $groupeValeur
                ));
            }
        }

        return \Inertia\Inertia::render('Gestion', [
            'commandes' => $commandes,
            'extraction' => ExtractionController::statut(),
            'service' => $service,
            'categorie' => $categorie,
            'sousOnglets' => $sousOnglets,
            'groupeChamp' => $groupeChamp,
            'groupeValeur' => $groupeValeur,
            'groupes' => $groupes,
        ]);
    }

    /**
     * Vrai si la commande relève du sous-onglet "Chantier" : le mot
     * "chantier" apparaît dans l'objet du mail OU dans le corps du mail
     * (insensible à la casse et aux accents).
     *
     * ATTENTION : règle reproduite à l'identique côté React dans
     * resources/js/utils/classificationCommande.js — toute modification ici
     * doit être reportée là-bas.
     */
    private static function estChantier(array $commande): bool
    {
        $contenu = ($commande['Objet'] ?? '').' '.($commande['Texte_Mail'] ?? '');

        // //u : traite la chaîne en UTF-8 (accents), //i : insensible à la casse
        return (bool) preg_match('/chantier/iu', $contenu);
    }

    /**
     * Périmètre de chaque vue. La catégorie porte à la fois le service et le
     * type de commande :
     *   'export'     -> tout le service Export
     *   'chantier'   -> les commandes Commercial parlant de chantier
     *   'commercial' -> les commandes Commercial hors chantier
     *
     * Les 3 vues sont exclusives et couvrent tout : une commande Export ne
     * part jamais dans Chantier.
     *
     * ATTENTION : règle reproduite à l'identique côté React dans
     * resources/js/utils/classificationCommande.js.
     */
    private static function correspondACategorie(array $c, ?string $categorie): bool
    {
        $job = $c['Job'] ?? null;

        return match ($categorie) {
            'export' => $job === 'Export',
            'chantier' => $job === 'Commercial' && self::estChantier($c),
            'commercial' => $job === 'Commercial' && !self::estChantier($c),
            default => true,
        };
    }

    /**
     * Ne garde que les commandes dont le code article est valide (un "A" en
     * 5e position), sauf celles extraites d'une image (OCR) qui passent
     * toujours.
     *
     * ATTENTION : règle reproduite à l'identique côté React dans
     * resources/js/utils/articleValidation.js — toute modification ici doit
     * être reportée là-bas (même principe que normaliserLabel(), dupliqué
     * entre basestock.py et StockController).
     */
    private static function filtrerArticlesValides(array $commandes): array
    {
        return array_values(array_filter($commandes, function (array $c) {
            if (($c['Source'] ?? null) === 'image-ocr') {
                return true;
            }

            $code = trim((string) ($c['Article'] ?? ''));

            return strlen($code) >= 5 && strtoupper($code[4]) === 'A';
        }));
    }

    public function store(Request $request)
    {
        CommandeStore::creer($this->validated($request));

        // back() plutôt qu'une route fixe : reste sur la vue d'où vient la
        // requête (Toutes/Export/Commercial, ou un groupe précis), au lieu de
        // toujours renvoyer vers /commandes.
        return redirect()->back();
    }

    public function update(Request $request, string $id)
    {
        CommandeStore::mettreAJour($id, $this->validated($request));

        return redirect()->back();
    }

    /** Envoie à la corbeille (récupérable) -- la suppression définitive se fait depuis la corbeille elle-même. */
    public function destroy(string $id)
    {
        CommandeStore::envoyerCorbeille($id);

        return redirect()->back();
    }

    /** Envoie à la corbeille plusieurs commandes sélectionnées. */
    public function destroySelection(Request $request)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer'])['ids'];

        CommandeStore::envoyerCorbeillePlusieurs($ids);

        return redirect()->back();
    }

    /**
     * Envoie à la corbeille les doublons de la vue courante (garde la
     * Date_mail la plus récente). Restreint au sous-onglet actif quand il est
     * précisé, pour ne jamais toucher l'autre sous-onglet sans le montrer.
     */
    public function supprimerDoublons(Request $request)
    {
        $categorie = $request->input('categorie'); // null | 'export' | 'chantier'

        $filtre = in_array($categorie, ['export', 'chantier', 'commercial'], true)
            ? fn (array $c) => self::correspondACategorie($c, $categorie)
            : null;

        // Le service n'est plus discriminant : la catégorie porte déjà le
        // périmètre complet (Chantier = des commandes Commercial).
        CommandeStore::supprimerDoublons(null, $filtre);

        return redirect()->back();
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
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer'])['ids'];

        CommandeStore::restaurerPlusieurs($ids);

        return redirect()->route('corbeille');
    }

    /** Supprime définitivement plusieurs commandes sélectionnées dans la corbeille. */
    public function supprimerSelection(Request $request)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer'])['ids'];

        CommandeStore::supprimerDefinitivementPlusieurs($ids);

        return redirect()->route('corbeille');
    }

    /** Tableau de bord : suivi des commandes Export/Commercial confrontées au stock réel. */
    public function analyse()
    {
        // Même filtre d'affichage que la page Commandes, pour que les deux
        // pages montrent exactement le même périmètre de commandes.
        $commandes = collect(self::filtrerArticlesValides(CommandeStore::toutes()));

        // Suivi Export/Commercial : chaque commande confrontée au stock réel
        // de son article (rapprochement par nom d'article, comme la fiche
        // article -- voir StockController::quantitesParArticle()).
        $stock = StockController::quantitesParArticle();

        $suivi = $commandes
            ->filter(fn (array $c) => in_array($c['Job'] ?? null, ['Export', 'Commercial'], true))
            ->map(function (array $c) use ($stock) {
                $article = trim((string) ($c['Article'] ?? ''));
                $enStock = $stock['quantites'][$article] ?? 0;
                $demandee = is_numeric($c['Qte_demandee'] ?? null) ? (float) $c['Qte_demandee'] : null;

                return [
                    'id' => $c['id'],
                    'Job' => $c['Job'],
                    'Article' => $c['Article'],
                    'Designation' => $c['Designation'],
                    'Emetteur' => $c['Emetteur'],
                    'Date_mail' => $c['Date_mail'],
                    'Urgent' => $c['Urgent'],
                    'Note' => $c['Note'],
                    'Qte_demandee' => $c['Qte_demandee'],
                    'Reste_a_livrer' => $c['Reste_a_livrer'],
                    'Qte_en_rupture' => $c['Qte_en_rupture'],
                    'qteStock' => $enStock,
                    'suffisant' => $demandee === null ? null : $enStock >= $demandee,
                ];
            })
            ->values();

        return \Inertia\Inertia::render('Analyse', [
            'total' => $commandes->count(),
            'urgentes' => $commandes->where('Urgent', 'OUI')->count(),
            'suivi' => $suivi,
            'stockSource' => [
                'nomFichier' => $stock['nomFichier'],
                'titreStock' => $stock['titreStock'],
            ],
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
            'Job' => 'Job',
            'Objet' => 'Objet',
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
            'Job' => 'nullable|string|max:255',
            'Objet' => 'nullable|string|max:255',
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
        ]);
    }
}
