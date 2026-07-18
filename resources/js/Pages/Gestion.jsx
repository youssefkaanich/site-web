import { useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';

const COLUMNS = [
    { key: 'id', label: 'ID', width: 60 },
    { key: 'Message_ID', label: 'Message ID', width: 220 },
    { key: 'Date_mail', label: 'Date mail', width: 170 },
    { key: 'Source', label: 'Source', width: 90 },
    { key: 'Article', label: 'Article', width: 110 },
    { key: 'Designation', label: 'Désignation', width: 180 },
    { key: 'Qte_demandee', label: 'Qté demandée', width: 110 },
    { key: 'Reste_a_livrer', label: 'Reste à livrer', width: 110 },
    { key: 'Qte_en_rupture', label: 'Qté en rupture', width: 110 },
    { key: 'Qte_allouee', label: 'Qté allouée', width: 110 },
    { key: 'Qte_a_allouer', label: 'Qté à allouer', width: 110 },
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

function useResizableColumns(initialWidths) {
    const [widths, setWidths] = useState(initialWidths);

    function startResize(e, key) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = widths[key];

        function onMouseMove(ev) {
            setWidths((w) => ({ ...w, [key]: Math.max(50, startWidth + (ev.clientX - startX)) }));
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    return [widths, startResize];
}

function gmailSearchUrl(messageId) {
    const clean = messageId.replace(/^<|>$/g, '');
    return `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(clean)}`;
}

function StatCard({ label, value, note, accent = false, active = false, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left bg-white rounded-2xl p-5 shadow-sm transition ring-2 ${
                active ? 'ring-[#0d2b52]' : 'ring-transparent hover:ring-gray-200'
            }`}
        >
            <p className="text-sm font-semibold text-gray-600">{label}</p>
            <p className={`text-4xl font-extrabold mt-2 ${accent ? 'text-red-600' : 'text-[#0d2b52]'}`}>
                {value}
            </p>
            {note && <p className="text-xs text-gray-400 mt-2">{note}</p>}
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

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                    <h2 className="text-lg font-bold text-[#0d2b52]">
                        {isEdit ? `Modifier la commande #${commande.id}` : 'Ajouter une commande'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
                        ×
                    </button>
                </div>

                <form onSubmit={submit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {COLUMNS.filter((c) => c.key !== 'id').map((col) => (
                        <div key={col.key} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500">{col.label}</label>
                            {col.key === 'Urgent' ? (
                                <select
                                    value={data.Urgent || ''}
                                    onChange={(e) => setData('Urgent', e.target.value)}
                                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                >
                                    <option value="">—</option>
                                    <option value="OUI">OUI</option>
                                </select>
                            ) : col.key === 'Note' ? (
                                <textarea
                                    value={data.Note || ''}
                                    onChange={(e) => setData('Note', e.target.value)}
                                    rows={2}
                                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={data[col.key] ?? ''}
                                    onChange={(e) => setData(col.key, e.target.value)}
                                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                                />
                            )}
                            {errors[col.key] && <span className="text-xs text-red-600">{errors[col.key]}</span>}
                        </div>
                    ))}

                    <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 disabled:opacity-50"
                        >
                            {isEdit ? 'Enregistrer' : 'Ajouter'}
                        </button>
                    </div>
                </form>
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
    const [widths, startResize] = useResizableColumns(
        Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]))
    );

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
                {(extraction.gmail || extraction.outlook) && (
                    <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                        ● Surveillance active — le tableau se met à jour automatiquement
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

            <div className="flex items-center justify-between mb-4">
                {filtre ? (
                    <button
                        onClick={() => setFiltre(null)}
                        className="text-sm font-semibold text-[#0d2b52] hover:underline"
                    >
                        × Retirer le filtre
                    </button>
                ) : (
                    <span />
                )}
                <button
                    onClick={openAdd}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90"
                >
                    + Ajouter une commande
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                    <colgroup>
                        {COLUMNS.map((col) => (
                            <col key={col.key} style={{ width: widths[col.key] }} />
                        ))}
                        <col style={{ width: ACTIONS_WIDTH }} />
                    </colgroup>
                    <thead>
                        <tr className="bg-gray-50 text-left text-gray-600 border-b">
                            {COLUMNS.map((col) => (
                                <th key={col.key} className="relative px-4 py-3 font-semibold truncate select-none">
                                    {col.label}
                                    <span
                                        onMouseDown={(e) => startResize(e, col.key)}
                                        className="absolute top-0 right-0 flex h-full w-2.5 cursor-col-resize items-stretch justify-center group"
                                    >
                                        <span className="w-px bg-gray-300 group-hover:w-1 group-hover:bg-blue-500 transition-all" />
                                    </span>
                                </th>
                            ))}
                            <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commandesAffichees.map((c) => (
                            <tr key={c.id} className="border-b last:border-0 hover:bg-blue-50/40">
                                {COLUMNS.map((col) => (
                                    <td key={col.key} className="px-4 py-3 truncate" title={c[col.key] ?? ''}>
                                        {col.key === 'Message_ID' ? (
                                            c.Message_ID ? (
                                                <a
                                                    href={gmailSearchUrl(c.Message_ID)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {c.Message_ID}
                                                </a>
                                            ) : (
                                                '—'
                                            )
                                        ) : col.key === 'Urgent' ? (
                                            c.Urgent === 'OUI' ? (
                                                <span className="bg-red-100 text-red-700 font-bold text-xs px-2.5 py-1 rounded-full">
                                                    URGENT
                                                </span>
                                            ) : (
                                                '—'
                                            )
                                        ) : col.key === 'Article' ? (
                                            <span className="font-mono font-semibold text-[#0d2b52]">
                                                {c.Article || '—'}
                                            </span>
                                        ) : (
                                            c[col.key] ?? '—'
                                        )}
                                    </td>
                                ))}
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(c)}
                                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#0d2b52] bg-blue-50 hover:bg-blue-100"
                                        >
                                            Modifier
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c)}
                                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {commandesAffichees.length === 0 && (
                            <tr>
                                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-400">
                                    {filtre ? 'Aucune commande ne correspond à ce filtre.' : 'Aucune commande pour le moment.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && <CommandeModal commande={modalCommande} onClose={closeModal} />}
        </AppLayout>
    );
}
