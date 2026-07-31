import { useState } from 'react';
import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import FiltreColonne, { valeursDistinctes } from '../Components/FiltreColonne';
import { IconCheck, IconClock, IconLoader } from '../Components/Icons';
import { toast } from '../hooks/toast';

/** Libellé des lignes sans émetteur dans le filtre (même convention que Gestion.jsx). */
const EMETTEUR_VIDE = '(non renseigné)';

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

/** Formate une date de service en "12/07 à 14:32". */
function dateService(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Saisie d'une quantité servie + historique des services de la ligne.
 *
 * Le plafond (stock disponible, reste à livrer) est aussi contrôlé côté
 * serveur : ici c'est uniquement pour éviter un aller-retour inutile et
 * afficher l'erreur tout de suite.
 */
function CelluleService({ ligne }) {
    const [quantite, setQuantite] = useState('');
    const [envoi, setEnvoi] = useState(false);
    const [historiqueOuvert, setHistoriqueOuvert] = useState(false);

    const reste = ligne.Reste_a_livrer === null || ligne.Reste_a_livrer === undefined
        ? null
        : Number(ligne.Reste_a_livrer);
    const maximum = reste === null ? ligne.qteStock : Math.min(reste, ligne.qteStock);

    function servir() {
        const valeur = Number(String(quantite).replace(',', '.'));

        if (!valeur || valeur <= 0) {
            toast('Saisis une quantité supérieure à 0.', 'error');
            return;
        }
        if (valeur > ligne.qteStock) {
            toast(`Stock insuffisant : ${ligne.qteStock} disponible(s) pour ${ligne.Article}.`, 'error');
            return;
        }
        if (reste !== null && valeur > reste) {
            toast(`Il ne reste que ${reste} à livrer sur cette commande.`, 'error');
            return;
        }

        setEnvoi(true);
        router.post(`/commandes/${ligne.id}/servir`, { quantite: valeur }, {
            preserveScroll: true,
            onSuccess: () => setQuantite(''),
            onFinish: () => setEnvoi(false),
        });
    }

    function annuler(serviceId) {
        router.delete(`/services/${serviceId}`, { preserveScroll: true });
    }

    function marquerServie() {
        router.post(`/commandes/${ligne.id}/marquer-servie`, {}, { preserveScroll: true });
    }

    return (
        <div className="min-w-[210px] space-y-1.5">
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={quantite}
                    onChange={(e) => setQuantite(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && servir()}
                    disabled={envoi || ligne.qteStock <= 0}
                    placeholder={ligne.qteStock <= 0 ? 'Stock épuisé' : `max ${maximum}`}
                    className="w-24 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0d2b52] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#0d2b52]/15 disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={servir}
                    disabled={envoi || ligne.qteStock <= 0}
                    title="Enregistrer cette sortie de stock"
                    className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {envoi ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : <IconCheck className="h-3.5 w-3.5" />}
                    Servir
                </button>
            </div>

            {/* Sans quantité demandée, "reste à livrer = 0" ne sera jamais
                atteint : seul ce bouton permet d'archiver la commande. */}
            {reste === null && (
                <button
                    type="button"
                    onClick={marquerServie}
                    className="text-[11px] font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                >
                    Marquer comme servie
                </button>
            )}

            {ligne.services.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setHistoriqueOuvert((v) => !v)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        <IconClock className="h-3 w-3" />
                        {ligne.totalServi} servi(s) · {ligne.services.length} sortie(s)
                    </button>

                    {historiqueOuvert && (
                        <ul className="mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                            {ligne.services.map((s) => (
                                <li key={s.id} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{s.quantite}</span>
                                    <span>le {dateService(s.date)}</span>
                                    {s.servi_par && <span className="text-gray-400">· {s.servi_par}</span>}
                                    <button
                                        type="button"
                                        onClick={() => annuler(s.id)}
                                        title="Annuler ce service (la quantité est restituée au stock)"
                                        className="ml-auto text-red-600 dark:text-red-400 hover:underline"
                                    >
                                        Annuler
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
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
    // Filtre par émetteur : liste vide = tous affichés.
    const [emetteurs, setEmetteurs] = useState([]);

    const lignesDuService = suivi.filter((s) => s.Job === service);

    // Émetteurs proposés, calculés AVANT le filtre : sinon la liste se
    // réduirait à mesure qu'on coche et on ne pourrait plus rien décocher.
    const emetteursDisponibles = valeursDistinctes(lignesDuService, 'Emetteur', EMETTEUR_VIDE);

    const lignes =
        emetteurs.length === 0
            ? lignesDuService
            : lignesDuService.filter((l) => emetteurs.includes((l.Emetteur || '').trim() || EMETTEUR_VIDE));

    // Changer de service remet le filtre à zéro : les émetteurs d'un service
    // n'ont aucune raison d'exister dans l'autre.
    function changerService(s) {
        setService(s);
        setEmetteurs([]);
    }

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
                            onClick={() => changerService(s)}
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
                            {['Article', 'Désignation', 'Émetteur', 'Qté demandée', 'Reste à livrer', 'Qté en rupture', 'Qté en stock', 'Plan de service', 'Servir'].map((label) => (
                                <th
                                    key={label}
                                    className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-y border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                >
                                    {label === 'Émetteur' ? (
                                        <FiltreColonne
                                            label={label}
                                            valeurs={emetteursDisponibles}
                                            selection={emetteurs}
                                            onChange={setEmetteurs}
                                        />
                                    ) : (
                                        label
                                    )}
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
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-right tabular-nums text-gray-900 dark:text-gray-200">
                                    {l.Reste_a_livrer ?? '—'}
                                </td>
                                <td
                                    className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-right tabular-nums ${
                                        Number(l.Qte_en_rupture) > 0
                                            ? 'text-red-600 dark:text-red-400 font-semibold'
                                            : 'text-gray-900 dark:text-gray-200'
                                    }`}
                                >
                                    {l.Qte_en_rupture ?? '—'}
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
                                <td className="px-4 py-2 border-l border-gray-100 dark:border-gray-800 align-top">
                                    <CelluleService ligne={l} />
                                </td>
                            </tr>
                        ))}
                        {lignes.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 dark:text-gray-600">
                                    {emetteurs.length > 0
                                        ? `Aucune commande ${service} pour cet émetteur.`
                                        : `Aucune commande ${service}.`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Analyse({ total = 0, urgentes = 0, suivi = [], stockSource = {} }) {
    return (
        <AppLayout
            title="Analyse"
            subtitle="Suivi des commandes confrontées au stock réel."
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

                    <TableauSuivi suivi={suivi} stockSource={stockSource} />
                </>
            )}
        </AppLayout>
    );
}
