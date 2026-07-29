<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Commande extends Model
{
    use SoftDeletes;

    /** Table stockée sur XAMPP (base "sopal"), pas la connexion par défaut du site (sqlite). */
    protected $connection = 'mysql';

    protected $table = 'commandes';

    public $timestamps = false;

    protected $guarded = [];
}
