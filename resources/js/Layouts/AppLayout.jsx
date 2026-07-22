import { useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';

function NavLink({ href, label, active }) {
    return (
        <Link
            href={href}
            className={`relative block rounded-lg pl-4 pr-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                active
                    ? 'bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                    : 'text-blue-100/70 hover:bg-white/8 hover:text-white'
            }`}
        >
            {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            )}
            {label}
        </Link>
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
                <span>{sombre ? '☀️' : '🌙'}</span>
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

export default function AppLayout({ title, subtitle, children }) {
    // URL courante pour surligner le lien actif dans la sidebar
    const { url } = usePage();

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors">
            <Head title={title} />

            <div className="flex min-h-screen">
                {/* Sidebar bleu marine, couleur unie + fine bordure (style sobre) */}
                <aside className="w-64 shrink-0 bg-[#0d2b52] dark:bg-gray-900 text-white flex flex-col border-r border-black/10 dark:border-white/5">
                    <div className="px-5 pt-5 pb-4 border-b border-white/10">
                        <div className="inline-flex bg-white rounded-xl px-3 py-2 shadow-sm">
                            <img src="/images/logo-sopal.png" alt="Sopal" className="h-11 w-auto" />
                        </div>
                        <p className="text-xs text-blue-100/60 mt-2.5">Suivi des commandes</p>
                    </div>

                    <nav className="flex-1 px-3 py-5 space-y-1">
                        <div className="pb-2 mb-1 border-b border-white/10">
                            <BoutonModeSombre />
                        </div>
                        <NavLink href="/commandes" label="Commandes" active={url.startsWith('/commandes')} />
                        <NavLink href="/stock-production" label="Stock / Production" active={url.startsWith('/stock-production')} />
                        <NavLink href="/analyse" label="Analyse" active={url.startsWith('/analyse')} />
                        <NavLink href="/corbeille" label="🗑️ Corbeille" active={url.startsWith('/corbeille')} />
                    </nav>

                    <div className="px-4 py-4 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">
                                A
                            </div>
                            <div className="text-sm">
                                <p className="font-semibold leading-tight">Admin</p>
                                <p className="text-xs text-blue-100/60">Administrateur</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Contenu principal */}
                <main className="flex-1 overflow-x-auto">
                    <header className="px-8 pt-8 pb-4">
                        <h1 className="text-2xl font-extrabold text-[#0d2b52] dark:text-white">{title}</h1>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </header>

                    <div className="px-8 pb-10">{children}</div>
                </main>
            </div>
        </div>
    );
}
