import { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import Toaster from '../Components/Toaster';
import { IconSun, IconMoon, IconPower } from '../Components/Icons';
import { toast } from '../hooks/toast';

/** Lien de navigation : pastille blanche pleine quand actif, badge rouge optionnel à droite. */
function NavLink({ href, label, active, icon, badge = null }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm transition-all duration-200 active:scale-[0.98] ${
                active
                    ? 'bg-white text-[#0d2b52] font-bold shadow-md'
                    : 'text-blue-50/90 font-semibold hover:bg-white/10 hover:text-white'
            }`}
        >
            {icon}
            <span className="flex-1 truncate">{label}</span>
            {badge !== null && badge > 0 && (
                <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                    {badge}
                </span>
            )}
        </Link>
    );
}

/** Icône façon "Corbeille" de Bureau Windows : panier blanc + symbole recyclage bleu. */
function IconeCorbeille() {
    return (
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M6.2 8.2 7.6 20.4a1 1 0 0 0 1 .9h6.8a1 1 0 0 0 1-.9l1.4-12.2Z"
                fill="#f4f4f5"
                stroke="#a3a3a3"
                strokeWidth="0.9"
                strokeLinejoin="round"
            />
            <path d="M4.5 8.2h15" stroke="#a3a3a3" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M9.3 10.6 9.9 18.8M14.7 10.6 14.1 18.8" stroke="#d4d4d8" strokeWidth="0.6" strokeLinecap="round" />
            <g transform="translate(12 13.5)">
                {[0, 120, 240].map((deg) => (
                    <path
                        key={deg}
                        transform={`rotate(${deg})`}
                        d="M0 -3.6 A3.6 3.6 0 0 1 3.1 -1.8 L4.4 -2.5 L4.9 0.2 L2.1 -0.4 L3.4 -1.2 A2.2 2.2 0 0 0 0 -2.4Z"
                        fill="#2563eb"
                    />
                ))}
            </g>
        </svg>
    );
}

function BoutonModeSombre() {
    const [sombre, setSombre] = useState(() => document.documentElement.classList.contains('dark'));

    useEffect(() => {
        document.documentElement.classList.toggle('dark', sombre);
        localStorage.setItem('sopal-theme', sombre ? 'dark' : 'light');
    }, [sombre]);

    return (
        <button
            type="button"
            onClick={() => setSombre((v) => !v)}
            className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition"
        >
            <span className="flex items-center gap-2">
                {sombre ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                <span>Mode Sombre</span>
            </span>
            <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    sombre ? 'bg-blue-400' : 'bg-white/25'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        sombre ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                />
            </span>
        </button>
    );
}

export default function AppLayout({ title, titleSuffix = null, subtitle, children }) {
    // URL courante pour surligner le lien actif dans la sidebar
    const { url, props } = usePage();
    const utilisateur = props.auth?.user;

    // Sidebar auto-masquée : se replie quand la souris s'en va, réapparaît en
    // approchant le bord gauche de l'écran (pas besoin de cliquer sur rien).
    const [sidebarOuverte, setSidebarOuverte] = useState(true);

    // Message flash (redirect()->with('erreur'/'succes', ...) côté Laravel,
    // voir HandleInertiaRequests::share()) affiché en toast une seule fois
    // par visite -- ex: article introuvable dans le stock actuel.
    useEffect(() => {
        if (props.flash?.erreur) toast(props.flash.erreur, 'error');
        if (props.flash?.succes) toast(props.flash.succes, 'success');
    }, [props.flash?.erreur, props.flash?.succes]);

    function deconnexion() {
        router.post('/logout');
    }

    return (
        <div className="h-screen overflow-hidden bg-gray-100 dark:bg-gray-950 transition-colors">
            <Head title={titleSuffix ? `${title} — ${titleSuffix.texte}` : title} />

            <div className="flex h-screen">
                {/* Sidebar bleu marine, couleur unie + fine bordure (style sobre) — se replie
                    automatiquement quand la souris s'en va, réapparaît près du bord gauche.
                    h-screen (pas min-h-screen) : reste plaquée à la hauteur de l'écran et ne
                    défile JAMAIS avec le contenu, quelle que soit la position du scroll. */}
                <aside
                    onMouseLeave={() => setSidebarOuverte(false)}
                    className={`shrink-0 h-screen bg-[#0d2b52] dark:bg-gray-900 text-white flex flex-col border-r border-black/10 dark:border-white/5 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${
                        sidebarOuverte ? 'w-64' : 'w-0 border-r-0'
                    }`}
                >
                    {/* Carte logo + intitulé de l'outil */}
                    <div className="w-64 px-4 pt-4">
                        <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
                            <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex justify-center">
                                <img src="/images/logo-sopal.png" alt="Sopal" className="h-10 w-auto" />
                            </div>
                            <p className="text-[13px] leading-snug text-blue-100/70 mt-3">
                                Interface de suivi des commandes et du stock
                            </p>
                        </div>
                    </div>

                    {/* Carte utilisateur + bascule mode sombre */}
                    <div className="w-64 px-4 pt-3">
                        <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
                            <p className="font-bold text-white leading-tight truncate">
                                {utilisateur?.name || 'Utilisateur'}
                            </p>
                            <p className="text-[13px] text-blue-100/70 truncate mt-0.5">{utilisateur?.email}</p>
                            <div className="mt-3">
                                <BoutonModeSombre />
                            </div>
                        </div>
                    </div>

                    <nav className="w-64 flex-1 px-4 pt-5 pb-3 space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-300/80 px-1 pb-1.5">
                            Navigation
                        </p>
                        <NavLink href="/commandes" label="Commandes" active={url.startsWith('/commandes')} />
                        <NavLink href="/stock-production" label="Stock / Production" active={url.startsWith('/stock-production')} />
                        <NavLink href="/analyse" label="Analyse" active={url.startsWith('/analyse')} />
                        <NavLink
                            href="/commandes-servies"
                            label="Commandes servies"
                            active={url.startsWith('/commandes-servies')}
                        />
                        <NavLink
                            href="/corbeille"
                            label="Corbeille"
                            icon={<IconeCorbeille />}
                            active={url.startsWith('/corbeille')}
                            badge={props.nombreCorbeille ?? 0}
                        />
                    </nav>

                    <div className="w-64 px-4 pb-4">
                        <button
                            type="button"
                            onClick={deconnexion}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] hover:bg-white/15 px-4 py-2.5 text-sm font-semibold text-blue-50/90 hover:text-white transition"
                        >
                            <IconPower className="h-4 w-4" /> Se déconnecter
                        </button>
                    </div>
                </aside>

                {!sidebarOuverte && (
                    <>
                        {/* Zone invisible sur le bord gauche : approcher la souris ici rouvre le menu */}
                        <div
                            onMouseEnter={() => setSidebarOuverte(true)}
                            className="fixed top-0 left-0 h-full w-3 z-20"
                        />
                        <div className="fixed top-5 left-2 z-10 h-9 w-9 flex items-center justify-center rounded-lg bg-[#0d2b52]/70 dark:bg-gray-900/70 text-white/70 pointer-events-none">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                                <path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </>
                )}

                {/* Contenu principal : défile verticalement de façon INDÉPENDANTE de la
                    sidebar (overflow-y-auto ici, h-screen sur le parent) ; pas de
                    overflow-x ici -- le scroll horizontal est géré uniquement par le
                    conteneur du tableau (voir Gestion.jsx), pour ne jamais avoir deux
                    barres de défilement horizontal imbriquées qui se marchent dessus. */}
                <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
                    <header className={`px-8 pt-8 pb-4 ${sidebarOuverte ? '' : 'pl-16'}`}>
                        <h1 className="text-2xl font-extrabold text-[#0d2b52] dark:text-white">
                            {title}
                            {titleSuffix && (
                                <span className={`ml-2 text-xl font-semibold ${titleSuffix.classe}`}>
                                    — {titleSuffix.texte}
                                </span>
                            )}
                        </h1>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </header>

                    <div className="px-8 pb-10">{children}</div>
                </main>
            </div>

            <Toaster />
        </div>
    );
}
