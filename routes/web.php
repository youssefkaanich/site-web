<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommandeController;
use App\Http\Controllers\ExtractionController;
use App\Http\Controllers\StockController;

Route::redirect('/', '/commandes');

Route::get('/login', [AuthController::class, 'create'])->name('login')->middleware('guest');
Route::post('/login', [AuthController::class, 'store'])->middleware('guest');
Route::post('/logout', [AuthController::class, 'destroy'])->name('logout')->middleware('auth');

Route::middleware('auth')->group(function () {
    Route::get('/commandes', [CommandeController::class, 'index'])->name('gestion');
    // "Commande ferme" (libellé affiché) = service Export en base, subdivisé
    // en 2 sous-onglets exclusifs : export (commande ferme classique) et
    // chantier (mot "chantier" dans l'objet ou le corps du mail).
    Route::get('/commandes/export', [CommandeController::class, 'index'])->name('gestion.export')
        ->defaults('service', 'Export')
        ->defaults('categorie', 'export')
        ->defaults('groupeChamp', 'Objet');
    Route::get('/commandes/export/objet/{groupeValeur}', [CommandeController::class, 'index'])
        ->where('groupeValeur', '[^/]+')
        ->name('gestion.export.groupe')
        ->defaults('service', 'Export')
        ->defaults('categorie', 'export')
        ->defaults('groupeChamp', 'Objet');
    // Chantier porte des commandes Commercial : groupées par émetteur, comme
    // la vue Commercial (et non par objet comme le reste de Commande ferme).
    Route::get('/commandes/export/chantier', [CommandeController::class, 'index'])->name('gestion.chantier')
        ->defaults('service', 'Export')
        ->defaults('categorie', 'chantier')
        ->defaults('groupeChamp', 'Emetteur');
    Route::get('/commandes/export/chantier/emetteur/{groupeValeur}', [CommandeController::class, 'index'])
        ->where('groupeValeur', '[^/]+')
        ->name('gestion.chantier.groupe')
        ->defaults('service', 'Export')
        ->defaults('categorie', 'chantier')
        ->defaults('groupeChamp', 'Emetteur');
    Route::post('/commandes/export/supprimer-doublons', [CommandeController::class, 'supprimerDoublons'])
        ->name('commandes.supprimerDoublons')
        ->defaults('service', 'Export');
    // Commercial = uniquement les commandes Commercial HORS chantier (celles
    // qui parlent de chantier sont dans Commande ferme > Chantier).
    Route::get('/commandes/commercial', [CommandeController::class, 'index'])->name('gestion.commercial')
        ->defaults('service', 'Commercial')
        ->defaults('categorie', 'commercial')
        ->defaults('groupeChamp', 'Emetteur');
    Route::get('/commandes/commercial/emetteur/{groupeValeur}', [CommandeController::class, 'index'])
        ->where('groupeValeur', '[^/]+')
        ->name('gestion.commercial.groupe')
        ->defaults('service', 'Commercial')
        ->defaults('categorie', 'commercial')
        ->defaults('groupeChamp', 'Emetteur');
    Route::get('/stock-production', [StockController::class, 'page'])->name('stockProduction');
    Route::post('/stock-production/importer', [StockController::class, 'importer'])->name('stockProduction.importer');
    Route::get('/stock-production/historique', [StockController::class, 'historique'])->name('stockProduction.historique');
    Route::get('/stock-production/historique/{id}', [StockController::class, 'charger'])->name('stockProduction.charger');
    Route::delete('/stock-production/historique/{id}', [StockController::class, 'supprimerHistorique'])->name('stockProduction.supprimerHistorique');
    Route::get('/stock-production/articles/{article}', [StockController::class, 'articleDernier'])
        ->where('article', '[^/]+')
        ->name('stockProduction.articleDernier');
    Route::get('/stock-production/{id}/articles/{article}', [StockController::class, 'article'])
        ->where('article', '[^/]+')
        ->name('stockProduction.article');
    Route::get('/analyse', [CommandeController::class, 'analyse'])->name('analyse');

    // Anciennes URL (avant renommage) : redirigent vers les nouvelles pour ne pas casser les favoris/liens.
    Route::redirect('/gestion', '/commandes');
    Route::post('/commandes', [CommandeController::class, 'store'])->name('commandes.store');
    Route::post('/commandes/importer', [CommandeController::class, 'importer'])->name('commandes.importer');
    Route::put('/commandes/{id}', [CommandeController::class, 'update'])->name('commandes.update');
    Route::delete('/commandes/{id}', [CommandeController::class, 'destroy'])->name('commandes.destroy');
    Route::post('/commandes/supprimer-selection', [CommandeController::class, 'destroySelection'])->name('commandes.destroySelection');
    // Renommé (pas "/commandes/export" : ça désigne maintenant la vue "service Export", voir plus haut).
    Route::get('/commandes/exporter-excel', [CommandeController::class, 'export'])->name('commandes.export');

    Route::get('/corbeille', [CommandeController::class, 'corbeille'])->name('corbeille');
    Route::post('/corbeille/{id}/restaurer', [CommandeController::class, 'restaurer'])->name('commandes.restaurer');
    Route::post('/corbeille/restaurer-selection', [CommandeController::class, 'restaurerSelection'])->name('commandes.restaurerSelection');
    Route::post('/corbeille/supprimer-selection', [CommandeController::class, 'supprimerSelection'])->name('commandes.supprimerSelection');

    Route::post('/extraction/{source}/start', [ExtractionController::class, 'start'])->name('extraction.start');
    Route::post('/extraction/{source}/stop', [ExtractionController::class, 'stop'])->name('extraction.stop');
});
