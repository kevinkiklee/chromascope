'use client';

/**
 * SVG illustrations for the marketing homepage.
 * Each renders a stylized vectorscope visualization representing a different feature.
 */

/* ── Shared: base scope circle with graticule ── */
function ScopeBase({ size, children }: { size: number; children: React.ReactNode }) {
  const c = size / 2;
  const r = size / 2 - 4;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id="scope-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0a14" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
      </defs>
      {/* Background */}
      <circle cx={c} cy={c} r={r} fill="url(#scope-bg)" />
      {/* Outer ring */}
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
      {/* Graticule rings */}
      <circle cx={c} cy={c} r={r * 0.66} fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth="0.5" strokeDasharray="4 4" />
      <circle cx={c} cy={c} r={r * 0.33} fill="none" stroke="rgba(99,102,241,0.06)" strokeWidth="0.5" strokeDasharray="3 4" />
      {/* Crosshairs */}
      <line x1={c - r * 0.9} y1={c} x2={c + r * 0.9} y2={c} stroke="rgba(99,102,241,0.07)" strokeWidth="0.5" />
      <line x1={c} y1={c - r * 0.9} x2={c} y2={c + r * 0.9} stroke="rgba(99,102,241,0.07)" strokeWidth="0.5" />
      {/* Hue labels */}
      <text x={c} y={12} textAnchor="middle" fill="rgba(113,113,122,0.6)" fontSize="8" fontFamily="monospace">0°</text>
      <text x={size - 8} y={c + 3} textAnchor="middle" fill="rgba(113,113,122,0.6)" fontSize="8" fontFamily="monospace">90°</text>
      <text x={c} y={size - 6} textAnchor="middle" fill="rgba(113,113,122,0.6)" fontSize="8" fontFamily="monospace">180°</text>
      <text x={10} y={c + 3} textAnchor="middle" fill="rgba(113,113,122,0.6)" fontSize="8" fontFamily="monospace">270°</text>
      {children}
    </svg>
  );
}

/* ── Hero illustration: panel frame with vectorscope ── */
export function HeroIllustration({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Panel frame */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-violet-500/5">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-zinc-900/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono ml-2">Chromascope</span>
        </div>
        {/* Scope area */}
        <div className="flex items-center justify-center p-6 md:p-8">
          <ScopeBase size={240}>
            {/* Skin tone line */}
            <line x1="120" y1="120" x2="162" y2="42" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" />
            {/* Scatter dots — warm cluster */}
            <circle cx="132" cy="88" r="4" fill="rgba(244,114,182,0.7)" />
            <circle cx="126" cy="95" r="3" fill="rgba(244,114,182,0.5)" />
            <circle cx="138" cy="82" r="2.5" fill="rgba(251,146,60,0.6)" />
            <circle cx="140" cy="92" r="3.5" fill="rgba(244,114,182,0.4)" />
            <circle cx="130" cy="78" r="2" fill="rgba(251,191,36,0.5)" />
            {/* Cool cluster */}
            <circle cx="95" cy="140" r="3.5" fill="rgba(56,189,248,0.6)" />
            <circle cx="88" cy="148" r="3" fill="rgba(129,140,248,0.5)" />
            <circle cx="100" cy="150" r="2.5" fill="rgba(34,211,238,0.4)" />
            <circle cx="82" cy="135" r="2" fill="rgba(99,102,241,0.5)" />
            {/* Neutral cluster */}
            <circle cx="115" cy="115" r="5" fill="rgba(251,191,36,0.35)" />
            <circle cx="122" cy="110" r="3" fill="rgba(251,191,36,0.25)" />
            <circle cx="118" cy="125" r="2.5" fill="rgba(167,139,250,0.3)" />
          </ScopeBase>
        </div>
        {/* Bottom bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-white/[0.04] bg-zinc-900/50">
          <span className="text-[9px] text-violet-400 font-mono uppercase tracking-wider">YCbCr 709</span>
          <span className="text-[9px] text-zinc-600">•</span>
          <span className="text-[9px] text-zinc-500 font-mono">Scatter</span>
          <span className="text-[9px] text-zinc-600">•</span>
          <span className="text-[9px] text-zinc-500 font-mono">1920×1080</span>
        </div>
      </div>
    </div>
  );
}

/* ── Color Spaces: three mini scopes side by side ── */
export function ColorSpacesIllustration({ className = '' }: { className?: string }) {
  const miniSize = 140;
  const spaces = [
    { label: 'YCbCr', dots: [{ cx: 78, cy: 52, r: 3, color: 'rgba(244,114,182,0.7)' }, { cx: 65, cy: 60, r: 2.5, color: 'rgba(251,146,60,0.6)' }, { cx: 72, cy: 80, r: 4, color: 'rgba(251,191,36,0.4)' }, { cx: 60, cy: 75, r: 2, color: 'rgba(56,189,248,0.5)' }] },
    { label: 'CIE LUV', dots: [{ cx: 82, cy: 48, r: 3.5, color: 'rgba(244,114,182,0.6)' }, { cx: 58, cy: 70, r: 3, color: 'rgba(129,140,248,0.5)' }, { cx: 75, cy: 85, r: 2.5, color: 'rgba(34,211,238,0.5)' }, { cx: 68, cy: 58, r: 4, color: 'rgba(251,191,36,0.45)' }] },
    { label: 'HSL', dots: [{ cx: 90, cy: 55, r: 3, color: 'rgba(244,114,182,0.7)' }, { cx: 50, cy: 65, r: 3, color: 'rgba(56,189,248,0.6)' }, { cx: 70, cy: 90, r: 3.5, color: 'rgba(74,222,128,0.5)' }, { cx: 75, cy: 60, r: 2.5, color: 'rgba(251,191,36,0.5)' }] },
  ];

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 p-6 ${className}`}>
      <div className="flex justify-center gap-4 flex-wrap">
        {spaces.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-2">
            <ScopeBase size={miniSize}>
              {s.dots.map((d, j) => (
                <circle key={j} cx={d.cx} cy={d.cy} r={d.r} fill={d.color} />
              ))}
            </ScopeBase>
            <span className="text-[10px] text-zinc-500 font-mono">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Density Modes: scatter vs heatmap vs bloom ── */
export function DensityModesIllustration({ className = '' }: { className?: string }) {
  const size = 140;
  const c = size / 2;
  const r = size / 2 - 4;

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 p-6 ${className}`}>
      <div className="flex justify-center gap-4 flex-wrap">
        {/* Scatter */}
        <div className="flex flex-col items-center gap-2">
          <ScopeBase size={size}>
            {[
              { cx: 78, cy: 52, r: 2 }, { cx: 65, cy: 60, r: 1.5 }, { cx: 72, cy: 80, r: 2 },
              { cx: 85, cy: 68, r: 1.5 }, { cx: 60, cy: 75, r: 1 }, { cx: 90, cy: 58, r: 1.5 },
              { cx: 55, cy: 85, r: 1 }, { cx: 75, cy: 65, r: 2 }, { cx: 68, cy: 72, r: 1.5 },
              { cx: 82, cy: 78, r: 1 }, { cx: 70, cy: 55, r: 1.5 }, { cx: 62, cy: 68, r: 2 },
              { cx: 88, cy: 62, r: 1 }, { cx: 73, cy: 88, r: 1.5 }, { cx: 58, cy: 58, r: 1 },
            ].map((d, j) => (
              <circle key={j} cx={d.cx} cy={d.cy} r={d.r} fill="rgba(167,139,250,0.6)" />
            ))}
          </ScopeBase>
          <span className="text-[10px] text-zinc-500 font-mono">Scatter</span>
        </div>
        {/* Heatmap */}
        <div className="flex flex-col items-center gap-2">
          <ScopeBase size={size}>
            <defs>
              <radialGradient id="heat-center">
                <stop offset="0%" stopColor="rgba(239,68,68,0.5)" />
                <stop offset="40%" stopColor="rgba(251,146,60,0.3)" />
                <stop offset="70%" stopColor="rgba(251,191,36,0.15)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <radialGradient id="heat-secondary">
                <stop offset="0%" stopColor="rgba(251,146,60,0.35)" />
                <stop offset="60%" stopColor="rgba(251,191,36,0.1)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <circle cx={c + 5} cy={c - 15} r="28" fill="url(#heat-center)" />
            <circle cx={c - 18} cy={c + 10} r="20" fill="url(#heat-secondary)" />
            <circle cx={c + 15} cy={c + 20} r="14" fill="url(#heat-secondary)" />
          </ScopeBase>
          <span className="text-[10px] text-zinc-500 font-mono">Heatmap</span>
        </div>
        {/* Bloom */}
        <div className="flex flex-col items-center gap-2">
          <ScopeBase size={size}>
            <defs>
              <filter id="bloom-blur">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {/* Bloom glow layer */}
            <circle cx={c + 5} cy={c - 12} r="18" fill="rgba(167,139,250,0.25)" filter="url(#bloom-blur)" />
            <circle cx={c - 15} cy={c + 8} r="12" fill="rgba(56,189,248,0.2)" filter="url(#bloom-blur)" />
            <circle cx={c + 12} cy={c + 18} r="10" fill="rgba(244,114,182,0.2)" filter="url(#bloom-blur)" />
            {/* Sharp dots on top */}
            <circle cx={c + 5} cy={c - 12} r="3" fill="rgba(167,139,250,0.8)" />
            <circle cx={c - 15} cy={c + 8} r="2.5" fill="rgba(56,189,248,0.7)" />
            <circle cx={c + 12} cy={c + 18} r="2" fill="rgba(244,114,182,0.7)" />
          </ScopeBase>
          <span className="text-[10px] text-zinc-500 font-mono">Bloom</span>
        </div>
      </div>
    </div>
  );
}

/* ── Color Harmony: scope with overlay zones ── */
export function HarmonyIllustration({ className = '' }: { className?: string }) {
  const size = 260;
  const c = size / 2;
  const r = size / 2 - 4;

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 p-6 flex justify-center ${className}`}>
      <ScopeBase size={size}>
        {/* Complementary zone wedges */}
        <path
          d={`M ${c} ${c} L ${c + r * 0.9 * Math.cos(-Math.PI / 6)} ${c + r * 0.9 * Math.sin(-Math.PI / 6)} A ${r * 0.9} ${r * 0.9} 0 0 1 ${c + r * 0.9 * Math.cos(Math.PI / 6)} ${c + r * 0.9 * Math.sin(Math.PI / 6)} Z`}
          fill="rgba(139,92,246,0.08)"
          stroke="rgba(139,92,246,0.2)"
          strokeWidth="0.5"
        />
        <path
          d={`M ${c} ${c} L ${c + r * 0.9 * Math.cos(5 * Math.PI / 6)} ${c + r * 0.9 * Math.sin(5 * Math.PI / 6)} A ${r * 0.9} ${r * 0.9} 0 0 1 ${c + r * 0.9 * Math.cos(7 * Math.PI / 6)} ${c + r * 0.9 * Math.sin(7 * Math.PI / 6)} Z`}
          fill="rgba(6,182,212,0.08)"
          stroke="rgba(6,182,212,0.2)"
          strokeWidth="0.5"
        />
        {/* Skin tone line */}
        <line x1={c} y1={c} x2={c + r * 0.4} y2={c - r * 0.75} stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" />
        {/* Dots in zones */}
        <circle cx={c + 45} cy={c - 8} r="4" fill="rgba(244,114,182,0.7)" />
        <circle cx={c + 38} cy={c + 5} r="3" fill="rgba(251,146,60,0.6)" />
        <circle cx={c + 50} cy={c - 18} r="2.5" fill="rgba(244,114,182,0.5)" />
        <circle cx={c - 42} cy={c + 12} r="3.5" fill="rgba(56,189,248,0.6)" />
        <circle cx={c - 35} cy={c + 22} r="2.5" fill="rgba(34,211,238,0.5)" />
        <circle cx={c - 48} cy={c + 5} r="2" fill="rgba(129,140,248,0.5)" />
        {/* Zone labels */}
        <text x={c + 60} y={c + 4} fill="rgba(139,92,246,0.5)" fontSize="8" fontFamily="monospace">warm</text>
        <text x={c - 80} y={c + 16} fill="rgba(6,182,212,0.5)" fontSize="8" fontFamily="monospace">cool</text>
      </ScopeBase>
    </div>
  );
}

/* ── Banner: large scope in a full panel mockup ── */
export function BannerIllustration({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/80 overflow-hidden shadow-2xl shadow-violet-500/5">
        {/* App chrome */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-zinc-950/80">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
          </div>
          <span className="text-[9px] text-zinc-600 font-mono ml-2">Adobe Photoshop — DSC_4821.ARW</span>
          <div className="ml-auto flex gap-3">
            <span className="text-[9px] text-zinc-600 font-mono">Layers</span>
            <span className="text-[9px] text-violet-400 font-mono">Chromascope</span>
            <span className="text-[9px] text-zinc-600 font-mono">History</span>
          </div>
        </div>
        {/* Content area */}
        <div className="flex">
          {/* "Canvas" area */}
          <div className="flex-1 bg-zinc-950 flex items-center justify-center min-h-[260px] md:min-h-[340px] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-zinc-950 to-blue-900/10" />
            <div className="relative text-center">
              <div className="text-zinc-700 text-xs font-mono">image canvas</div>
            </div>
          </div>
          {/* Panel */}
          <div className="w-[200px] md:w-[260px] border-l border-white/[0.04] bg-zinc-900/50 flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-zinc-300 font-medium">Chromascope</span>
              <span className="text-[8px] text-violet-400 font-mono">LIVE</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-3">
              <ScopeBase size={180}>
                <line x1="90" y1="90" x2="118" y2="30" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" />
                <circle cx="102" cy="65" r="3.5" fill="rgba(244,114,182,0.7)" />
                <circle cx="96" cy="72" r="2.5" fill="rgba(251,146,60,0.6)" />
                <circle cx="108" cy="60" r="2" fill="rgba(244,114,182,0.5)" />
                <circle cx="75" cy="105" r="3" fill="rgba(56,189,248,0.6)" />
                <circle cx="68" cy="112" r="2.5" fill="rgba(129,140,248,0.5)" />
                <circle cx="88" cy="88" r="4" fill="rgba(251,191,36,0.35)" />
                <circle cx="95" cy="82" r="2.5" fill="rgba(251,191,36,0.25)" />
              </ScopeBase>
            </div>
            {/* Controls */}
            <div className="px-3 py-2 border-t border-white/[0.04] flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-[9px] text-zinc-500 font-mono">Space</span>
                <span className="text-[9px] text-violet-400 font-mono">YCbCr 709</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-zinc-500 font-mono">Density</span>
                <span className="text-[9px] text-zinc-400 font-mono">Scatter</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-zinc-500 font-mono">Overlay</span>
                <span className="text-[9px] text-zinc-400 font-mono">Complementary</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
