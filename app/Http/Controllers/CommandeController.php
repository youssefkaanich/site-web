<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommandeController extends Controller
{
    public function index()
    {
        if (self::supprimerDoublons() > 0) {
            self::renumeroterIds();
        }

        self::vieillirStatuts();

        return \Inertia\Inertia::render('Gestion', [
            'commandes' => Commande::orderByDesc('id')->get(),
            'extraction' => ExtractionController::statut(),
        ]);
    }

    /**
     * Supprime les lignes exactement en double (même mail, même article,
     * même désignation, même quantité, même source) : ça arrive si un
     * script d'extraction traite deux fois le même mail. On garde la plus
     * ancienne occurrence (id le plus petit). Retourne le nombre supprimé.
     */
    private static function supprimerDoublons(): int
    {
        return DB::delete("
            DELETE c1 FROM commandes c1
            INNER JOIN commandes c2
            ON c1.Message_ID <=> c2.Message_ID
            AND c1.Article <=> c2.Article
            AND c1.Designation <=> c2.Designation
            AND c1.Qte_demandee <=> c2.Qte_demandee
            AND c1.Source <=> c2.Source
            AND c1.id > c2.id
            WHERE c1.deleted_at IS NULL AND c2.deleted_at IS NULL
        ");
    }

    /**
     * Renumérote les id de 1 à N (dans l'ordre chronologique existant),
     * pour qu'il n'y ait jamais de trou après une suppression.
     */
    private static function renumeroterIds(): void
    {
        DB::statement('SET @n := 0');
        DB::statement('UPDATE commandes SET id = (@n := @n + 1) ORDER BY id ASC');
        DB::statement('ALTER TABLE commandes AUTO_INCREMENT = 1');
    }

    /**
     * Passe une commande de "nouvelle" à "ancienne" dès que son mail
     * d'origine (Date_mail) a plus de 2 jours.
     */
    private static function vieillirStatuts(): void
    {
        $limite = now()->subDays(2);

        Commande::where('statut', 'nouvelle')
            ->whereNotNull('Date_mail')
            ->get()
            ->each(function (Commande $commande) use ($limite) {
                try {
                    $date = \Carbon\Carbon::parse($commande->Date_mail);
                } catch (\Exception $e) {
                    return;
                }

                if ($date->lt($limite)) {
                    $commande->update(['statut' => 'ancienne']);
                }
            });
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        Commande::create($data);

        return redirect()->route('gestion');
    }

    public function update(Request $request, Commande $commande)
    {
        $data = $this->validated($request);

        $commande->update($data);

        return redirect()->route('gestion');
    }

    public function destroy(Commande $commande)
    {
        $commande->forceDelete();
        self::renumeroterIds();

        return redirect()->route('gestion');
    }

    /** Envoie à la corbeille (récupérable) toutes les commandes au statut "ancienne". */
    public function viderAnciennes()
    {
        Commande::where('statut', 'ancienne')->delete();

        return redirect()->route('gestion');
    }

    /** Affiche les commandes envoyées à la corbeille. */
    public function corbeille()
    {
        return \Inertia\Inertia::render('Corbeille', [
            'commandes' => Commande::onlyTrashed()->orderByDesc('deleted_at')->get(),
        ]);
    }

    /** Restaure une commande depuis la corbeille. */
    public function restaurer(int $id)
    {
        Commande::onlyTrashed()->findOrFail($id)->restore();

        return redirect()->route('corbeille');
    }

    /** Télécharge toutes les commandes en vrai fichier Excel (.xlsx). */
    public function export()
    {
        $colonnes = [
            'id' => 'ID',
            'Message_ID' => 'Message ID',
            'Date_mail' => 'Date mail',
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

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $feuille = $spreadsheet->getActiveSheet();
        $feuille->setTitle('Commandes');

        $feuille->fromArray(array_values($colonnes), null, 'A1');
        $feuille->getStyle('A1:'.\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($colonnes)).'1')
            ->getFont()->setBold(true);

        $ligne = 2;
        Commande::orderBy('id')->chunk(200, function ($commandes) use ($feuille, $colonnes, &$ligne) {
            foreach ($commandes as $commande) {
                $valeurs = [];
                foreach (array_keys($colonnes) as $champ) {
                    $valeurs[] = $commande->{$champ};
                }
                $feuille->fromArray($valeurs, null, 'A'.$ligne);
                $ligne++;
            }
        });

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
