// @ts-check
// The scope overlay: a black mask with the eyepiece circle and a first-focal-plane mil reticle.
// One mil is 1/1000 of a radian, which is about 10 cm at 100 m and 1 m at 1000 m.

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w CSS pixels
 * @param {number} h CSS pixels
 * @param {number} dpr
 * @param {number} fovDeg vertical field of view
 */
export function drawScope(ctx, w, h, dpr, fovDeg) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = scopeRadius(w, h);

  // Eyepiece mask.
  ctx.fillStyle = '#030405';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill('evenodd');

  // Dark rim inside the glass.
  const rim = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
  rim.addColorStop(0, 'rgba(3, 4, 5, 0)');
  rim.addColorStop(1, 'rgba(3, 4, 5, 0.8)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  const pxPerMil = (h / 2) / Math.tan((fovDeg * Math.PI) / 360) * 0.001;
  ctx.strokeStyle = 'rgba(6, 8, 10, 0.92)';
  ctx.fillStyle = 'rgba(6, 8, 10, 0.92)';

  // Heavy posts from the rim inward.
  const gap = Math.min(R * 0.55, pxPerMil * 6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + R);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - gap);
  ctx.stroke();

  // Fine crosshair.
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - gap, cy); ctx.lineTo(cx + gap, cy);
  ctx.moveTo(cx, cy - gap); ctx.lineTo(cx, cy + gap);
  ctx.stroke();

  // Hash marks every mil, longer every two, with numbers below the cross for holdover.
  ctx.font = '600 10px "Barlow Condensed", "Arial Narrow", sans-serif';
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
      // Half-mil ticks below the cross, where holdover is read.
      if (pxPerMil >= 10) {
        const hd = d - pxPerMil / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 2.5, cy + hd); ctx.lineTo(cx + 2.5, cy + hd);
        ctx.stroke();
      }
    }
  }

  // Centre dot.
  ctx.fillStyle = 'rgba(201, 64, 64, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Scope circle radius in CSS pixels. */
export function scopeRadius(w, h) {
  return Math.min(w, h) * 0.47;
}

/** @param {CanvasRenderingContext2D} ctx */
export function clearScope(ctx, w, h, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
}
