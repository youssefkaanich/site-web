import { useEffect, useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import { useResizableColumns } from '../hooks/useResizableColumns';

const COLUMNS = [
    { key: 'id', label: 'ID', width: 60, numeric: true },
    { key: 'Message_ID', label: 'Message ID', width: 220 },
    { key: 'Date_mail', label: 'Date mail', width: 170 },
    { key: 'Source', label: 'Source', width: 90 },
    { key: 'Article', label: 'Article', width: 110 },
    { key: 'Designation', label: 'Désignation', width: 180 },
    { key: 'Qte_demandee', label: 'Qté demandée', width: 110, numeric: true },
    { key: 'Reste_a_livrer', label: 'Reste à livrer', width: 110, numeric: true },
    { key: 'Qte_en_rupture', label: 'Qté en rupture', width: 110, numeric: true },
    { key: 'Qte_allouee', label: 'Qté allouée', width: 110, numeric: true },
    { key: 'Qte_a_allouer', label: 'Qté à allouer', width: 110, numeric: true },
    { key: 'Site_exp', label: 'Site exp.', width: 100 },
    { key: 'UV', label: 'UV', width: 70 },
    { key: 'Destination', label: 'Destination', width: 130 },
    { key: 'Echeance', label: 'Échéance', width: 110 },
    { key: 'Echeance_date', label: 'Date échéance', width: 120 },
    { key: 'Urgent', label: 'Urgent', width: 90 },
    { key: 'Note', label: 'Note', width: 160 },
    { key: 'statut', label: 'Statut', width: 100 },
];

const ACTIONS_WIDTH = 150;

const EMPTY_FORM = {
    Message_ID: '',
    Date_mail: '',
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

export default function Gestion({ commandes = [], extraction = { gmail: false, outlook: false } }) {
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

    // Revérifie souvent le statut/les commandes, mais seulement pendant qu'une extraction tourne
    useEffect(() => {
        if (!extractionActive) return;

        const id = setInterval(() => {
            router.reload({ only: ['commandes', 'extraction'], preserveScroll: true, preserveState: true });
        }, 4000);

        return () => clearInterval(id);
    }, [extractionActive]);

    const total = commandes.length;
    const urgentes = commandes.filter((c) => c.Urgent === 'OUI').length;
    const avecEcheance = commandes.filter((c) => c.Echeance_date || c.Echeance).length;
    const sansQte = commandes.filter((c) => !c.Qte_demandee && !c.Reste_a_livrer).length;

    function toggleFiltre(nom) {
        setFiltre((actuel) => (actuel === nom ? null : nom));
    }

    const commandesAffichees = commandes.filter((c) => {
        if (filtre === 'urgentes') return c.Urgent === 'OUI';
        if (filtre === 'echeance') return c.Echeance_date || c.Echeance;
        if (filtre === 'sansQte') return !c.Qte_demandee && !c.Reste_a_livrer;
        return true;
    });

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
        if (confirm(`Supprimer la commande #${c.id} (${c.Article || 'sans article'}) ?`)) {
            router.delete(`/commandes/${c.id}`);
        }
    }

    function viderAnciennes() {
        if (confirm('Envoyer toutes les commandes "ancienne" à la corbeille ? Tu pourras les restaurer depuis la corbeille.')) {
            router.post('/commandes/vider-anciennes');
        }
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
        if (confirm(`Supprimer définitivement ${selection.length} commande(s) ? Cette action est irréversible.`)) {
            router.post(
                '/commandes/supprimer-selection',
                { ids: selection },
                { preserveScroll: true, onSuccess: () => setSelection([]) }
            );
        }
    }

    return (
        <AppLayout
            title="Gestion des commandes"
            subtitle="Commandes extraites automatiquement des mails, mises à jour en temps réel."
        >
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
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                        >
                            🗑️ Supprimer la sélection
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                {filtre ? (
                    <button
                        onClick={() => setFiltre(null)}
                        className="text-sm font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                    >
                        × Retirer le filtre
                    </button>
                ) : (
                    <span />
                )}
                <div className="flex gap-3">
                    <button
                        onClick={viderAnciennes}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                        🗑️ Vider les anciennes
                    </button>
                    <a
                        href="/commandes/export"
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                        📥 Exporter Excel
                    </a>
                    <button
                        onClick={openAdd}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90"
                    >
                        + Ajouter une commande
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed border-collapse">
                    <colgroup>
                        <col style={{ width: 40 }} />
                        {COLUMNS.map((col) => (
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
                            {COLUMNS.map((col) => (
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
                                {COLUMNS.map((col) => {
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
                                                    <a
                                                        href={gmailSearchUrl(c.Message_ID)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        {c.Message_ID}
                                                    </a>
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
                                            ) : col.key === 'Source' && c.Source === 'image-ocr' && c.Image_Path ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    title="Voir l'image et modifier la commande"
                                                >
                                                    🖼️ {c.Source}
                                                </button>
                                            ) : col.key === 'Source' && c.Source === 'texte' && c.Texte_Mail ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    title="Voir le texte du mail et modifier la commande"
                                                >
                                                    📝 {c.Source}
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
                                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-400 dark:text-gray-600">
                                    {filtre ? 'Aucune commande ne correspond à ce filtre.' : 'Aucune commande pour le moment.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {showModal && <CommandeModal commande={modalCommande} onClose={closeModal} />}
        </AppLayout>
    );
}
