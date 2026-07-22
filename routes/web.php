<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CommandeController;
use App\Http\Controllers\ExtractionController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/gestion', [CommandeController::class, 'index'])->name('gestion');
Route::post('/commandes', [CommandeController::class, 'store'])->name('commandes.store');
Route::put('/commandes/{commande}', [CommandeController::class, 'update'])->name('commandes.update');
Route::delete('/commandes/{commande}', [CommandeController::class, 'destroy'])->name('commandes.destroy');
Route::post('/commandes/supprimer-selection', [CommandeController::class, 'destroySelection'])->name('commandes.destroySelection');
Route::post('/commandes/vider-anciennes', [CommandeController::class, 'viderAnciennes'])->name('commandes.viderAnciennes');
Route::get('/commandes/export', [CommandeController::class, 'export'])->name('commandes.export');

Route::get('/corbeille', [CommandeController::class, 'corbeille'])->name('corbeille');
Route::post('/corbeille/{id}/restaurer', [CommandeController::class, 'restaurer'])->name('commandes.restaurer');
Route::post('/corbeille/restaurer-selection', [CommandeController::class, 'restaurerSelection'])->name('commandes.restaurerSelection');
Route::post('/corbeille/supprimer-selection', [CommandeController::class, 'supprimerSelection'])->name('commandes.supprimerSelection');

Route::post('/extraction/{source}/start', [ExtractionController::class, 'start'])->name('extraction.start');
Route::post('/extraction/{source}/stop', [ExtractionController::class, 'stop'])->name('extraction.stop');
