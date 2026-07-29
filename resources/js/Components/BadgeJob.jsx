import { IconGlobe, IconBriefcase } from './Icons';

/**
 * Badge "Job" (Export / Commercial), même code couleur que le menu de
 * navigation et le titre de Gestion.jsx (bleu / bordeaux) — centralisé ici
 * pour rester identique entre Gestion.jsx et Corbeille.jsx.
 */
export default function BadgeJob({ job }) {
    if (!job) return null;

    const estExport = job === 'Export';
    const Icone = estExport ? IconGlobe : IconBriefcase;

    return (
        <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                estExport
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-[#7a2331]/10 text-[#7a2331] dark:bg-[#7a2331]/20 dark:text-[#e8b4bc]'
            }`}
        >
            <Icone className="h-3.5 w-3.5 shrink-0" />
            {job}
        </span>
    );
}
