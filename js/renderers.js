// Canvas renderers. Pure of app state: each takes a context, the canvas CSS
// dimensions, the angle(s) to display, and a theme (colors pulled from CSS).
// All geometry is derived from the canvas size with clamps, so bubbles and
// rails scale sanely from tiny to large canvases.
//
// Visual language: a dark precision instrument / HUD. A faint measurement grid
// and corner registration marks sit under bold reticle rules and graduated
// ticks; the bubble glows green when level and alarm-red when off.

import { clamp } from './angles.js';
import { BULLSEYE_MAX_DEG, TORPEDO_MAX_DEG, FLAT_THRESHOLD_DEG } from './config.js';

const LINE = { hair: 1, thin: 2, thick: 3 };

// Corner registration marks (L-shaped brackets) — a HUD framing cue.
function registrationMarks(ctx, w, h, theme) {
  const m = Math.max(8, Math.min(w, h) * 0.05);
  const inset = 5;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = LINE.thin;
  const corners = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  ctx.beginPath();
  for (const [x, y, sx, sy] of corners) {
    ctx.moveTo(x, y + sy * m); ctx.lineTo(x, y); ctx.lineTo(x + sx * m, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Draw a filled bubble with a colored glow and a crisp outline.
function drawBubble(ctx, x, y, r, color, theme) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 1.1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fill(); // second pass intensifies the glow
  ctx.restore();

  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = LINE.thick;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  // inner tick cross for a machined look
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = theme.bg || '#000';
  ctx.lineWidth = LINE.thin;
  const t = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(x - t, y); ctx.lineTo(x + t, y);
  ctx.moveTo(x, y - t); ctx.lineTo(x, y + t);
  ctx.stroke();
  ctx.restore();
}

// 2-axis bullseye vial (phone flat). xDeg = left/right, yDeg = front/back.
export function drawBullseye(ctx, { w, h }, xDeg, yDeg, theme) {
  if (w <= 0 || h <= 0) return;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const margin = Math.max(10, Math.min(w, h) * 0.05);
  const R = Math.min(w, h) / 2 - margin;
  if (R <= 0) return;

  const targetR = R * 0.2;      // center target reticle half-size
  const travel = R * 0.72;      // bubble travel radius at max deflection
  const bubbleR = clamp(R * 0.17, 6, R * 0.5);

  registrationMarks(ctx, w, h, theme);

  // faint measurement grid: concentric rings + fine crosshair
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = LINE.hair;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();
  ctx.restore();

  // bold main crosshair through the center
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = LINE.thin;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // outer ring
  ctx.lineWidth = LINE.thick;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // graduated ticks every 30 degrees around the ring
  ctx.lineWidth = LINE.thin;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const major = a % 90 === 0;
    const t = major ? R * 0.12 : R * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
    ctx.lineTo(cx + Math.cos(rad) * (R - t), cy + Math.sin(rad) * (R - t));
    ctx.stroke();
  }

  const flat = Math.abs(xDeg) < FLAT_THRESHOLD_DEG && Math.abs(yDeg) < FLAT_THRESHOLD_DEG;

  // center target reticle — brightens green when level
  ctx.strokeStyle = flat ? theme.good : theme.ink;
  ctx.globalAlpha = flat ? 1 : 0.7;
  ctx.lineWidth = LINE.thin;
  ctx.strokeRect(cx - targetR, cy - targetR, targetR * 2, targetR * 2);
  ctx.globalAlpha = 1;

  const px = clamp(xDeg / BULLSEYE_MAX_DEG, -1, 1) * travel;
  const py = clamp(yDeg / BULLSEYE_MAX_DEG, -1, 1) * travel;
  drawBubble(ctx, cx + px, cy + py, bubbleR, flat ? theme.good : theme.bad, theme);
}

// 1-axis torpedo vial (phone on-edge). deg = tilt for this axis.
export function drawTorpedo(ctx, { w, h }, deg, theme) {
  if (w <= 0 || h <= 0) return;
  ctx.clearRect(0, 0, w, h);

  const midY = h / 2;
  const bubbleR = clamp(h * 0.28, 7, 26);
  const pad = bubbleR + 8;                 // keep the bubble off the edges
  const travel = Math.max(w / 2 - pad, 8); // never negative on a narrow canvas
  const majorTick = clamp(h * 0.32, 10, 26);
  const minorTick = majorTick * 0.5;

  registrationMarks(ctx, w, h, theme);

  const flat = Math.abs(deg) < FLAT_THRESHOLD_DEG;

  // center "gate": the level target window between two bold posts
  const gateHalf = bubbleR * 1.15;
  ctx.save();
  ctx.globalAlpha = flat ? 0.16 : 0.08;
  ctx.fillStyle = flat ? theme.good : theme.ink;
  ctx.fillRect(w / 2 - gateHalf, midY - majorTick, gateHalf * 2, majorTick * 2);
  ctx.restore();

  ctx.strokeStyle = flat ? theme.good : theme.ink;
  ctx.globalAlpha = flat ? 1 : 0.7;
  ctx.lineWidth = LINE.thin;
  ctx.beginPath();
  ctx.moveTo(w / 2 - gateHalf, midY - majorTick); ctx.lineTo(w / 2 - gateHalf, midY + majorTick);
  ctx.moveTo(w / 2 + gateHalf, midY - majorTick); ctx.lineTo(w / 2 + gateHalf, midY + majorTick);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // rail
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = LINE.thin;
  ctx.beginPath();
  ctx.moveTo(pad, midY); ctx.lineTo(w - pad, midY);
  ctx.stroke();

  // graduation ticks (center tick emphasized)
  for (let i = -4; i <= 4; i++) {
    const tx = w / 2 + (i / 4) * travel;
    const th = i === 0 ? majorTick : minorTick;
    ctx.lineWidth = i === 0 ? LINE.thick : LINE.hair + 1;
    ctx.globalAlpha = i === 0 ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(tx, midY - th); ctx.lineTo(tx, midY + th);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const bx = w / 2 + clamp(deg / TORPEDO_MAX_DEG, -1, 1) * travel;
  drawBubble(ctx, bx, midY, bubbleR, flat ? theme.good : theme.bad, theme);
}
