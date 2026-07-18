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

Route::post('/extraction/{source}/start', [ExtractionController::class, 'start'])->name('extraction.start');
Route::post('/extraction/{source}/stop', [ExtractionController::class, 'stop'])->name('extraction.stop');
