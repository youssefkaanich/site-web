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
    function restaurer(c) {
        router.post(`/corbeille/${c.id}/restaurer`, {}, { preserveScroll: true });
    }

    return (
        <AppLayout
            title="Corbeille"
            subtitle="Commandes envoyées à la corbeille — tu peux les restaurer à tout moment."
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
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
                            <tr key={c.id} className="border-b dark:border-gray-800 last:border-0 hover:bg-blue-50/40 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200">
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
                                    colSpan={COLONNES_AFFICHEES.length + 1}
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
