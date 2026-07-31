<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Un service = une sortie de stock enregistrée pour une commande.
 *
 * Une commande peut en avoir plusieurs (service partiel : 200 aujourd'hui,
 * 300 plus tard). Le stock affiché est toujours RECALCULÉ à partir de ces
 * lignes (stock du fichier Excel − somme des services), jamais stocké : le
 * fichier importé n'est donc jamais modifié, et annuler un service revient
 * simplement à supprimer sa ligne.
 */
class Service extends Model
{
    protected $connection = 'mysql';

    protected $table = 'services';

    /** created_at sert d'horodatage du service ; pas de updated_at (une ligne n'est jamais modifiée). */
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = [
        'quantite' => 'float',
        'created_at' => 'datetime',
    ];
}
