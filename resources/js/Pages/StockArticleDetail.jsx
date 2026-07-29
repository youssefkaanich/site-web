import { useState } from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import { IconChevronLeft, IconInbox } from '../Components/Icons';
import { trouverColonne } from '../utils/colonnesStock';

const ONGLETS = [
    { key: 'infos', label: 'Infos générales' },
    { key: 'emplacements', label: 'Emplacements' },
    { key: 'commandes', label: 'Commandes liées' },
];

export default function StockArticleDetail({ idImport, article, nomFichier, titreStock, colonnes, colonneArticleKey, lignes }) {
    const [ongletActif, setOngletActif] = useState('infos');

    const colonneDesignation = trouverColonne(colonnes, 'designation');
    const colonneQte = trouverColonne(colonnes, 'qte') || trouverColonne(colonnes, 'quantite');

    const designation = colonneDesignation ? lignes[0]?.[colonneDesignation.key] : null;
    const quantiteTotale = colonneQte
        ? lignes.reduce((total, ligne) => total + (Number(ligne[colonneQte.key]) || 0), 0)
        : null;

    // Colonnes affichées dans l'onglet "Emplacements" : tout sauf le code article (déjà dans le titre).
    const colonnesEmplacements = colonnes.filter((c) => c.key !== colonneArticleKey);

    // "Détails" (infos générales) ne doit montrer que les infos identiques sur
    // TOUS les emplacements (ex: désignation) — pas une valeur d'un seul
    // emplacement (ex: quantité, statut) présentée comme si elle concernait
    // tout l'article.
    const colonnesCommunes = colonnesEmplacements.filter((col) => {
        const premiere = lignes[0]?.[col.key] ?? '';
        return lignes.every((ligne) => (ligne[col.key] ?? '') === premiere);
    });

    return (
        <AppLayout title={`Article ${article}`} subtitle={designation || undefined}>
            <Link
                href={`/stock-production?import=${idImport}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline mb-5"
            >
                <IconChevronLeft className="h-4 w-4" /> Retour à Stock / Production
            </Link>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5 mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Article</p>
                <p className="text-2xl font-extrabold text-[#0d2b52] dark:text-white mt-1">{article}</p>
                {designation && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{designation}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
                    Source : {nomFichier} {titreStock ? `· ${titreStock}` : ''}
                </p>
            </div>

            {/* Onglets */}
            <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-800">
                {ONGLETS.map((onglet) => (
                    <button
                        key={onglet.key}
                        onClick={() => setOngletActif(onglet.key)}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                            ongletActif === onglet.key
                                ? 'border-[#0d2b52] text-[#0d2b52] dark:border-blue-400 dark:text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {onglet.label}
                    </button>
                ))}
            </div>

            {/* Onglet : Infos générales */}
            {ongletActif === 'infos' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Emplacements</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{lignes.length}</p>
                    </div>
                    {quantiteTotale !== null && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Quantité totale</p>
                            <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{quantiteTotale}</p>
                        </div>
                    )}
                    {colonnesCommunes.length > 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm sm:col-span-3">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Détails</p>
                            <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">
                                Informations identiques sur tous les emplacements. Le détail par emplacement est dans l'onglet "Emplacements".
                            </p>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                {colonnesCommunes.map((col) => (
                                    <div key={col.key} className="flex justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                                        <dt className="text-gray-500 dark:text-gray-400">{col.label}</dt>
                                        <dd className="text-gray-900 dark:text-gray-200 font-semibold text-right truncate">
                                            {lignes[0]?.[col.key] || '—'}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            )}

            {/* Onglet : Emplacements */}
            {ongletActif === 'emplacements' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                    {colonnesEmplacements.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                                                col.numeric ? 'text-right' : 'text-left'
                                            }`}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lignes.map((ligne, index) => (
                                    <tr
                                        key={ligne._id ?? index}
                                        className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                            index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        {colonnesEmplacements.map((col) => (
                                            <td
                                                key={col.key}
                                                className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200 ${
                                                    col.numeric ? 'text-right tabular-nums' : ''
                                                }`}
                                            >
                                                {ligne[col.key] === '' || ligne[col.key] == null ? '—' : String(ligne[col.key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Onglet : Commandes liées (vide, pour plus tard) */}
            {ongletActif === 'commandes' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-16 text-center">
                    <IconInbox className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">Pas encore de commandes liées à cet article.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Cette section sera complétée plus tard.</p>
                </div>
            )}
        </AppLayout>
    );
}
