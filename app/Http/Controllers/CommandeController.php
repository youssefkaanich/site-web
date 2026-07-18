<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use Illuminate\Http\Request;

class CommandeController extends Controller
{
    public function index()
    {
        return \Inertia\Inertia::render('Gestion', [
            'commandes' => Commande::orderByDesc('id')->get(),
            'extraction' => ExtractionController::statut(),
        ]);
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
        $commande->delete();

        return redirect()->route('gestion');
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
