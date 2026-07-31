import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import BadgeJob from '../Components/BadgeJob';
import { IconRestore, IconInbox } from '../Components/Icons';

/** Formate une date de service en "12/07 à 14:32". */
function dateService(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Commandes entièrement servies : archive consultable, avec le détail des
 * sorties de stock (dates + quantités) et deux façons de revenir en arrière.
 */
export default function CommandesServies({ commandes = [] }) {
    /** Annule une sortie : la quantité est restituée au stock et la commande repasse en cours. */
    function annulerService(serviceId) {
        router.delete(`/services/${serviceId}`, { preserveScroll: true });
    }

    /** Remet la commande dans la vue active sans toucher à son historique. */
    function reactiver(id) {
        router.post(`/commandes/${id}/reactiver`, {}, { preserveScroll: true });
    }

    return (
        <AppLayout
            title="Commandes servies"
            subtitle="Commandes entièrement servies depuis le stock — leur historique reste consultable et annulable."
        >
            {commandes.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-16 text-center">
                    <IconInbox className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">Aucune commande servie pour le moment.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        Les commandes apparaissent ici dès que la totalité de la quantité demandée a été servie.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {commandes.map((c) => (
                        <div
                            key={c.id}
                            className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <a
                                            href={`/stock-production/articles/${encodeURIComponent(c.Article || '')}`}
                                            className="font-mono font-bold text-[#0d2b52] dark:text-blue-300 hover:underline"
                                        >
                                            {c.Article || '(sans article)'}
                                        </a>
                                        {c.Job && <BadgeJob job={c.Job} />}
                                        {c.Qte_demandee && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Quantité demandée : <span className="font-semibold">{c.Qte_demandee}</span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{c.Designation || '—'}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {c.Emetteur || 'émetteur inconnu'}
                                        {c.Date_mail ? ` · mail du ${String(c.Date_mail).slice(0, 10)}` : ''}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => reactiver(c.id)}
                                    title="Remettre cette commande dans la vue active (l'historique est conservé)"
                                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                                >
                                    <IconRestore className="h-3.5 w-3.5" /> Remettre en cours
                                </button>
                            </div>

                            {c.services.length > 0 && (
                                <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                                        Historique des sorties de stock
                                    </p>
                                    <ul className="space-y-1.5">
                                        {c.services.map((s) => (
                                            <li
                                                key={s.id}
                                                className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                                            >
                                                <span className="font-semibold text-gray-900 dark:text-gray-200 tabular-nums">
                                                    {s.quantite}
                                                </span>
                                                <span>servi(s) le {dateService(s.date)}</span>
                                                {s.servi_par && <span className="text-gray-400">par {s.servi_par}</span>}
                                                <button
                                                    type="button"
                                                    onClick={() => annulerService(s.id)}
                                                    title="Annuler cette sortie : la quantité est restituée au stock"
                                                    className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                                                >
                                                    Annuler cette sortie
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}
