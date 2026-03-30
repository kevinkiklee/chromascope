import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Chromascope — Professional Color Analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #09090b 0%, #0f0a1a 50%, #09090b 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Vectorscope circle */}
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            border: '1.5px solid rgba(139,92,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: 40,
            background: 'radial-gradient(circle, rgba(10,10,20,0.8) 0%, rgba(15,10,26,0.4) 100%)',
          }}
        >
          {/* Inner ring */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '1px dashed rgba(139,92,246,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: '1px dashed rgba(139,92,246,0.1)',
              }}
            />
          </div>
          {/* Color dots */}
          <div style={{ position: 'absolute', top: 35, left: 95, width: 10, height: 10, borderRadius: '50%', background: '#f472b6' }} />
          <div style={{ position: 'absolute', top: 70, left: 120, width: 8, height: 8, borderRadius: '50%', background: '#818cf8' }} />
          <div style={{ position: 'absolute', top: 110, left: 65, width: 12, height: 12, borderRadius: '50%', background: '#22d3ee' }} />
          <div style={{ position: 'absolute', top: 80, left: 50, width: 9, height: 9, borderRadius: '50%', background: '#a78bfa' }} />
          <div style={{ position: 'absolute', top: 55, left: 75, width: 14, height: 14, borderRadius: '50%', background: 'rgba(251,191,36,0.6)' }} />
        </div>

        {/* Text */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#f4f4f5',
            letterSpacing: -1,
            marginBottom: 12,
          }}
        >
          Chromascope
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#a1a1aa',
            letterSpacing: 0.5,
          }}
        >
          Professional Color Analysis for Photoshop & Lightroom
        </div>

        {/* Gradient accent line */}
        <div
          style={{
            width: 200,
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #8b5cf6, #6366f1, #06b6d4)',
            marginTop: 32,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
