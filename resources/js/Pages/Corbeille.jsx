import { useState } from 'react';
import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';

const COLONNES_AFFICHEES = [
    { key: 'Article', label: 'Article' },
    { key: 'Designation', label: 'Désignation' },
    { key: 'Qte_demandee', label: 'Qté demandée' },
    { key: 'Destination', label: 'Destination' },
    { key: 'Date_mail', label: 'Date mail' },
    { key: 'statut', label: 'Statut' },
];

export default function Corbeille({ commandes = [] }) {
    const [selection, setSelection] = useState([]); // liste des id cochés

    const touteSelectionnee = commandes.length > 0 && selection.length === commandes.length;

    function basculerTout() {
        setSelection(touteSelectionnee ? [] : commandes.map((c) => c.id));
    }

    function basculerUne(id) {
        setSelection((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
    }

    function restaurer(c) {
        router.post(`/corbeille/${c.id}/restaurer`, {}, { preserveScroll: true });
    }

    function restaurerSelection() {
        router.post(
            '/corbeille/restaurer-selection',
            { ids: selection },
            { preserveScroll: true, onSuccess: () => setSelection([]) }
        );
    }

    function supprimerSelection() {
        if (
            confirm(
                `Supprimer définitivement ${selection.length} commande(s) ? Cette action est irréversible.`
            )
        ) {
            router.post(
                '/corbeille/supprimer-selection',
                { ids: selection },
                { preserveScroll: true, onSuccess: () => setSelection([]) }
            );
        }
    }

    return (
        <AppLayout
            title="Corbeille"
            subtitle="Commandes envoyées à la corbeille — tu peux les restaurer à tout moment."
        >
            {selection.length > 0 && (
                <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-[#0d2b52] dark:text-blue-300">
                        {selection.length} commande(s) sélectionnée(s)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={restaurerSelection}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                        >
                            ♻️ Restaurer la sélection
                        </button>
                        <button
                            onClick={supprimerSelection}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                        >
                            🗑️ Supprimer définitivement
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                            <th className="px-4 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={touteSelectionnee}
                                    onChange={basculerTout}
                                    className="rounded border-gray-300 dark:border-gray-600"
                                />
                            </th>
                            {COLONNES_AFFICHEES.map((col) => (
                                <th key={col.key} className="px-4 py-3 font-semibold">
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commandes.map((c) => (
                            <tr
                                key={c.id}
                                className={`border-b dark:border-gray-800 last:border-0 hover:bg-blue-50/40 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 ${
                                    selection.includes(c.id) ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''
                                }`}
                            >
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selection.includes(c.id)}
                                        onChange={() => basculerUne(c.id)}
                                        className="rounded border-gray-300 dark:border-gray-600"
                                    />
                                </td>
                                {COLONNES_AFFICHEES.map((col) => (
                                    <td key={col.key} className="px-4 py-3">
                                        {c[col.key] ?? '—'}
                                    </td>
                                ))}
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => restaurer(c)}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                                    >
                                        ♻️ Restaurer
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {commandes.length === 0 && (
                            <tr>
                                <td
                                    colSpan={COLONNES_AFFICHEES.length + 2}
                                    className="px-4 py-8 text-center text-gray-400 dark:text-gray-600"
                                >
                                    La corbeille est vide.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    );
}
