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

export default function AppLayout({ title, subtitle, children }) {
    // URL courante pour surligner le lien actif dans la sidebar
    const { url } = usePage();

    return (
        <div className="min-h-screen bg-gray-100">
            <Head title={title} />

            <div className="flex min-h-screen">
                {/* Sidebar bleu marine */}
                <aside className="w-64 shrink-0 bg-[#0d2b52] text-white flex flex-col">
                    <div className="px-6 py-6 border-b border-white/10">
                        <span className="text-2xl font-extrabold tracking-wide">SOPAL</span>
                        <p className="text-xs text-blue-100/60 mt-1">Suivi des commandes</p>
                    </div>

                    <nav className="flex-1 px-3 py-5 space-y-1">
                        <NavLink href="/gestion" label="Gestion" active={url.startsWith('/gestion')} />
                        <NavLink href="/analyse" label="Analyse" active={url.startsWith('/analyse')} />
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
                        <h1 className="text-2xl font-extrabold text-[#0d2b52]">{title}</h1>
                        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                    </header>

                    <div className="px-8 pb-10">{children}</div>
                </main>
            </div>
        </div>
    );
}
