/**
 * Icônes SVG maison, sobres et monochromes (style traits fins façon
 * Heroicons outline) — ce projet n'a aucune bibliothèque d'icônes installée
 * (voir package.json), donc on centralise ici les icônes utilisées partout
 * dans l'appli plutôt que de les dupliquer fichier par fichier, ou de garder
 * des émojis (pas adaptés à un outil métier B2B).
 *
 * Toutes acceptent une prop `className` (ex: "h-4 w-4") et utilisent
 * `currentColor` : la couleur suit celle du texte parent.
 */

const BASE = { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
const TRAIT = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconSun({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <circle cx="12" cy="12" r="4" {...TRAIT} />
            <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" {...TRAIT} />
        </svg>
    );
}

export function IconMoon({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M20.25 14.5A8.25 8.25 0 0 1 9.5 3.75 8.25 8.25 0 1 0 20.25 14.5Z" {...TRAIT} />
        </svg>
    );
}

export function IconRestore({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M4 4.5v5h5M20 19.5v-5h-5" {...TRAIT} />
            <path d="M4.75 14a7.25 7.25 0 0 0 12.9 3.5M19.25 10a7.25 7.25 0 0 0-12.9-3.5" {...TRAIT} />
        </svg>
    );
}

export function IconTrash({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M4.5 6.75h15M9.75 6.75v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5M18.5 6.75 17.8 19a2 2 0 0 1-2 1.75H8.2a2 2 0 0 1-2-1.75L5.5 6.75" {...TRAIT} />
            <path d="M10.25 10.5v6.25M13.75 10.5v6.25" {...TRAIT} />
        </svg>
    );
}

export function IconGlobe({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <circle cx="12" cy="12" r="8.25" {...TRAIT} />
            <path d="M3.75 12h16.5M12 3.75c2.25 2.25 3.375 5.25 3.375 8.25S14.25 18.75 12 21c-2.25-2.25-3.375-5.25-3.375-8.25S9.75 6 12 3.75Z" {...TRAIT} />
        </svg>
    );
}

export function IconBriefcase({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M9 6.75V5.25a2.25 2.25 0 0 1 2.25-2.25h1.5A2.25 2.25 0 0 1 15 5.25v1.5" {...TRAIT} />
            <rect x="3" y="6.75" width="18" height="12.75" rx="2" {...TRAIT} />
            <path d="M3 12.75h18M10.5 12.75v1.5a1.5 1.5 0 0 0 3 0v-1.5" {...TRAIT} />
        </svg>
    );
}

export function IconGrid({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <rect x="3.75" y="3.75" width="7" height="7" rx="1.25" {...TRAIT} />
            <rect x="13.25" y="3.75" width="7" height="7" rx="1.25" {...TRAIT} />
            <rect x="3.75" y="13.25" width="7" height="7" rx="1.25" {...TRAIT} />
            <rect x="13.25" y="13.25" width="7" height="7" rx="1.25" {...TRAIT} />
        </svg>
    );
}

export function IconTerminal({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <rect x="3" y="4.5" width="18" height="15" rx="2" {...TRAIT} />
            <path d="M7 10l3 2.5-3 2.5M12.5 15h4.5" {...TRAIT} />
        </svg>
    );
}

export function IconLayers({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Z" {...TRAIT} />
            <path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" {...TRAIT} />
        </svg>
    );
}

export function IconColumns({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" {...TRAIT} />
            <path d="M9.5 4.5v15M14.5 4.5v15" {...TRAIT} />
        </svg>
    );
}

export function IconDownload({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M12 3.5v11.25M8 11.25l4 4 4-4" {...TRAIT} />
            <path d="M4.5 16.5v2A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-2" {...TRAIT} />
        </svg>
    );
}

export function IconUpload({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M12 15.25V4M8 7.75l4-4 4 4" {...TRAIT} />
            <path d="M4.5 16.5v2A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-2" {...TRAIT} />
        </svg>
    );
}

export function IconLoader({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" {...TRAIT} />
        </svg>
    );
}

export function IconClipboard({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <rect x="6" y="5" width="12" height="16" rx="1.5" {...TRAIT} />
            <path d="M9.25 5V4a1.25 1.25 0 0 1 1.25-1.25h3A1.25 1.25 0 0 1 14.75 4v1" {...TRAIT} />
            <path d="M9 10.5h6M9 14h6" {...TRAIT} />
        </svg>
    );
}

export function IconImage({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" {...TRAIT} />
            <circle cx="8.5" cy="9.5" r="1.5" {...TRAIT} />
            <path d="M4 17l5-5 4 4 3-3 4 4" {...TRAIT} />
        </svg>
    );
}

export function IconFileText({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M7 3.75h7.25L18 7.5v12.75a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" {...TRAIT} />
            <path d="M9 12h6M9 15.5h6M9 8.5h3" {...TRAIT} />
        </svg>
    );
}

export function IconFile({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M7 3.75h7.25L18 7.5v12.75a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" {...TRAIT} />
            <path d="M14 3.75V7.5h3.75" {...TRAIT} />
        </svg>
    );
}

export function IconFolder({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M3.5 6.75A1.25 1.25 0 0 1 4.75 5.5h4.19c.3 0 .59.12.8.33l1.13 1.13c.21.21.5.33.8.33h6.03a1.25 1.25 0 0 1 1.25 1.25v8.71a1.25 1.25 0 0 1-1.25 1.25H4.75a1.25 1.25 0 0 1-1.25-1.25V6.75Z" {...TRAIT} />
        </svg>
    );
}

export function IconCheck({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M4.5 12.5l5 5 9.5-11" {...TRAIT} />
        </svg>
    );
}

export function IconAlertTriangle({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M10.6 4.4a1.6 1.6 0 0 1 2.8 0l7.7 13.6A1.6 1.6 0 0 1 19.7 20.5H4.3a1.6 1.6 0 0 1-1.4-2.5L10.6 4.4Z" {...TRAIT} />
            <path d="M12 9.5v4.25" {...TRAIT} />
            <circle cx="12" cy="16.75" r="0.1" {...TRAIT} fill="currentColor" />
        </svg>
    );
}

export function IconClock({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <circle cx="12" cy="12" r="8.25" {...TRAIT} />
            <path d="M12 7.5V12l3 2" {...TRAIT} />
        </svg>
    );
}

export function IconSearch({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <circle cx="10.75" cy="10.75" r="6.25" {...TRAIT} />
            <path d="M20 20l-4.35-4.35" {...TRAIT} />
        </svg>
    );
}

export function IconBarChart({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M5 20V10.5M12 20V4.5M19 20v-7" {...TRAIT} />
        </svg>
    );
}

export function IconInbox({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M3.75 12.75h4.25l1.5 2.25h5l1.5-2.25h4.25" {...TRAIT} />
            <path d="M5.5 6.75h13l1.75 6v5A1.25 1.25 0 0 1 19 19H5a1.25 1.25 0 0 1-1.25-1.25v-5l1.75-6Z" {...TRAIT} />
        </svg>
    );
}

export function IconChevronLeft({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M14.5 5.5 8 12l6.5 6.5" {...TRAIT} />
        </svg>
    );
}

export function IconChevronRight({ className = '' }) {
    return (
        <svg className={className} {...BASE}>
            <path d="M9.5 5.5 16 12l-6.5 6.5" {...TRAIT} />
        </svg>
    );
}
