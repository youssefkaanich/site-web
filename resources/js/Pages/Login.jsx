import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';

const FONCTIONNALITES = [
    'Suivi des commandes en temps réel',
    'Extraction automatique (Gmail / Outlook)',
    'Statistiques et tendances (Analyse)',
    'Corbeille et restauration',
];

function IconeCheck() {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
            <circle cx="10" cy="10" r="9" className="fill-white/10" />
            <path d="M6 10.2l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconeEmail() {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 shrink-0">
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3.5 5.5l6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconeCadenas() {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 shrink-0">
            <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6.5 9V6.5a3.5 3.5 0 1 1 7 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

function IconeOeil({ barre }) {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 shrink-0">
            <path
                d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
            {barre && <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
        </svg>
    );
}

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        se_souvenir: false,
    });
    const [motDePasseVisible, setMotDePasseVisible] = useState(false);

    function submit(e) {
        e.preventDefault();
        post('/login');
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
            <Head title="Connexion" />

            {/* Halos décoratifs en arrière-plan */}
            <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#0d2b52]/10 dark:bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#0d2b52]/10 dark:bg-blue-500/10 blur-3xl" />

            <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex flex-col md:flex-row relative">
                {/* Panneau gauche : identité */}
                <div className="md:w-1/2 relative bg-[#0d2b52] dark:bg-gray-900 text-white p-8 md:p-10 flex flex-col overflow-hidden">
                    {/* Motif décoratif subtil */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                            backgroundSize: '18px 18px',
                        }}
                    />

                    <div className="relative inline-flex bg-white rounded-xl px-3 py-2 shadow-lg self-start">
                        <img src="/images/logo-sopal.png" alt="Sopal" className="h-9 w-auto" />
                    </div>

                    <h1 className="relative text-2xl md:text-[1.7rem] font-extrabold mt-8 leading-snug">
                        Suivi des commandes Sopal
                    </h1>
                    <p className="relative text-sm text-blue-100/70 mt-3 leading-relaxed">
                        Interface interne pour centraliser l'extraction, le suivi et l'analyse des
                        commandes clients.
                    </p>

                    <ul className="relative mt-8 space-y-3.5 text-sm font-semibold">
                        {FONCTIONNALITES.map((f) => (
                            <li key={f} className="flex items-center gap-2.5 text-blue-50">
                                <IconeCheck />
                                {f}
                            </li>
                        ))}
                    </ul>

                    <p className="relative text-xs text-blue-100/50 mt-auto pt-8">
                        Application SOPAL — Projet de stage
                    </p>
                </div>

                {/* Panneau droit : formulaire */}
                <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
                    <h2 className="text-2xl font-extrabold text-[#0d2b52] dark:text-white">Connexion</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-7">
                        Accède à ton espace avec ton compte.
                    </p>

                    <form onSubmit={submit} className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Email</label>
                            <div
                                className={`flex items-center gap-2 border rounded-lg px-3 py-2 transition focus-within:ring-2 focus-within:ring-[#0d2b52]/30 dark:bg-gray-800 ${
                                    errors.email
                                        ? 'border-red-400 dark:border-red-500'
                                        : 'border-gray-200 dark:border-gray-600 focus-within:border-[#0d2b52] dark:focus-within:border-blue-400'
                                }`}
                            >
                                <span className="text-gray-400 dark:text-gray-500">
                                    <IconeEmail />
                                </span>
                                <input
                                    type="email"
                                    autoFocus
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="Ex : admin@sopal.com"
                                    className="w-full text-sm bg-transparent outline-none dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                            {errors.email && (
                                <span className="text-xs text-red-600 dark:text-red-400">{errors.email}</span>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Mot de passe</label>
                            <div
                                className={`flex items-center gap-2 border rounded-lg px-3 py-2 transition focus-within:ring-2 focus-within:ring-[#0d2b52]/30 dark:bg-gray-800 ${
                                    errors.password
                                        ? 'border-red-400 dark:border-red-500'
                                        : 'border-gray-200 dark:border-gray-600 focus-within:border-[#0d2b52] dark:focus-within:border-blue-400'
                                }`}
                            >
                                <span className="text-gray-400 dark:text-gray-500">
                                    <IconeCadenas />
                                </span>
                                <input
                                    type={motDePasseVisible ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="Votre mot de passe"
                                    className="w-full text-sm bg-transparent outline-none dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMotDePasseVisible((v) => !v)}
                                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                                    tabIndex={-1}
                                >
                                    <IconeOeil barre={motDePasseVisible} />
                                </button>
                            </div>
                            {errors.password && (
                                <span className="text-xs text-red-600 dark:text-red-400">{errors.password}</span>
                            )}
                        </div>

                        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 select-none cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.se_souvenir}
                                onChange={(e) => setData('se_souvenir', e.target.checked)}
                                className="rounded border-gray-300 dark:border-gray-600"
                            />
                            Se souvenir de moi
                        </label>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 hover:shadow-lg hover:shadow-[#0d2b52]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {processing && (
                                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            )}
                            {processing ? 'Connexion…' : 'Se connecter'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
