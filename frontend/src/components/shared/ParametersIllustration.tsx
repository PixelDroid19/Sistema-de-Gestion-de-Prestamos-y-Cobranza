/**
 * Decorative illustration for the new-credit parameters panel.
 * Colors come from CSS variables on `.new-credit-parameters-illustration`.
 */
export function ParametersIllustration() {
  return (
    <div className="new-credit-parameters-illustration" aria-hidden="true">
      <svg
        className="new-credit-parameters-illustration__svg"
        viewBox="0 0 360 188"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          <filter id="nc-illus-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
          <linearGradient id="nc-illus-bar-a" x1="0" y1="1" x2="0" y2="0">
            <stop stopColor="var(--illus-bar-strong)" />
            <stop offset="1" stopColor="var(--illus-bar-soft)" />
          </linearGradient>
        </defs>

        {/* Ambient sparkles */}
        <path
          className="new-credit-parameters-illustration__sparkle"
          d="M44 58 L45.2 61.4 L48.6 62.6 L45.2 63.8 L44 67.2 L42.8 63.8 L39.4 62.6 L42.8 61.4 Z"
        />
        <path
          className="new-credit-parameters-illustration__sparkle"
          d="M312 42 L313.1 45.1 L316.2 46.2 L313.1 47.3 L312 50.4 L310.9 47.3 L307.8 46.2 L310.9 45.1 Z"
        />

        {/* Branch + leaves */}
        <g className="new-credit-parameters-illustration__branch">
          <path
            d="M52 162 C54 118 62 96 78 78"
            stroke="var(--illus-stem)"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <ellipse cx="38" cy="132" rx="11" ry="16" transform="rotate(-28 38 132)" fill="var(--illus-leaf-1)" />
          <ellipse cx="48" cy="108" rx="10" ry="15" transform="rotate(-12 48 108)" fill="var(--illus-leaf-2)" />
          <ellipse cx="60" cy="86" rx="9" ry="14" transform="rotate(8 60 86)" fill="var(--illus-leaf-3)" />
          <ellipse cx="74" cy="68" rx="8" ry="13" transform="rotate(22 74 68)" fill="var(--illus-leaf-4)" />
          <ellipse cx="88" cy="54" rx="7" ry="11" transform="rotate(34 88 54)" fill="var(--illus-leaf-5)" />
        </g>

        {/* Report card */}
        <g transform="translate(198 94) rotate(-7)">
          <rect
            x="-58"
            y="-62"
            width="116"
            height="132"
            rx="14"
            fill="var(--bg-surface)"
            stroke="var(--border-subtle)"
            strokeWidth="1"
            filter="url(#nc-illus-card-shadow)"
          />
          <rect x="-44" y="-48" width="34" height="5" rx="2.5" fill="var(--illus-line-strong)" />
          <rect x="-44" y="-38" width="52" height="4" rx="2" fill="var(--illus-line-soft)" />

          {/* Grid lines */}
          <line x1="-44" y1="8" x2="48" y2="8" stroke="var(--illus-grid)" strokeWidth="1" />
          <line x1="-44" y1="-4" x2="48" y2="-4" stroke="var(--illus-grid)" strokeWidth="1" />
          <line x1="-44" y1="-16" x2="48" y2="-16" stroke="var(--illus-grid)" strokeWidth="1" />

          {/* Bars */}
          <rect x="-38" y="2" width="10" height="28" rx="3" fill="url(#nc-illus-bar-a)" opacity="0.55" />
          <rect x="-22" y="-10" width="10" height="40" rx="3" fill="var(--illus-bar-strong)" />
          <rect x="-6" y="-2" width="10" height="32" rx="3" fill="url(#nc-illus-bar-a)" opacity="0.72" />
          <rect x="10" y="-18" width="10" height="48" rx="3" fill="var(--illus-bar-strong)" opacity="0.9" />

          {/* Trend line */}
          <path
            d="M-34 18 L-18 2 L-2 10 L14 -6"
            stroke="var(--illus-line-chart)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Footer pill + check */}
          <rect x="-44" y="38" width="44" height="13" rx="6.5" fill="var(--bg-surface)" stroke="var(--border-subtle)" strokeWidth="1" />
          <rect x="-38" y="42.5" width="22" height="4" rx="2" fill="var(--illus-bar-soft)" />
          <circle cx="22" cy="44.5" r="7.5" fill="var(--illus-bar-strong)" />
          <path
            d="M19.2 44.5 L21.2 46.5 L25.2 42.2"
            stroke="var(--bg-elevated)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
