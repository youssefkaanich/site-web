import { useState } from 'react';
import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import { toast } from '../hooks/toast';

// Palette catégorielle validée (voir skill dataviz) : ordre fixe, jamais permuté.
const PALETTE = [
    'bg-[#2a78d6] dark:bg-[#3987e5]', // 1 bleu
    'bg-[#eb6834] dark:bg-[#d95926]', // 2 orange
    'bg-[#1baf7a] dark:bg-[#199e70]', // 3 aqua
    'bg-[#eda100] dark:bg-[#c98500]', // 4 jaune
    'bg-[#e87ba4] dark:bg-[#d55181]', // 5 magenta
];

const ETIQUETTES_SOURCE = { tableau: 'Tableau', texte: 'Texte libre', 'image-ocr': 'Image (OCR)' };

function CarteStat({ label, value, accent }) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`text-4xl font-extrabold mt-2 ${accent ? 'text-red-600 dark:text-red-400' : 'text-[#0d2b52] dark:text-white'}`}>
                {value}
            </p>
        </div>
    );
}

function GraphiqueBarresHorizontal({ titre, donnees }) {
    const max = Math.max(...donnees.map((d) => d.value), 1);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">{titre}</p>
            <div className="space-y-3">
                {donnees.map((d) => (
                    <div key={d.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300 truncate">
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${d.couleur}`} />
                                <span className="truncate">{d.label}</span>
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white tabular-nums shrink-0 ml-2">
                                {d.value}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${d.couleur}`}
                                style={{ width: `${Math.max((d.value / max) * 100, 4)}%` }}
                            />
                        </div>
                    </div>
                ))}
                {donnees.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-600">Aucune donnée.</p>
                )}
            </div>
        </div>
    );
}

function GraphiqueJournalier({ parJour }) {
    const entrees = Object.entries(parJour);
    const max = Math.max(...entrees.map(([, v]) => v), 1);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">
                Commandes des 14 derniers jours
            </p>
            <div className="flex items-end gap-1.5 h-36">
                {entrees.map(([date, count]) => {
                    const hauteur = count > 0 ? Math.max((count / max) * 100, 6) : 2;
                    const libelle = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                    });
                    return (
                        <div key={date} className="flex-1 flex flex-col items-center justify-end h-full">
                            <div
                                title={`${libelle} : ${count} commande(s)`}
                                className="w-full max-w-[18px] rounded-t bg-[#2a78d6] dark:bg-[#3987e5] hover:opacity-80 transition-all cursor-default"
                                style={{ height: `${hauteur}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-1.5 mt-2 border-t border-gray-100 dark:border-gray-800 pt-1.5">
                {entrees.map(([date], i) => (
                    <div key={date} className="flex-1 text-center text-[10px] text-gray-400 dark:text-gray-600">
                        {i % 2 === 0 ? new Date(date + 'T00:00:00').getDate() : ''}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Suivi Export/Commercial : pour chaque commande, l'article, la quantité
 * demandée, la quantité réellement en stock (rapprochement par nom d'article,
 * voir StockController::quantitesParArticle()) et une note libre où le
 * responsable indique comment il compte servir la commande.
 */
function TableauSuivi({ suivi, stockSource }) {
    const [service, setService] = useState('Export');
    const [notes, setNotes] = useState({});
    const [enregistrement, setEnregistrement] = useState(null);

    const lignes = suivi.filter((s) => s.Job === service);

    function enregistrerNote(ligne) {
        const valeur = notes[ligne.id];
        if (valeur === undefined || valeur === (ligne.Note ?? '')) return;

        setEnregistrement(ligne.id);
        router.put(`/commandes/${ligne.id}`, { Note: valeur }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => toast('Note enregistrée.'),
            onFinish: () => setEnregistrement(null),
        });
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-semibold text-[#0d2b52] dark:text-white">Suivi des commandes et du stock</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {stockSource?.nomFichier
                            ? `Stock : ${stockSource.nomFichier}${stockSource.titreStock ? ` · ${stockSource.titreStock}` : ''}`
                            : 'Aucun import de stock disponible — les quantités en stock sont à 0.'}
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {['Export', 'Commercial'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setService(s)}
                            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                                service === s
                                    ? `bg-white dark:bg-gray-900 shadow-sm ${
                                          s === 'Export'
                                              ? 'text-blue-700 dark:text-blue-400'
                                              : 'text-[#7a2331] dark:text-[#e8b4bc]'
                                      }`
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            {s} ({suivi.filter((x) => x.Job === s).length})
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400">
                            {['Article', 'Désignation', 'Émetteur', 'Qté demandée', 'Qté en stock', 'Comment servir cette commande'].map((label) => (
                                <th
                                    key={label}
                                    className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-y border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lignes.map((l, index) => (
                            <tr
                                key={l.id}
                                className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                                    index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                }`}
                            >
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800">
                                    {l.Article ? (
                                        <a
                                            href={`/stock-production/articles/${encodeURIComponent(l.Article)}`}
                                            className="font-mono font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                                        >
                                            {l.Article}
                                        </a>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">
                                    {l.Designation || '—'}
                                </td>
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">
                                    {l.Emetteur || '—'}
                                </td>
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-right tabular-nums text-gray-900 dark:text-gray-200">
                                    {l.Qte_demandee ?? '—'}
                                </td>
                                <td
                                    className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-right tabular-nums font-semibold ${
                                        l.suffisant === false
                                            ? 'text-red-600 dark:text-red-400'
                                            : l.suffisant === true
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-gray-900 dark:text-gray-200'
                                    }`}
                                    title={
                                        l.suffisant === false
                                            ? 'Stock insuffisant pour cette commande'
                                            : l.suffisant === true
                                                ? 'Stock suffisant'
                                                : 'Quantité demandée inconnue — comparaison impossible'
                                    }
                                >
                                    {l.qteStock}
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="text"
                                        value={notes[l.id] ?? l.Note ?? ''}
                                        onChange={(e) => setNotes((n) => ({ ...n, [l.id]: e.target.value }))}
                                        onBlur={() => enregistrerNote(l)}
                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                        disabled={enregistrement === l.id}
                                        placeholder="Ex : servir 50 depuis C1, reste en production…"
                                        className="w-full min-w-[240px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0d2b52] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#0d2b52]/15 disabled:opacity-50"
                                    />
                                </td>
                            </tr>
                        ))}
                        {lignes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-gray-600">
                                    Aucune commande {service}.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Analyse({
    total = 0,
    urgentes = 0,
    parSource = {},
    parJour = {},
    topArticles = {},
    topDestinations = {},
    suivi = [],
    stockSource = {},
}) {
    const donneesSource = Object.entries(parSource).map(([cle, valeur], i) => ({
        label: ETIQUETTES_SOURCE[cle] || cle,
        value: valeur,
        couleur: PALETTE[i % PALETTE.length],
    }));

    const donneesArticles = Object.entries(topArticles).map(([cle, valeur]) => ({
        label: cle,
        value: valeur,
        couleur: PALETTE[0],
    }));

    const donneesDestinations = Object.entries(topDestinations).map(([cle, valeur]) => ({
        label: cle,
        value: valeur,
        couleur: PALETTE[1],
    }));

    return (
        <AppLayout
            title="Analyse"
            subtitle="Statistiques et tendances calculées à partir des commandes en base."
        >
            {total === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-16 text-center text-gray-400 dark:text-gray-600">
                    Aucune commande en base pour le moment — reviens ici une fois des commandes extraites.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                        <CarteStat label="Total commandes" value={total} />
                        <CarteStat label="Urgentes" value={urgentes} accent />
                    </div>

                    <div className="mb-5">
                        <GraphiqueBarresHorizontal titre="Commandes par source" donnees={donneesSource} />
                    </div>

                    <div className="mb-5">
                        <GraphiqueJournalier parJour={parJour} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                        <GraphiqueBarresHorizontal titre="Top 5 articles les plus demandés" donnees={donneesArticles} />
                        <GraphiqueBarresHorizontal titre="Top 5 destinations" donnees={donneesDestinations} />
                    </div>

                    <TableauSuivi suivi={suivi} stockSource={stockSource} />
                </>
            )}
        </AppLayout>
    );
}
