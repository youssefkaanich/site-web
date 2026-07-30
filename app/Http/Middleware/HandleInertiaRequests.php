<?php

namespace App\Http\Middleware;

use App\Services\CommandeStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user()
                    ? ['name' => $request->user()->name, 'email' => $request->user()->email]
                    : null,
            ],
            // Badge "Corbeille" de la sidebar. Mis en cache 10s : la page
            // Commandes se recharge toute seule toutes les 15-30s, inutile de
            // refaire ce COUNT à chaque rechargement.
            'nombreCorbeille' => $request->user()
                ? Cache::remember('corbeille:nombre', 10, fn () => CommandeStore::nombreCorbeille())
                : 0,
            // Message flash affiché en toast (voir AppLayout.jsx) après une
            // redirection -- ex: article introuvable dans le stock actuel.
            'flash' => [
                'succes' => $request->session()->get('succes'),
                'erreur' => $request->session()->get('erreur'),
            ],
        ];
    }
}
