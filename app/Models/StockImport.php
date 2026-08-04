<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Un import du fichier de stock (photo du stock à un instant donné). */
class StockImport extends Model
{
    protected $connection = 'mysql';

    protected $table = 'stock_imports';

    public $incrementing = false;

    protected $keyType = 'string';

    /** Un import n'est jamais modifié : créé, ou supprimé. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'id', 'nom_fichier', 'titre_stock', 'instant_reference',
        'colonnes', 'lignes_lues', 'lignes_gardees',
    ];

    protected $casts = [
        'colonnes' => 'array',
        'instant_reference' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function lignes()
    {
        return $this->hasMany(StockLigne::class, 'import_id');
    }
}
