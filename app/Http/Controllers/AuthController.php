<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Affiche la page de connexion. */
    public function create()
    {
        return \Inertia\Inertia::render('Login');
    }

    /** Traite la tentative de connexion. */
    public function store(Request $request)
    {
        $identifiants = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($identifiants, $request->boolean('se_souvenir'))) {
            throw ValidationException::withMessages([
                'email' => 'Email ou mot de passe incorrect.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended('/commandes');
    }

    /** Déconnecte l'utilisateur. */
    public function destroy(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
