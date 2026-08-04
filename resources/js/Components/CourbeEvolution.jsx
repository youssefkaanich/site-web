import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Courbe d'évolution du stock d'un article dans le temps.
 *
 * Une seule série : pas de légende (le titre au-dessus nomme l'article), pas de
 * palette catégorielle. Le trait porte la couleur de marque en clair et une
 * teinte plus lumineuse en sombre — choisie pour le fond sombre, pas obtenue en
 * inversant la couleur claire, qui deviendrait illisible.
 *
 * L'axe vertical part de 0 volontairement : sur un stock, la question métier
 * est la distance à la rupture. Une échelle tronquée la masquerait.
 */

const MARGE = { haut: 16, droite: 20, bas: 34, gauche: 62 };
const HAUTEUR = 300;

function formaterNombre(valeur) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(valeur);
}

function formaterDate(iso, avecHeure = true) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

/** Bornes de l'axe vertical, arrondies à un pas « rond » pour des graduations lisibles. */
function bornesVerticales(valeurs) {
    const max = Math.max(0, ...valeurs);
    const min = Math.min(0, ...valeurs); // 0 inclus, sauf stock négatif (anomalie de données)

    if (max === min) return { min: min - 1, max: max + 1 };

    const etendue = max - min;
    const pas = Math.pow(10, Math.floor(Math.log10(etendue / 4)));
    const pasArrondi = [1, 2, 5, 10].map((m) => m * pas).find((p) => etendue / p <= 6) ?? pas * 10;

    return {
        min: Math.floor(min / pasArrondi) * pasArrondi,
        max: Math.ceil(max / pasArrondi) * pasArrondi,
        pas: pasArrondi,
    };
}

export default function CourbeEvolution({ points, article, designation }) {
    const conteneur = useRef(null);
    const [largeur, setLargeur] = useState(760);
    const [survole, setSurvole] = useState(null);

    // Le SVG doit suivre la largeur réelle de son conteneur : un viewBox étiré
    // déformerait le texte des graduations.
    useEffect(() => {
        if (!conteneur.current) return;
        const observateur = new ResizeObserver(([entree]) => {
            setLargeur(Math.max(320, entree.contentRect.width));
        });
        observateur.observe(conteneur.current);
        return () => observateur.disconnect();
    }, []);

    const calcul = useMemo(() => {
        if (!points?.length) return null;

        const instants = points.map((p) => new Date(p.instant).getTime());
        const stocks = points.map((p) => p.stock);

        const tMin = Math.min(...instants);
        const tMax = Math.max(...instants);
        const { min: yMin, max: yMax, pas } = bornesVerticales(stocks);

        const largeurTrace = largeur - MARGE.gauche - MARGE.droite;
        const hauteurTrace = HAUTEUR - MARGE.haut - MARGE.bas;

        // Un seul point (aucun mouvement depuis la référence) : on le centre
        // au lieu de diviser par zéro.
        const versX = (t) =>
            tMax === tMin
                ? MARGE.gauche + largeurTrace / 2
                : MARGE.gauche + ((t - tMin) / (tMax - tMin)) * largeurTrace;
        const versY = (v) => MARGE.haut + (1 - (v - yMin) / (yMax - yMin || 1)) * hauteurTrace;

        const coordonnees = points.map((p, i) => ({
            ...p,
            t: instants[i],
            x: versX(instants[i]),
            y: versY(p.stock),
        }));

        // Tracé en escalier : entre deux mouvements le stock ne varie pas, une
        // ligne droite laisserait croire à une décroissance continue.
        let chemin = '';
        coordonnees.forEach((p, i) => {
            if (i === 0) chemin += `M ${p.x} ${p.y}`;
            else chemin += ` L ${p.x} ${coordonnees[i - 1].y} L ${p.x} ${p.y}`;
        });

        const graduations = [];
        for (let v = yMin; v <= yMax + 0.0001; v += pas || (yMax - yMin) / 4) {
            graduations.push({ valeur: v, y: versY(v) });
            if (graduations.length > 12) break;
        }

        return { coordonnees, chemin, graduations, yMin, yMax, tMin, tMax, largeurTrace, hauteurTrace };
    }, [points, largeur]);

    if (!calcul) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Aucune donnée à afficher.
            </div>
        );
    }

    const { coordonnees, chemin, graduations, hauteurTrace } = calcul;
    const dernier = coordonnees[coordonnees.length - 1];

    function surDeplacement(evenement) {
        const rect = evenement.currentTarget.getBoundingClientRect();
        const x = evenement.clientX - rect.left;

        let proche = coordonnees[0];
        for (const point of coordonnees) {
            if (Math.abs(point.x - x) < Math.abs(proche.x - x)) proche = point;
        }
        setSurvole(proche);
    }

    return (
        <div ref={conteneur} className="relative w-full">
            <svg
                width={largeur}
                height={HAUTEUR}
                role="img"
                aria-label={`Évolution du stock de l'article ${article}`}
                className="overflow-visible"
            >
                {/* Grille horizontale, volontairement discrète */}
                {graduations.map((g) => (
                    <g key={g.valeur}>
                        <line
                            x1={MARGE.gauche}
                            x2={largeur - MARGE.droite}
                            y1={g.y}
                            y2={g.y}
                            className="stroke-slate-200 dark:stroke-slate-700"
                            strokeWidth="1"
                        />
                        <text
                            x={MARGE.gauche - 10}
                            y={g.y + 4}
                            textAnchor="end"
                            className="fill-slate-500 dark:fill-slate-400 text-[11px] tabular-nums"
                        >
                            {formaterNombre(g.valeur)}
                        </text>
                    </g>
                ))}

                {/* Ligne du zéro, appuyée : c'est le seuil de rupture */}
                {calcul.yMin < 0 && (
                    <line
                        x1={MARGE.gauche}
                        x2={largeur - MARGE.droite}
                        y1={MARGE.haut + (1 - (0 - calcul.yMin) / (calcul.yMax - calcul.yMin)) * hauteurTrace}
                        y2={MARGE.haut + (1 - (0 - calcul.yMin) / (calcul.yMax - calcul.yMin)) * hauteurTrace}
                        className="stroke-slate-400 dark:stroke-slate-500"
                        strokeWidth="1.5"
                    />
                )}

                {/* Dates aux extrémités */}
                <text
                    x={MARGE.gauche}
                    y={HAUTEUR - 12}
                    className="fill-slate-500 dark:fill-slate-400 text-[11px]"
                >
                    {formaterDate(coordonnees[0].instant, false)}
                </text>
                <text
                    x={largeur - MARGE.droite}
                    y={HAUTEUR - 12}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400 text-[11px]"
                >
                    {formaterDate(dernier.instant, false)}
                </text>

                {/* La courbe */}
                <path
                    d={chemin}
                    fill="none"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    className="stroke-[#0d2b52] dark:stroke-[#60a5fa]"
                />

                {/* Repère de survol */}
                {survole && (
                    <g>
                        <line
                            x1={survole.x}
                            x2={survole.x}
                            y1={MARGE.haut}
                            y2={MARGE.haut + hauteurTrace}
                            className="stroke-slate-400 dark:stroke-slate-500"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                        <circle
                            cx={survole.x}
                            cy={survole.y}
                            r="5"
                            className="fill-[#0d2b52] dark:fill-[#60a5fa] stroke-white dark:stroke-slate-900"
                            strokeWidth="2"
                        />
                    </g>
                )}

                {/* Étiquette du dernier point : la valeur qui intéresse en premier */}
                {!survole && (
                    <circle
                        cx={dernier.x}
                        cy={dernier.y}
                        r="4"
                        className="fill-[#0d2b52] dark:fill-[#60a5fa] stroke-white dark:stroke-slate-900"
                        strokeWidth="2"
                    />
                )}

                {/* Zone de capture de la souris, plus large que le trait */}
                <rect
                    x={MARGE.gauche}
                    y={MARGE.haut}
                    width={Math.max(1, largeur - MARGE.gauche - MARGE.droite)}
                    height={hauteurTrace}
                    fill="transparent"
                    onMouseMove={surDeplacement}
                    onMouseLeave={() => setSurvole(null)}
                />
            </svg>

            {survole && (
                <div
                    className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-lg text-xs"
                    style={{
                        left: Math.min(Math.max(survole.x - 70, 0), largeur - 160),
                        top: Math.max(survole.y - 70, 0),
                    }}
                >
                    <p className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formaterNombre(survole.stock)} en stock
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">{formaterDate(survole.instant)}</p>
                    {survole.quantite !== null && survole.quantite !== undefined && (
                        <p
                            className={`mt-1 font-medium tabular-nums ${
                                survole.quantite < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {survole.quantite > 0 ? '+' : ''}
                            {formaterNombre(survole.quantite)} ce jour-là
                        </p>
                    )}
                </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 text-center">
                {designation ? `${article} — ${designation}` : article} · {coordonnees.length} point
                {coordonnees.length > 1 ? 's' : ''} · survole la courbe pour lire une date
            </p>
        </div>
    );
}
