import { useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';

function NavLink({ href, label, active }) {
    return (
        <Link
            href={href}
            className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                active
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
            }`}
        >
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
            title={sombre ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-white/10 text-sm text-blue-100/80 hover:bg-white/20 hover:text-white transition"
        >
            {sombre ? '☀️' : '🌙'}
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
                {/* Sidebar bleu marine */}
                <aside className="w-64 shrink-0 bg-[#0d2b52] dark:bg-gray-900 text-white flex flex-col">
                    <div className="relative px-5 pt-5 pb-4 border-b border-white/10">
                        <div className="absolute top-5 right-5">
                            <BoutonModeSombre />
                        </div>
                        <div className="inline-flex bg-white rounded-xl px-3 py-2 shadow-sm">
                            <img src="/images/logo-sopal.png" alt="Sopal" className="h-11 w-auto" />
                        </div>
                        <p className="text-xs text-blue-100/60 mt-2.5">Suivi des commandes</p>
                    </div>

                    <nav className="flex-1 px-3 py-5 space-y-1">
                        <NavLink href="/gestion" label="Gestion" active={url.startsWith('/gestion')} />
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
