// @ts-check
// The scope overlay: the world outside the lens dimmed (not black), a machined scope tube
// ring with a ribbed zoom ring, lens edge shading and glare, and a first-focal-plane mil
// reticle. One mil is 1/1000 of a radian: about 10 cm at 100 m.

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w CSS pixels
 * @param {number} h CSS pixels
 * @param {number} dpr
 * @param {number} fovDeg vertical field of view
 * @param {{ onTarget?: boolean, zoom?: number }} [opts]
 */
export function drawScope(ctx, w, h, dpr, fovDeg, opts = {}) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = scopeRadius(w, h);
  const ring = R * 0.16;

  // Outside the eyepiece: the world, heavily dimmed, so the scene still reads around the tube.
  ctx.fillStyle = 'rgba(4, 6, 8, 0.86)';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, R + ring, 0, Math.PI * 2);
  ctx.fill('evenodd');

  // Scope tube ring: dark anodised metal with a soft highlight.
  const tube = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R + ring);
  tube.addColorStop(0, '#3a4048');
  tube.addColorStop(0.75, '#1b1f24');
  tube.addColorStop(1, '#0b0d10');
  ctx.fillStyle = tube;
  ctx.beginPath();
  ctx.arc(cx, cy, R + ring, 0, Math.PI * 2);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.fill();

  // Ribbed zoom ring on the left of the tube.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R + ring, Math.PI * 0.72, Math.PI * 1.28);
  ctx.arc(cx, cy, R + ring * 0.25, Math.PI * 1.28, Math.PI * 0.72, true);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 2;
  for (let a = Math.PI * 0.72; a < Math.PI * 1.28; a += 0.035) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + ring * 0.25), cy + Math.sin(a) * (R + ring * 0.25));
    ctx.lineTo(cx + Math.cos(a) * (R + ring), cy + Math.sin(a) * (R + ring));
    ctx.stroke();
  }
  ctx.restore();

  // Thin bright bevel where metal meets glass.
  ctx.strokeStyle = 'rgba(160, 175, 190, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
  ctx.stroke();

  // Lens edge: darkening toward the rim, plus a faint cool glare in the upper left.
  const rim = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rim.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  const glare = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.6);
  glare.addColorStop(0, 'rgba(190, 215, 255, 0.10)');
  glare.addColorStop(1, 'rgba(190, 215, 255, 0)');
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // Reticle.
  const pxPerMil = (h / 2) / Math.tan((fovDeg * Math.PI) / 360) * 0.001;
  const ink = 'rgba(8, 10, 12, 0.95)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  const gap = Math.min(R * 0.55, pxPerMil * 6);
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + R);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - gap);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - gap, cy); ctx.lineTo(cx + gap, cy);
  ctx.moveTo(cx, cy - gap); ctx.lineTo(cx, cy + gap);
  ctx.stroke();

  ctx.font = '600 10px "Rajdhani", "Arial Narrow", sans-serif';
  ctx.textBaseline = 'middle';
  if (pxPerMil >= 3) {
    for (let i = 1; i <= 10; i++) {
      const d = i * pxPerMil;
      if (d > gap) break;
      const long = i % 2 === 0;
      const half = long ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy + d); ctx.lineTo(cx + half, cy + d);
      ctx.moveTo(cx - half, cy - d); ctx.lineTo(cx + half, cy - d);
      ctx.moveTo(cx + d, cy - half); ctx.lineTo(cx + d, cy + half);
      ctx.moveTo(cx - d, cy - half); ctx.lineTo(cx - d, cy + half);
      ctx.stroke();
      if (long) ctx.fillText(String(i), cx + 10, cy + d);
      if (pxPerMil >= 10) {
        const hd = d - pxPerMil / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 2.5, cy + hd); ctx.lineTo(cx + 2.5, cy + hd);
        ctx.stroke();
      }
    }
  }

  // Centre: red dot, or a green ring when the cross is on the target.
  if (opts.onTarget) {
    ctx.strokeStyle = 'rgba(70, 220, 120, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(10, Math.min(26, pxPerMil * 2.2)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70, 220, 120, 0.95)';
  } else {
    ctx.fillStyle = 'rgba(230, 70, 70, 0.95)';
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Magnification on the zoom ring.
  if (opts.zoom) {
    ctx.fillStyle = 'rgba(255, 200, 110, 0.9)';
    ctx.font = '700 13px "Rajdhani", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.zoom.toFixed(1) + '×', cx - R - ring * 0.6, cy);
    ctx.textAlign = 'start';
  }
}

/** Scope circle (glass) radius in CSS pixels. */
export function scopeRadius(w, h) {
  return Math.min(w, h) * 0.41;
}

/** @param {CanvasRenderingContext2D} ctx */
export function clearScope(ctx, w, h, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
}
