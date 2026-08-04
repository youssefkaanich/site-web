<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Un import du fichier de mouvements : de quoi retrouver d'où viennent les
 * lignes et combien ont été écartées, sans avoir à rouvrir le fichier Excel.
 */
class MouvementImport extends Model
{
    protected $connection = 'mysql';

    protected $table = 'mouvements_imports';

    /** Identifiant textuel (uuid) et non auto-incrémenté. */
    public $incrementing = false;

    protected $keyType = 'string';

    /** Un import n'est jamais modifié : créé, ou supprimé. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'id', 'nom_fichier', 'titre', 'lignes_lues', 'mouvements', 'articles',
        'ecartes_article', 'ecartes_date', 'ecartes_quantite', 'ecartes_statut', 'debut', 'fin',
    ];

    protected $casts = [
        'debut' => 'datetime',
        'fin' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function lignes()
    {
        return $this->hasMany(MouvementStock::class, 'import_id');
    }
}
