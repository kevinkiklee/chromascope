// packages/core/src/overlays/skin-tone-line.ts

export const SKIN_TONE_ANGLE = (123 * Math.PI) / 180;

export function renderSkinToneLine(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  const cosA = Math.cos(SKIN_TONE_ANGLE);
  const sinA = -Math.sin(SKIN_TONE_ANGLE);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 180, 120, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cosA * maxR, cy + sinA * maxR);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
