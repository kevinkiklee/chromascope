'use client';

const dots = [
  { color: '#f472b6', radius: 28, duration: 18, delay: 0 },
  { color: '#818cf8', radius: 22, duration: 22, delay: -5 },
  { color: '#22d3ee', radius: 32, duration: 26, delay: -12 },
  { color: '#a78bfa', radius: 18, duration: 20, delay: -8 },
  { color: '#fbbf24', radius: 25, duration: 24, delay: -16 },
];

export function AnimatedVectorscope({
  size = 80,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const center = size / 2;
  const outerR = size / 2 - 2;
  const ring1 = outerR * 0.66;
  const ring2 = outerR * 0.33;
  const lineInset = outerR * 0.1;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      {/* Outer circle */}
      <circle
        cx={center}
        cy={center}
        r={outerR}
        fill="none"
        stroke="rgba(99,102,241,0.15)"
        strokeWidth="1"
      />
      {/* Graticule rings */}
      <circle
        cx={center}
        cy={center}
        r={ring1}
        fill="none"
        stroke="rgba(99,102,241,0.08)"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <circle
        cx={center}
        cy={center}
        r={ring2}
        fill="none"
        stroke="rgba(99,102,241,0.06)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />
      {/* Crosshairs */}
      <line
        x1={center - outerR + lineInset}
        y1={center}
        x2={center + outerR - lineInset}
        y2={center}
        stroke="rgba(99,102,241,0.08)"
        strokeWidth="0.5"
      />
      <line
        x1={center}
        y1={center - outerR + lineInset}
        x2={center}
        y2={center + outerR - lineInset}
        stroke="rgba(99,102,241,0.08)"
        strokeWidth="0.5"
      />
      {/* Skin tone line */}
      <line
        x1={center}
        y1={center}
        x2={center + outerR * 0.35}
        y2={center - outerR * 0.65}
        stroke="rgba(251,191,36,0.4)"
        strokeWidth="1"
      />
      {/* Orbiting dots */}
      {dots.map((dot, i) => {
        const orbitR = (outerR * dot.radius) / 40;
        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={size > 100 ? 2.5 : 1.5}
            fill={dot.color}
            style={{
              ['--orbit-radius' as string]: `${orbitR}px`,
              animation: `orbit ${dot.duration}s linear infinite`,
              animationDelay: `${dot.delay}s`,
              filter: `drop-shadow(0 0 ${size > 100 ? 4 : 2}px ${dot.color})`,
            }}
          />
        );
      })}
    </svg>
  );
}
