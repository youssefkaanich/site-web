<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Une entrée ou une sortie de stock, telle qu'elle figure dans l'export ERP.
 *
 * La quantité est DÉJÀ SIGNÉE dans le fichier (négatif = sortie, positif =
 * entrée) : on l'additionne telle quelle, quelle que soit la transaction.
 */
class MouvementStock extends Model
{
    /** Table stockée sur XAMPP (base "sopal_commandes"), pas la connexion sqlite du site. */
    protected $connection = 'mysql';

    protected $table = 'mouvements_stock';

    /** Les lignes sont insérées en masse à l'import et ne sont jamais modifiées ensuite. */
    public $timestamps = false;

    protected $fillable = [
        'import_id', 'Article', 'Designation', 'instant', 'date_imputation', 'quantite',
        'Transaction', 'Piece_origine', 'Emplacement',
    ];

    protected $casts = [
        'instant' => 'datetime',
        'date_imputation' => 'date',
        'quantite' => 'float',
    ];
}
