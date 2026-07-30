
import { useState } from 'react';
import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import ConfirmDialog from '../Components/ConfirmDialog';
import BadgeJob from '../Components/BadgeJob';
import { IconRestore, IconTrash, IconGrid, IconGlobe, IconBriefcase } from '../Components/Icons';
import { toast } from '../hooks/toast';

const COLONNES_AFFICHEES = [
    { key: 'Article', label: 'Article' },
    { key: 'Designation', label: 'Désignation' },
    { key: 'Qte_demandee', label: 'Qté demandée' },
    { key: 'Destination', label: 'Destination' },
    { key: 'Date_mail', label: 'Date mail' },
    { key: 'Emetteur', label: 'Émetteur' },
];

// Même code couleur que Gestion.jsx (bleu Export / bordeaux Commercial),
// pour que la corbeille reste lisible d'un coup d'œil sans avoir à lire
// la colonne Job de chaque ligne une par une.
const ONGLETS_SERVICE = [
    { service: null, label: 'Toutes', Icone: IconGrid, couleur: 'text-[#0d2b52] dark:text-white' },
    { service: 'Export', label: 'Export', Icone: IconGlobe, couleur: 'text-blue-700 dark:text-blue-400' },
    { service: 'Commercial', label: 'Commercial', Icone: IconBriefcase, couleur: 'text-[#7a2331] dark:text-[#e8b4bc]' },
];

const BORDURE_JOB = {
    Export: 'border-l-4 border-l-blue-400 dark:border-l-blue-500',
    Commercial: 'border-l-4 border-l-[#7a2331]/60 dark:border-l-[#e8b4bc]/60',
};

export default function Corbeille({ commandes = [] }) {
    const [selection, setSelection] = useState([]); // liste des id cochés
    const [confirmation, setConfirmation] = useState(null); // { message, onConfirm } | null
    const [service, setService] = useState(null); // null | 'Export' | 'Commercial'

    const commandesAffichees = service === null ? commandes : commandes.filter((c) => c.Job === service);

    const touteSelectionnee =
        commandesAffichees.length > 0 && commandesAffichees.every((c) => selection.includes(c.id));

    function basculerTout() {
        if (touteSelectionnee) {
            setSelection((sel) => sel.filter((id) => !commandesAffichees.some((c) => c.id === id)));
        } else {
            setSelection((sel) => [...new Set([...sel, ...commandesAffichees.map((c) => c.id)])]);
        }
    }

    function basculerUne(id) {
        setSelection((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
    }

    function restaurer(c) {
        router.post(`/corbeille/${c.id}/restaurer`, {}, {
            preserveScroll: true,
            onSuccess: () => toast('Commande restaurée.'),
        });
    }

    function restaurerSelection() {
        router.post(
            '/corbeille/restaurer-selection',
            { ids: selection },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelection([]);
                    toast('Commande(s) restaurée(s).');
                },
            }
        );
    }

    function supprimerSelection() {
        setConfirmation({
            message: `Supprimer définitivement ${selection.length} commande(s) ? Cette action est irréversible.`,
            // Ici la suppression est DÉFINITIVE (pas de filet de sécurité
            // derrière) : on demande de recopier le nombre dès 10 lignes.
            saisieAttendue: selection.length > 10 ? selection.length : null,
            onConfirm: () => {
                setConfirmation(null);
                router.post(
                    '/corbeille/supprimer-selection',
                    { ids: selection },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            setSelection([]);
                            toast('Commande(s) supprimée(s) définitivement.');
                        },
                    }
                );
            },
        });
    }

    return (
        <AppLayout
            title="Corbeille"
            subtitle="Commandes envoyées à la corbeille — tu peux les restaurer à tout moment."
        >
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit mb-6">
                {ONGLETS_SERVICE.map((o) => {
                    const actif = service === o.service;
                    const Icone = o.Icone;
                    const nombre = o.service === null ? commandes.length : commandes.filter((c) => c.Job === o.service).length;
                    return (
                        <button
                            key={o.label}
                            onClick={() => setService(o.service)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                                actif
                                    ? `bg-white dark:bg-gray-900 shadow-sm ${o.couleur}`
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <Icone className="h-4 w-4 shrink-0" />
                            {o.label} ({nombre})
                        </button>
                    );
                })}
            </div>

            {selection.length > 0 && (
                <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-[#0d2b52] dark:text-blue-300">
                        {selection.length} commande(s) sélectionnée(s)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={restaurerSelection}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                        >
                            <IconRestore className="h-3.5 w-3.5" /> Restaurer la sélection
                        </button>
                        <button
                            onClick={supprimerSelection}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                        >
                            <IconTrash className="h-3.5 w-3.5" /> Supprimer définitivement
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
                            <th className="px-4 py-3 font-semibold">Job</th>
                            {COLONNES_AFFICHEES.map((col) => (
                                <th key={col.key} className="px-4 py-3 font-semibold">
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commandesAffichees.map((c) => (
                            <tr
                                key={c.id}
                                className={`border-b dark:border-gray-800 last:border-0 hover:bg-blue-50/40 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 ${
                                    BORDURE_JOB[c.Job] || ''
                                } ${selection.includes(c.id) ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
                            >
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selection.includes(c.id)}
                                        onChange={() => basculerUne(c.id)}
                                        className="rounded border-gray-300 dark:border-gray-600"
                                    />
                                </td>
                                <td className="px-4 py-3">{c.Job ? <BadgeJob job={c.Job} /> : '—'}</td>
                                {COLONNES_AFFICHEES.map((col) => (
                                    <td key={col.key} className="px-4 py-3">
                                        {c[col.key] ?? '—'}
                                    </td>
                                ))}
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => restaurer(c)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                                    >
                                        <IconRestore className="h-3.5 w-3.5" /> Restaurer
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {commandesAffichees.length === 0 && (
                            <tr>
                                <td
                                    colSpan={COLONNES_AFFICHEES.length + 3}
                                    className="px-4 py-8 text-center text-gray-400 dark:text-gray-600"
                                >
                                    {service === null ? 'La corbeille est vide.' : `Aucune commande ${service} dans la corbeille.`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <ConfirmDialog
                open={Boolean(confirmation)}
                message={confirmation?.message}
                danger
                saisieAttendue={confirmation?.saisieAttendue ?? null}
                onConfirm={confirmation?.onConfirm}
                onCancel={() => setConfirmation(null)}
            />
        </AppLayout>
    );
}
