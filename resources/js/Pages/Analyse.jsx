import AppLayout from '../Layouts/AppLayout';

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

export default function Analyse({
    total = 0,
    urgentes = 0,
    parSource = {},
    parJour = {},
    topArticles = {},
    topDestinations = {},
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <GraphiqueBarresHorizontal titre="Top 5 articles les plus demandés" donnees={donneesArticles} />
                        <GraphiqueBarresHorizontal titre="Top 5 destinations" donnees={donneesDestinations} />
                    </div>
                </>
            )}
        </AppLayout>
    );
}
