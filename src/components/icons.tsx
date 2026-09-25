type IconProps = { className?: string };

const base = "w-5 h-5";

export function IconBox({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M21 8l-9-5-9 5 9 5 9-5Z" />
<path d="M3 8v8l9 5 9-5V8" />
<path d="M12 13v8" />
</svg>
);
}

export function IconTruck({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="1" y="6" width="13" height="11" rx="1.5" />
<path d="M14 10h4.5l3.5 3.5V17h-8v-7Z" />
<circle cx="6" cy="19" r="1.8" />
<circle cx="17.5" cy="19" r="1.8" />
</svg>
);
}

export function IconRefresh({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
<path d="M21 3v5h-5" />
<path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
<path d="M3 21v-5h5" />
</svg>
);
}

export function IconChart({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M3 3v18h18" />
<rect x="7" y="12" width="3" height="6" rx="0.5" />
<rect x="12.5" y="8" width="3" height="10" rx="0.5" />
<rect x="18" y="5" width="3" height="13" rx="0.5" />
</svg>
);
}

export function IconUser({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<circle cx="12" cy="8" r="4" />
<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
</svg>
);
}

export function IconUsers({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<circle cx="9" cy="8" r="3.2" />
<path d="M2.5 19c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6" />
<path d="M16 4.5c1.7 0.3 3 1.8 3 3.5s-1.3 3.2-3 3.5" />
<path d="M18.5 13c2 0.4 3.5 2 3.5 4" />
</svg>
);
}

export function IconLogout({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
<path d="M16 17l5-5-5-5" />
<path d="M21 12H9" />
</svg>
);
}

export function IconAlert({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
<path d="M12 9v4" />
<path d="M12 17h.01" />
</svg>
);
}

export function IconCheck({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M20 6 9 17l-5-5" />
</svg>
);
}

export function IconClock({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<circle cx="12" cy="12" r="9" />
<path d="M12 7v5l3.5 2" />
</svg>
);
}

export function IconPill({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
<path d="M8.5 8.5 15.5 15.5" />
</svg>
);
}

export function IconApple({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M12 8c-3 0-5 2.3-5 5.8 0 3.6 2.4 7.2 4.4 7.2.9 0 1.3-.5 2.1-.5s1.2.5 2.1.5c1.7 0 3.5-2.7 4.2-4.7-2.4-1-2.9-4.3-.6-5.9-1-1.4-2.5-2.2-3.9-2.2-1.1 0-1.7.5-2.3.5s-1.4-.6-2-.6Z" />
<path d="M12 8c0-1.7.9-3.2 2.3-3.9" />
</svg>
);
}

export function IconMapPin({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
<circle cx="12" cy="10" r="2.8" />
</svg>
);
}

export function IconArrowRight({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M5 12h14" />
<path d="M13 6l6 6-6 6" />
</svg>
);
}

export function IconClipboard({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="5" y="4" width="14" height="17" rx="2" />
<rect x="9" y="2.3" width="6" height="3.4" rx="1" />
<path d="M8.5 11h7" />
<path d="M8.5 15h7" />
</svg>
);
}

export function IconSignature({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M3 17c2-1 3.5-3.4 4.2-5.6.5-1.7 2.6-1.7 2.9 0 .3 1.7 1.6 1.9 2.4.6 1-1.6 3-1.6 3.4.3.3 1.5 2.1 1.7 3.1.4" />
<path d="M3 21h18" />
</svg>
);
}

export function IconGrid({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="3" y="3" width="8" height="8" rx="1.5" />
<rect x="13" y="3" width="8" height="8" rx="1.5" />
<rect x="3" y="13" width="8" height="8" rx="1.5" />
<rect x="13" y="13" width="8" height="8" rx="1.5" />
</svg>
);
}

export function IconMenu({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M3 6h18" />
<path d="M3 12h18" />
<path d="M3 18h18" />
</svg>
);
}

export function IconCalendar({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="3" y="5" width="18" height="16" rx="2" />
<path d="M16 3v4" />
<path d="M8 3v4" />
<path d="M3 10h18" />
<path d="M8 14h.01" />
<path d="M12 14h.01" />
<path d="M16 14h.01" />
</svg>
);
}

export function IconCash({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="2" y="6" width="20" height="12" rx="2" />
<circle cx="12" cy="12" r="3" />
<path d="M6 9v.01" />
<path d="M18 15v.01" />
</svg>
);
}

export function IconBuilding({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<rect x="4" y="3" width="16" height="18" rx="1.5" />
<path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01" />
<path d="M9.5 21v-3h5v3" />
</svg>
);
}

export function IconBarcode({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 5v14" />
      <path d="M8 5v14" />
      <path d="M11 5v14" />
      <path d="M15 5v14" />
      <path d="M18 5v14" />
      <path d="M20 5v14" />
    </svg>
  );
}

export function IconStar({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2.5l2.8 5.9 6.4.7-4.7 4.4 1.2 6.4L12 16.9l-5.7 3 1.2-6.4-4.7-4.4 6.4-.7L12 2.5Z" />
    </svg>
  );
}

export function IconClipboardCheck({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3.4" rx="1" />
      <path d="M8.5 13.5l2 2 4.5-4.5" />
    </svg>
  );
}

export function IconStethoscope({ className = base }: IconProps) {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M5 3v6a4 4 0 0 0 8 0V3" />
<path d="M9 15v2a5 5 0 0 0 10 0v-2.5" />
<circle cx="19" cy="10.5" r="2" />
</svg>
);
}
