<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne du fichier de stock = un article à un emplacement donné.
 *
 * Les champs métier sont de vraies colonnes (indexables) ; `donnees` conserve
 * la ligne complète du fichier pour l'affichage du tableau, qui doit pouvoir
 * montrer n'importe quelle colonne de l'export.
 */
class StockLigne extends Model
{
    protected $connection = 'mysql';

    protected $table = 'stock_lignes';

    public $timestamps = false;

    protected $fillable = [
        'import_id', 'Article', 'Designation', 'Quantite',
        'Emplacement', 'Statut', 'donnees',
    ];

    protected $casts = [
        'donnees' => 'array',
        'Quantite' => 'float',
    ];
}
