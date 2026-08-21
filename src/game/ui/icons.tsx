// Inline SVG only — no icon package, no emoji. Every icon inherits currentColor.

export function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 16" aria-hidden="true">
      {/* snack bag: crimped top, puffed body, crimped bottom */}
      <path
        d="M2.4 1h7.2l-.7 2.1c1.1 1.1 1.6 2.6 1.6 4.6s-.5 4.1-1.4 5.2l.6 2.1H2.3l.6-2.1C2 11.8 1.5 10 1.5 7.7s.5-3.5 1.6-4.6L2.4 1Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 7V5.2a3 3 0 0 1 6 0V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="3.2" y="7" width="9.6" height="7" rx="1.8" fill="currentColor" />
    </svg>
  )
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="m3.5 8.6 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.6 13 8l-9 5.4V2.6Z" fill="currentColor" />
    </svg>
  )
}

export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="3" width="3" height="10" rx="1.2" fill="currentColor" />
      <rect x="9" y="3" width="3" height="10" rx="1.2" fill="currentColor" />
    </svg>
  )
}

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M9.5 3.5 5 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function JumpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4 5.6 10h4v6.2h4.8V10h4L12 3.4Z"
        fill="currentColor"
      />
      <rect x="4" y="19" width="16" height="2.4" rx="1.2" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

export function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path
        d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
