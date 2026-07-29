import { useEffect, useRef, useState } from 'react';
import { useForm, router, Link } from '@inertiajs/react';
import axios from 'axios';
import AppLayout from '../Layouts/AppLayout';
import ConfirmDialog from '../Components/ConfirmDialog';
import BadgeJob from '../Components/BadgeJob';
import {
    IconGrid,
    IconGlobe,
    IconBriefcase,
    IconTrash,
    IconLayers,
    IconColumns,
    IconLoader,
    IconDownload,
    IconUpload,
    IconClipboard,
    IconImage,
    IconFileText,
    IconTerminal,
} from '../Components/Icons';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { toast } from '../hooks/toast';

const COLUMNS = [
    { key: 'Message_ID', label: 'Message ID', width: 220 },
    { key: 'Date_mail', label: 'Date mail', width: 170 },
    { key: 'Emetteur', label: 'Émetteur', width: 140 },
    { key: 'Job', label: 'Job', width: 110 },
    { key: 'Objet', label: 'Objet', width: 200 },
    { key: 'Source', label: 'Source', width: 90 },
    { key: 'Article', label: 'Article', width: 110 },
    { key: 'Designation', label: 'Désignation', width: 180 },
    { key: 'Qte_demandee', label: 'Qté demandée', width: 110, numeric: true },
    { key: 'Reste_a_livrer', label: 'Reste à livrer', width: 110, numeric: true },
    { key: 'Qte_en_rupture', label: 'Qté en rupture', width: 110, numeric: true },
    { key: 'Qte_allouee', label: 'Qté allouée', width: 110, numeric: true },
    { key: 'Qte_a_allouer', label: 'Qté à allouer', width: 110, numeric: true },
    { key: 'Destination', label: 'Destination', width: 130 },
    { key: 'Urgent', label: 'Urgent', width: 90 },
    { key: 'Note', label: 'Note', width: 160 },
    { key: 'statut', label: 'Statut', width: 100 },
];

const ACTIONS_WIDTH = 150;

// Colonnes affichées par défaut (les autres restent disponibles via "Colonnes ▾")
// pour ne pas surcharger le tableau visuellement dès l'ouverture de la page.
const COLONNES_PAR_DEFAUT = ['Date_mail', 'Emetteur', 'Job', 'Article', 'Designation', 'Qte_demandee', 'Destination', 'Urgent', 'statut'];
const CLE_COLONNES_VISIBLES = 'sopal-commandes-colonnes-visibles';

const EMPTY_FORM = {
    Message_ID: '',
    Date_mail: '',
    Emetteur: '',
    Job: '',
    Objet: '',
    Source: '',
    Article: '',
    Designation: '',
    Qte_demandee: '',
    Reste_a_livrer: '',
    Qte_en_rupture: '',
    Qte_allouee: '',
    Qte_a_allouer: '',
    Site_exp: '',
    UV: '',
    Destination: '',
    Echeance: '',
    Echeance_date: '',
    Urgent: '',
    Note: '',
    statut: '',
};

function gmailSearchUrl(messageId) {
    const clean = messageId.replace(/^<|>$/g, '');
    return `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(clean)}`;
}

// Outlook (bureau) n'a pas d'URL de recherche comme Gmail : les Message-ID
// Gmail contiennent toujours "gmail.com", ceux venant d'Outlook/Exchange non
// -> on distingue les deux pour proposer le bon moyen de retrouver le mail.
function estMessageIdGmail(messageId) {
    return messageId.toLowerCase().includes('gmail.com');
}

function copierMessageId(messageId) {
    navigator.clipboard
        .writeText(messageId)
        .then(() => toast(`ID copié ! Colle « messageid:${messageId.replace(/^<|>$/g, '')} » dans la recherche Outlook.`))
        .catch(() => toast("Impossible de copier l'ID.", 'error'));
}

/** Convertit Date_mail en timestamp comparable. Ce champ vient soit de Gmail
 * (en-tête RFC 2822 : "Tue, 29 Jul 2026 14:32:00 +0200", que new Date() sait
 * lire directement) soit d'Outlook (str(datetime) Python : "2026-07-29
 * 14:32:00+02:00", format quasi-ISO mais avec un espace au lieu du "T", que
 * new Date() ne reconnaît pas toujours) -- d'où le remplacement ciblé de cet
 * espace avant de tenter le parsing. Retourne NaN si la date est vide/invalide. */
function horodatageMail(commande) {
    const brut = commande.Date_mail;
    if (!brut) return NaN;
    const valeur = /^\d{4}-\d{2}-\d{2} /.test(brut) ? brut.replace(' ', 'T') : brut;
    return new Date(valeur).getTime();
}

/** Regroupe par Émetteur + Article (une commande = un couple émetteur/article
 * ici), ne garde que la ligne avec la date la PLUS RÉCENTE de chaque groupe.
 * Départage (dates égales, ou l'une des deux manquante/invalide) : on garde
 * le plus petit id (la commande insérée en premier en base). Purement un
 * affichage (rien n'est supprimé en base) -- indépendant d'une sous-page à
 * l'autre puisqu'il s'applique à la liste déjà filtrée par service. */
function masquerLesDoublons(liste) {
    const parGroupe = new Map();
    for (const c of liste) {
        const cle = `${c.Emetteur || ''}|${c.Article || ''}`;
        const actuel = parGroupe.get(cle);
        if (!actuel) {
            parGroupe.set(cle, c);
            continue;
        }
        const tActuel = horodatageMail(actuel);
        const tC = horodatageMail(c);
        let garderC;
        if (tC === tActuel) {
            garderC = c.id < actuel.id;
        } else if (Number.isNaN(tActuel)) {
            garderC = !Number.isNaN(tC);
        } else if (Number.isNaN(tC)) {
            garderC = false;
        } else {
            garderC = tC > tActuel;
        }
        if (garderC) parGroupe.set(cle, c);
    }
    return [...parGroupe.values()];
}

// Code couleur des vues par service (repris pour le menu ET le suffixe du
// titre, voir SUFFIXES_TITRE plus bas) : bleu pour Export, bordeaux pour
// Commercial -- sobre, pas de couleurs "app grand public".
const COULEUR_EXPORT = 'text-blue-700 dark:text-blue-400';
const COULEUR_COMMERCIAL = 'text-[#7a2331] dark:text-[#e8b4bc]';
const COULEUR_TOUTES = 'text-[#0d2b52] dark:text-white';

const VUES_SERVICE = [
    { service: null, label: 'Toutes', href: '/commandes', Icone: IconGrid, couleur: COULEUR_TOUTES },
    { service: 'Export', label: 'Export', href: '/commandes/export', Icone: IconGlobe, couleur: COULEUR_EXPORT },
    { service: 'Commercial', label: 'Commercial', href: '/commandes/commercial', Icone: IconBriefcase, couleur: COULEUR_COMMERCIAL },
];

/** Suffixe du titre ("Gestion des commandes — Export"), même code couleur que les onglets. */
const SUFFIXES_TITRE = {
    Export: { texte: 'Export', classe: COULEUR_EXPORT },
    Commercial: { texte: 'Commercial', classe: COULEUR_COMMERCIAL },
};

/** Navigation entre les 3 vues (Toutes / Export / Commercial) : chaque
 * onglet est une vraie page (filtrée côté serveur), pas un filtre client. */
function MenuService({ service }) {
    return (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit mb-6">
            {VUES_SERVICE.map((vue) => {
                const actif = service === vue.service;
                const Icone = vue.Icone;
                return (
                    <Link
                        key={vue.label}
                        href={vue.href}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                            actif
                                ? `bg-white dark:bg-gray-900 shadow-sm ${vue.couleur}`
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Icone className="h-4 w-4 shrink-0" />
                        {vue.label}
                    </Link>
                );
            })}
        </div>
    );
}

function StatCard({ label, value, note, accent = false, active = false, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm transition ring-2 ${
                active ? 'ring-[#0d2b52] dark:ring-blue-400' : 'ring-transparent hover:ring-gray-200 dark:hover:ring-gray-700'
            }`}
        >
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`text-4xl font-extrabold mt-2 ${accent ? 'text-red-600 dark:text-red-400' : 'text-[#0d2b52] dark:text-white'}`}>
                {value}
            </p>
            {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{note}</p>}
        </button>
    );
}

function CommandeModal({ commande, onClose }) {
    const isEdit = Boolean(commande);
    const { data, setData, post, put, processing, errors, reset } = useForm(
        isEdit
            ? Object.fromEntries(COLUMNS.filter((c) => c.key !== 'id').map((c) => [c.key, commande[c.key] ?? '']))
            : EMPTY_FORM
    );

    function submit(e) {
        e.preventDefault();
        const options = { onSuccess: () => { reset(); onClose(); } };

        if (isEdit) {
            put(`/commandes/${commande.id}`, options);
        } else {
            post('/commandes', options);
        }
    }

    const avecImage = Boolean(commande?.Image_Path);
    const avecTexte = !avecImage && Boolean(commande?.Texte_Mail);
    const avecApercu = avecImage || avecTexte;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
                className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full h-[85vh] flex flex-col ${
                    avecApercu ? 'max-w-6xl' : 'max-w-3xl'
                }`}
            >
                {/* En-tête fixe (ne défile pas) */}
                <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-[#0d2b52] dark:text-white">
                        {isEdit ? `Modifier la commande #${commande.id}` : 'Ajouter une commande'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Zone centrale : chaque colonne défile indépendamment (min-h-0 = clé pour que le scroll marche dans un flexbox) */}
                <div className={`flex-1 min-h-0 overflow-y-auto ${avecApercu ? 'flex flex-col md:flex-row' : 'flex flex-col'}`}>
                    {avecImage && (
                        <div className="md:w-1/2 md:min-h-0 md:overflow-y-auto p-6 border-b md:border-b-0 md:border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-center">
                            <img
                                src={`/storage/${commande.Image_Path}`}
                                alt="Image du mail"
                                className="max-w-full rounded-lg shadow object-contain"
                            />
                        </div>
                    )}

                    {avecTexte && (
                        <div className="md:w-1/2 md:min-h-0 md:overflow-y-auto p-6 border-b md:border-b-0 md:border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Texte original du mail</p>
                            <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded-lg shadow p-4 select-text font-sans">
                                {commande.Texte_Mail}
                            </pre>
                        </div>
                    )}

                    <div className={`md:min-h-0 md:overflow-y-auto ${avecApercu ? 'md:w-1/2' : ''}`}>
                        <form id="form-commande" onSubmit={submit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {COLUMNS.filter((c) => c.key !== 'id').map((col) => (
                                <div key={col.key} className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{col.label}</label>
                                    {col.key === 'Urgent' ? (
                                        <select
                                            value={data.Urgent || ''}
                                            onChange={(e) => setData('Urgent', e.target.value)}
                                            className="border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                        >
                                            <option value="">—</option>
                                            <option value="OUI">OUI</option>
                                        </select>
                                    ) : col.key === 'Note' ? (
                                        <textarea
                                            value={data.Note || ''}
                                            onChange={(e) => setData('Note', e.target.value)}
                                            rows={2}
                                            className="border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={data[col.key] ?? ''}
                                            onChange={(e) => setData(col.key, e.target.value)}
                                            className="border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                        />
                                    )}
                                    {errors[col.key] && <span className="text-xs text-red-600 dark:text-red-400">{errors[col.key]}</span>}
                                </div>
                            ))}
                        </form>
                    </div>
                </div>

                {/* Pied fixe (toujours visible, pas besoin de descendre tout en bas) */}
                <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        form="form-commande"
                        disabled={processing}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 disabled:opacity-50"
                    >
                        {isEdit ? 'Enregistrer' : 'Ajouter'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ExtractionButton({ label, colorOn, source, running, busy, setBusy }) {
    const busyMoi = busy === source;

    function toggler() {
        setBusy(source);
        const action = running ? 'stop' : 'start';
        router.post(`/extraction/${source}/${action}`, {}, {
            preserveScroll: true,
            onFinish: () => setBusy((b) => (b === source ? null : b)),
        });
    }

    return (
        <button
            onClick={toggler}
            disabled={busyMoi}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${
                running ? 'bg-red-600 hover:bg-red-700' : colorOn
            }`}
        >
            {running ? `■ Arrêter ${label}` : `▶ Extraire ${label}`}
        </button>
    );
}

/** Petit panneau façon console : affiche le journal d'activité de l'extraction en cours. */
function PanneauJournal({ journalGmail = [], journalOutlook = [] }) {
    const lignes = [
        ...journalGmail.map((l) => ({ ...l, source: 'Gmail' })),
        ...journalOutlook.map((l) => ({ ...l, source: 'Outlook' })),
    ].sort((a, b) => new Date(a.horodatage) - new Date(b.horodatage));

    const finRef = useRef(null);
    useEffect(() => {
        finRef.current?.scrollIntoView({ block: 'end' });
    }, [lignes.length]);

    if (lignes.length === 0) return null;

    return (
        <div className="mb-6 bg-gray-900 dark:bg-black rounded-xl shadow-inner overflow-hidden">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">
                <IconTerminal className="h-3.5 w-3.5" /> Mails en cours d'extraction
            </p>
            <div className="px-4 pb-3 max-h-52 overflow-y-auto font-mono text-xs leading-relaxed">
                {lignes.map((l, i) => (
                    <p key={i} className="text-green-400/90 whitespace-pre-wrap break-words">
                        <span className="text-gray-500">
                            [{new Date(l.horodatage).toLocaleTimeString('fr-FR')} · {l.source}]
                        </span>{' '}
                        {l.message}
                    </p>
                ))}
                <div ref={finRef} />
            </div>
        </div>
    );
}

export default function Gestion({
    commandes = [],
    extraction = { gmail: false, outlook: false },
    service = null,
    groupeChamp = null,
    groupeValeur = null,
    groupes = [],
}) {
    const [modalCommande, setModalCommande] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filtre, setFiltre] = useState(null); // null | 'urgentes' | 'echeance' | 'sansQte'
    const [busy, setBusy] = useState(null); // null | 'gmail' | 'outlook'
    const [widths, startResize, colonneActive] = useResizableColumns(
        Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]))
    );
    const [celluleEdition, setCelluleEdition] = useState(null); // { id, col } | null
    const [valeurEdition, setValeurEdition] = useState('');
    const [selection, setSelection] = useState([]); // liste des id cochés
    const [importEnCours, setImportEnCours] = useState(false);
    const [viderEnCours, setViderEnCours] = useState(false);
    const [confirmation, setConfirmation] = useState(null); // { message, danger, onConfirm } | null
    const inputImportRef = useRef(null);
    const [masquerDoublons, setMasquerDoublons] = useState(false);
    const [menuColonnesOuvert, setMenuColonnesOuvert] = useState(false);
    const [colonnesVisibles, setColonnesVisibles] = useState(() => {
        try {
            const sauvegarde = JSON.parse(localStorage.getItem(CLE_COLONNES_VISIBLES));
            return Array.isArray(sauvegarde) ? sauvegarde : COLONNES_PAR_DEFAUT;
        } catch {
            return COLONNES_PAR_DEFAUT;
        }
    });

    function basculerColonne(cle) {
        setColonnesVisibles((actuelles) => {
            const nouvelles = actuelles.includes(cle) ? actuelles.filter((c) => c !== cle) : [...actuelles, cle];
            localStorage.setItem(CLE_COLONNES_VISIBLES, JSON.stringify(nouvelles));
            return nouvelles;
        });
    }

    const colonnesAffichees = COLUMNS.filter((c) => colonnesVisibles.includes(c.key));

    function importerFichier(e) {
        const fichier = e.target.files[0];
        e.target.value = ''; // permet de réimporter le même fichier ensuite
        if (!fichier) return;

        setImportEnCours(true);
        const donnees = new FormData();
        donnees.append('fichier', fichier);

        axios
            .post('/commandes/importer', donnees)
            .then(({ data }) => {
                toast(`Import terminé : ${data.crees} commande(s) créée(s), ${data.misAJour} mise(s) à jour.`);
                router.reload({ only: ['commandes'] });
            })
            .catch((err) => {
                toast(
                    err.response?.data?.erreur ||
                        "Impossible d'importer ce fichier. Vérifie que c'est bien un export Excel de cette page.",
                    'error'
                );
            })
            .finally(() => setImportEnCours(false));
    }

    function demarrerEdition(c, col) {
        if (col === 'id') return;
        setCelluleEdition({ id: c.id, col });
        setValeurEdition(c[col] ?? '');
    }

    function annulerEdition() {
        setCelluleEdition(null);
    }

    function validerEdition(c) {
        const { col } = celluleEdition;
        if (valeurEdition === (c[col] ?? '')) {
            setCelluleEdition(null);
            return;
        }
        router.put(`/commandes/${c.id}`, { [col]: valeurEdition }, {
            preserveScroll: true,
            onSuccess: () => setCelluleEdition(null),
        });
    }

    const extractionActive = extraction.gmail || extraction.outlook;

    // Revérifie automatiquement les commandes (pour que les mails extraits
    // apparaissent sans avoir à recharger la page à la main), même si
    // l'extraction a été lancée à la main (lancer_projet.ps1) plutôt que
    // depuis ce site. On met en pause pendant une saisie en cours (modale
    // ouverte ou édition d'une cellule) pour ne pas la perturber.
    useEffect(() => {
        const enTrainDeSaisir = showModal || celluleEdition !== null;
        if (enTrainDeSaisir) return;

        const intervalle = extractionActive ? 15000 : 30000;
        const id = setInterval(() => {
            router.reload({ only: ['commandes', 'extraction'], preserveScroll: true, preserveState: true });
        }, intervalle);

        return () => clearInterval(id);
    }, [extractionActive, showModal, celluleEdition]);

    const total = commandes.length;
    const urgentes = commandes.filter((c) => c.Urgent === 'OUI').length;
    const avecEcheance = commandes.filter((c) => c.Echeance_date || c.Echeance).length;
    const sansQte = commandes.filter((c) => !c.Qte_demandee && !c.Reste_a_livrer).length;

    function toggleFiltre(nom) {
        setFiltre((actuel) => (actuel === nom ? null : nom));
    }

    let commandesAffichees = commandes.filter((c) => {
        if (filtre === 'urgentes' && c.Urgent !== 'OUI') return false;
        if (filtre === 'echeance' && !(c.Echeance_date || c.Echeance)) return false;
        if (filtre === 'sansQte' && (c.Qte_demandee || c.Reste_a_livrer)) return false;
        return true;
    });
    if (masquerDoublons) {
        commandesAffichees = masquerLesDoublons(commandesAffichees);
    }

    function openAdd() {
        setModalCommande(null);
        setShowModal(true);
    }

    function openEdit(c) {
        setModalCommande(c);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setModalCommande(null);
    }

    function handleDelete(c) {
        setConfirmation({
            message: `Supprimer la commande #${c.id} (${c.Article || 'sans article'}) ?`,
            danger: true,
            onConfirm: () => {
                setConfirmation(null);
                router.delete(`/commandes/${c.id}`, {
                    onSuccess: () => toast('Commande supprimée.'),
                });
            },
        });
    }

    function viderAnciennes() {
        setConfirmation({
            message: 'Envoyer toutes les commandes "ancienne" à la corbeille ? Tu pourras les restaurer depuis la corbeille.',
            onConfirm: () => {
                setConfirmation(null);
                setViderEnCours(true);
                router.post('/commandes/vider-anciennes', {}, {
                    onSuccess: () => toast('Commandes anciennes envoyées à la corbeille.'),
                    onFinish: () => setViderEnCours(false),
                });
            },
        });
    }

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

    function supprimerSelection() {
        setConfirmation({
            message: `Supprimer définitivement ${selection.length} commande(s) ? Cette action est irréversible.`,
            danger: true,
            onConfirm: () => {
                setConfirmation(null);
                router.post(
                    '/commandes/supprimer-selection',
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
            title="Gestion des commandes"
            titleSuffix={SUFFIXES_TITRE[service] ?? null}
            subtitle="Commandes extraites automatiquement des mails, mises à jour en temps réel."
        >
            <MenuService service={service} />

            {groupeChamp && groupes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mr-1">
                        Grouper par {groupeChamp === 'Objet' ? 'objet du mail' : 'émetteur'} :
                    </span>
                    <Link
                        href={groupeChamp === 'Objet' ? '/commandes/export' : '/commandes/commercial'}
                        preserveScroll
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            groupeValeur === null
                                ? 'text-white bg-[#0d2b52] border-[#0d2b52] dark:bg-blue-600 dark:border-blue-600'
                                : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-100 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
                        }`}
                    >
                        Toutes ({groupes.reduce((s, g) => s + g.nombre, 0)})
                    </Link>
                    {groupes.map((g) => (
                        <Link
                            key={g.valeur}
                            href={`${groupeChamp === 'Objet' ? '/commandes/export/objet' : '/commandes/commercial/emetteur'}/${encodeURIComponent(g.valeur)}`}
                            preserveScroll
                            title={g.valeur}
                            className={`max-w-[220px] truncate px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                groupeValeur === g.valeur
                                    ? 'text-white bg-[#0d2b52] border-[#0d2b52] dark:bg-blue-600 dark:border-blue-600'
                                    : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-100 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                            {g.valeur} ({g.nombre})
                        </Link>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <ExtractionButton
                    label="Gmail"
                    colorOn="bg-[#0d2b52] hover:bg-[#0d2b52]/90"
                    source="gmail"
                    running={extraction.gmail}
                    busy={busy}
                    setBusy={setBusy}
                />
                <ExtractionButton
                    label="Outlook"
                    colorOn="bg-blue-600 hover:bg-blue-700"
                    source="outlook"
                    running={extraction.outlook}
                    busy={busy}
                    setBusy={setBusy}
                />
                {extraction.gmail && (
                    <span className="text-sm font-semibold text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                        Gmail : {extraction.message_gmail || '● Surveillance active…'}
                    </span>
                )}
                {extraction.outlook && (
                    <span className="text-sm font-semibold text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                        Outlook : {extraction.message_outlook || '● Surveillance active…'}
                    </span>
                )}
            </div>

            {extractionActive && (
                <PanneauJournal
                    journalGmail={extraction.journal_gmail || []}
                    journalOutlook={extraction.journal_outlook || []}
                />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                <StatCard
                    label="Commandes"
                    value={total}
                    note="Lignes extraites au total"
                    active={filtre === null}
                    onClick={() => setFiltre(null)}
                />
                <StatCard
                    label="Urgentes"
                    value={urgentes}
                    note="Marquées urgentes dans le mail"
                    accent
                    active={filtre === 'urgentes'}
                    onClick={() => toggleFiltre('urgentes')}
                />
                <StatCard
                    label="Avec échéance"
                    value={avecEcheance}
                    note="Une date limite est connue"
                    active={filtre === 'echeance'}
                    onClick={() => toggleFiltre('echeance')}
                />
                <StatCard
                    label="Quantité manquante"
                    value={sansQte}
                    note="À vérifier manuellement"
                    active={filtre === 'sansQte'}
                    onClick={() => toggleFiltre('sansQte')}
                />
            </div>

            {selection.length > 0 && (
                <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-[#0d2b52] dark:text-blue-300">
                        {selection.length} commande(s) sélectionnée(s)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelection([])}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white hover:bg-gray-100 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                            Annuler la sélection
                        </button>
                        <button
                            onClick={supprimerSelection}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                        >
                            <IconTrash className="h-3.5 w-3.5" /> Supprimer la sélection
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setMasquerDoublons((v) => !v)}
                        title="Regroupe par émetteur + article, garde la ligne la plus complète (affichage seulement, rien n'est supprimé)"
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                            masquerDoublons
                                ? 'text-[#0d2b52] bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800'
                                : 'text-gray-700 bg-gray-100 border-gray-300 hover:bg-gray-200 shadow-sm dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
                        }`}
                    >
                        <IconLayers className="h-4 w-4" /> {masquerDoublons ? 'Doublons masqués' : 'Masquer les doublons'}
                    </button>
                    {filtre && (
                        <button
                            onClick={() => setFiltre(null)}
                            className="text-sm font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                        >
                            × Retirer les filtres
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setMenuColonnesOuvert((v) => !v)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                menuColonnesOuvert
                                    ? 'text-[#0d2b52] bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800'
                                    : 'text-gray-700 bg-gray-100 border-gray-300 hover:bg-gray-200 shadow-sm dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0d2b52]/10 dark:bg-blue-400/10">
                                <IconColumns className="h-3.5 w-3.5" />
                            </span>
                            Colonnes
                            <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">{colonnesVisibles.length}/{COLUMNS.length}</span>
                            <svg className={`w-3 h-3 transition-transform ${menuColonnesOuvert ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div
                            onMouseLeave={() => setMenuColonnesOuvert(false)}
                            className={`absolute right-0 mt-1.5 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 origin-top-right transition-all duration-150 ${
                                menuColonnesOuvert ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                            }`}
                        >
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
                                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Colonnes affichées</p>
                                <button
                                    onClick={() => {
                                        const toutes = colonnesVisibles.length === COLUMNS.length;
                                        const nouvelles = toutes ? [] : COLUMNS.map((c) => c.key);
                                        setColonnesVisibles(nouvelles);
                                        localStorage.setItem(CLE_COLONNES_VISIBLES, JSON.stringify(nouvelles));
                                    }}
                                    className="text-[11px] font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                                >
                                    {colonnesVisibles.length === COLUMNS.length ? 'Tout masquer' : 'Tout afficher'}
                                </button>
                            </div>
                            <div className="max-h-72 overflow-y-auto p-1.5">
                                {COLUMNS.map((col) => (
                                    <label
                                        key={col.key}
                                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={colonnesVisibles.includes(col.key)}
                                            onChange={() => basculerColonne(col.key)}
                                            className="rounded border-gray-300 dark:border-gray-600 text-[#0d2b52] focus:ring-[#0d2b52]/30"
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={viderAnciennes}
                        disabled={viderEnCours}
                        title="Envoie à la corbeille toutes les commandes au statut « ancienne »"
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 shadow-sm disabled:opacity-50 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/30"
                    >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/40">
                            {viderEnCours ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : <IconTrash className="h-3.5 w-3.5" />}
                        </span>
                        {viderEnCours ? 'Vidage en cours…' : 'Vider les anciennes'}
                    </button>
                    <a
                        href="/commandes/exporter-excel"
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 shadow-sm dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/70 dark:bg-black/20">
                            <IconDownload className="h-3.5 w-3.5" />
                        </span>
                        Exporter Excel
                    </a>
                    <button
                        onClick={() => inputImportRef.current?.click()}
                        disabled={importEnCours}
                        title='Fichier au même format que "Exporter Excel"'
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 shadow-sm disabled:opacity-50 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/70 dark:bg-black/20">
                            {importEnCours ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : <IconUpload className="h-3.5 w-3.5" />}
                        </span>
                        {importEnCours ? 'Import en cours…' : 'Importer Excel'}
                    </button>
                    <input
                        ref={inputImportRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={importerFichier}
                        className="hidden"
                    />
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 shadow-sm shadow-[#0d2b52]/20"
                    >
                        <span className="text-base leading-none">+</span> Ajouter une commande
                    </button>
                </div>
            </div>

            {/* max-h + overflow-auto (pas juste overflow-x-auto) : le tableau devient sa
                propre zone de défilement bornée, verticale ET horizontale. Sans ça, la
                barre de scroll horizontal se retrouve tout en bas des 60+ lignes, hors
                écran tant qu'on n'a pas fait défiler toute la page jusque-là. Avec une
                hauteur bornée, elle reste TOUJOURS visible et utilisable, quelle que soit
                la ligne affichée -- le scroll interne (lignes) et le scroll externe de la
                page (au-dessus du tableau) restent bien deux zones indépendantes. */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-auto max-h-[65vh]">
                <table className="w-full text-sm table-fixed border-collapse">
                    <colgroup>
                        <col style={{ width: 40 }} />
                        {colonnesAffichees.map((col) => (
                            <col key={col.key} style={{ width: widths[col.key] }} />
                        ))}
                        <col style={{ width: ACTIONS_WIDTH }} />
                    </colgroup>
                    <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400">
                            <th className="sticky top-0 z-[1] px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
                                <input
                                    type="checkbox"
                                    checked={touteSelectionnee}
                                    onChange={basculerTout}
                                    className="rounded border-gray-300 dark:border-gray-600"
                                />
                            </th>
                            {colonnesAffichees.map((col) => (
                                <th
                                    key={col.key}
                                    className={`sticky top-0 z-[1] relative px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide truncate select-none bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] ${
                                        col.numeric ? 'text-right' : 'text-left'
                                    }`}
                                >
                                    {col.label}
                                    <span
                                        onMouseDown={(e) => startResize(e, col.key)}
                                        className="absolute top-0 right-0 flex h-full w-3 -mr-1.5 cursor-col-resize items-stretch justify-center z-10 group"
                                    >
                                        <span
                                            className={`w-[3px] my-1 rounded-full transition-all duration-150 ${
                                                colonneActive === col.key
                                                    ? 'bg-[#0d2b52] dark:bg-blue-400 w-1'
                                                    : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-400 group-hover:w-1'
                                            }`}
                                        />
                                    </span>
                                </th>
                            ))}
                            <th className="sticky top-0 z-[1] px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {commandesAffichees.map((c, index) => (
                            <tr
                                key={c.id}
                                className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                    selection.includes(c.id)
                                        ? 'bg-blue-50/60 dark:bg-blue-900/20'
                                        : index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                }`}
                            >
                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800">
                                    <input
                                        type="checkbox"
                                        checked={selection.includes(c.id)}
                                        onChange={() => basculerUne(c.id)}
                                        className="rounded border-gray-300 dark:border-gray-600"
                                    />
                                </td>
                                {colonnesAffichees.map((col) => {
                                    const enEdition = celluleEdition?.id === c.id && celluleEdition?.col === col.key;

                                    return (
                                        <td
                                            key={col.key}
                                            onDoubleClick={() => demarrerEdition(c, col.key)}
                                            className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200 ${
                                                enEdition ? '' : 'truncate cursor-text'
                                            } ${col.numeric ? 'text-right tabular-nums' : ''}`}
                                            title={enEdition ? '' : c[col.key] ?? ''}
                                        >
                                            {enEdition ? (
                                                col.key === 'Urgent' ? (
                                                    <select
                                                        autoFocus
                                                        value={valeurEdition || ''}
                                                        onChange={(e) => setValeurEdition(e.target.value)}
                                                        onBlur={() => validerEdition(c)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') validerEdition(c);
                                                            if (e.key === 'Escape') annulerEdition();
                                                        }}
                                                        className="w-full rounded-md border-2 border-[#0d2b52] dark:border-blue-400 px-2 py-1 text-sm outline-none ring-2 ring-[#0d2b52]/20 dark:ring-blue-400/20 bg-white dark:bg-gray-800 dark:text-white"
                                                    >
                                                        <option value="">—</option>
                                                        <option value="OUI">OUI</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={valeurEdition || ''}
                                                        onChange={(e) => setValeurEdition(e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        onBlur={() => validerEdition(c)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') validerEdition(c);
                                                            if (e.key === 'Escape') annulerEdition();
                                                        }}
                                                        className="w-full rounded-md border-2 border-[#0d2b52] dark:border-blue-400 px-2 py-1 text-sm outline-none ring-2 ring-[#0d2b52]/20 dark:ring-blue-400/20 bg-white dark:bg-gray-800 dark:text-white"
                                                    />
                                                )
                                            ) : col.key === 'Message_ID' ? (
                                                c.Message_ID ? (
                                                    estMessageIdGmail(c.Message_ID) ? (
                                                        <a
                                                            href={gmailSearchUrl(c.Message_ID)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            {c.Message_ID}
                                                        </a>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); copierMessageId(c.Message_ID); }}
                                                            title="Copie l'ID, puis colle « messageid:… » dans la recherche Outlook pour retrouver ce mail"
                                                            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline truncate max-w-full text-left"
                                                        >
                                                            <IconClipboard className="h-3.5 w-3.5 shrink-0" /> {c.Message_ID}
                                                        </button>
                                                    )
                                                ) : (
                                                    '—'
                                                )
                                            ) : col.key === 'Urgent' ? (
                                                c.Urgent === 'OUI' ? (
                                                    <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold text-xs px-2.5 py-1 rounded-full">
                                                        URGENT
                                                    </span>
                                                ) : (
                                                    '—'
                                                )
                                            ) : col.key === 'Article' ? (
                                                <span className="font-mono font-semibold text-[#0d2b52] dark:text-blue-300">
                                                    {c.Article || '—'}
                                                </span>
                                            ) : col.key === 'Job' ? (
                                                c.Job ? <BadgeJob job={c.Job} /> : '—'
                                            ) : col.key === 'Source' && c.Source === 'image-ocr' && c.Image_Path ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                    title="Voir l'image et modifier la commande"
                                                >
                                                    <IconImage className="h-3.5 w-3.5 shrink-0" /> {c.Source}
                                                </button>
                                            ) : col.key === 'Source' && c.Source === 'texte' && c.Texte_Mail ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                    title="Voir le texte du mail et modifier la commande"
                                                >
                                                    <IconFileText className="h-3.5 w-3.5 shrink-0" /> {c.Source}
                                                </button>
                                            ) : (
                                                c[col.key] ?? '—'
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(c)}
                                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#0d2b52] bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                        >
                                            Modifier
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c)}
                                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {commandesAffichees.length === 0 && (
                            <tr>
                                <td colSpan={colonnesAffichees.length + 2} className="px-4 py-8 text-center text-gray-400 dark:text-gray-600">
                                    {filtre ? 'Aucune commande ne correspond à ce filtre.' : 'Aucune commande pour le moment.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {showModal && <CommandeModal commande={modalCommande} onClose={closeModal} />}
            <ConfirmDialog
                open={Boolean(confirmation)}
                message={confirmation?.message}
                danger={confirmation?.danger}
                onConfirm={confirmation?.onConfirm}
                onCancel={() => setConfirmation(null)}
            />
        </AppLayout>
    );
}
