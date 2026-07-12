// Canvas renderers. Pure of app state: each takes a context, the canvas CSS
// dimensions, the angle(s) to display, and a theme (colors pulled from CSS).
// All geometry is derived from the canvas size with clamps, so bubbles and
// rails scale sanely from tiny to large canvases.
//
// Visual language: Swiss / International-style brutalism. Flat black ink rules
// on paper — no gradients, shadows or glows. The bubble roams as a solid ink
// disk; when the axis is level it snaps to the burnt-orange accent and the
// center target fills to match, so "level" reads as a bold accent event.

import { clamp } from './angles.js';
import { BULLSEYE_MAX_DEG, TORPEDO_MAX_DEG, FLAT_THRESHOLD_DEG } from './config.js';

const THICK = 3;
const THIN = 2;

// Solid disk: ink while roaming, accent when level. Always a hard ink outline
// so the accent bubble still reads as a crisp object on paper.
function drawBubble(ctx, x, y, r, flat, theme) {
  ctx.fillStyle = flat ? theme.accent : theme.ink;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = THICK;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

// 2-axis bullseye vial (phone flat). xDeg = left/right, yDeg = front/back.
export function drawBullseye(ctx, { w, h }, xDeg, yDeg, theme) {
  if (w <= 0 || h <= 0) return;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const margin = Math.max(10, Math.min(w, h) * 0.06);
  const R = Math.min(w, h) / 2 - margin;
  if (R <= 0) return;

  const targetR = R * 0.22;                     // center target half-size
  const travel = R * 0.72;                       // bubble travel at max deflection
  const bubbleR = clamp(R * 0.17, 6, R * 0.5);

  const flat = Math.abs(xDeg) < FLAT_THRESHOLD_DEG && Math.abs(yDeg) < FLAT_THRESHOLD_DEG;

  ctx.lineCap = 'butt';

  // full-bleed crosshair
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = THIN;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // outer ring
  ctx.lineWidth = THICK;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // four bold registration ticks at N/E/S/W
  ctx.lineWidth = THICK;
  for (let a = 0; a < 360; a += 90) {
    const rad = (a * Math.PI) / 180, t = R * 0.13;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
    ctx.lineTo(cx + Math.cos(rad) * (R - t), cy + Math.sin(rad) * (R - t));
    ctx.stroke();
  }

  // center target — fills solid accent when level
  if (flat) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(cx - targetR, cy - targetR, targetR * 2, targetR * 2);
  }
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = THIN;
  ctx.strokeRect(cx - targetR, cy - targetR, targetR * 2, targetR * 2);

  const px = clamp(xDeg / BULLSEYE_MAX_DEG, -1, 1) * travel;
  const py = clamp(yDeg / BULLSEYE_MAX_DEG, -1, 1) * travel;
  drawBubble(ctx, cx + px, cy + py, bubbleR, flat, theme);
}

// 1-axis torpedo vial (phone on-edge). deg = tilt for this axis.
export function drawTorpedo(ctx, { w, h }, deg, theme) {
  if (w <= 0 || h <= 0) return;
  ctx.clearRect(0, 0, w, h);

  const midY = h / 2;
  const bubbleR = clamp(h * 0.28, 7, 26);
  const pad = bubbleR + 10;                    // keep the bubble off the edges
  const travel = Math.max(w / 2 - pad, 8);     // never negative on a narrow canvas
  const majorTick = clamp(h * 0.34, 10, 30);
  const minorTick = majorTick * 0.5;

  const flat = Math.abs(deg) < FLAT_THRESHOLD_DEG;
  const gateHalf = bubbleR * 1.25;

  ctx.lineCap = 'butt';

  // center gate: level target window. Fills accent when level.
  if (flat) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(w / 2 - gateHalf, midY - majorTick, gateHalf * 2, majorTick * 2);
  }
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = THIN;
  ctx.beginPath();
  ctx.moveTo(w / 2 - gateHalf, midY - majorTick); ctx.lineTo(w / 2 - gateHalf, midY + majorTick);
  ctx.moveTo(w / 2 + gateHalf, midY - majorTick); ctx.lineTo(w / 2 + gateHalf, midY + majorTick);
  ctx.stroke();

  // rail
  ctx.lineWidth = THIN;
  ctx.beginPath();
  ctx.moveTo(pad, midY); ctx.lineTo(w - pad, midY);
  ctx.stroke();

  // graduation ticks (center emphasized)
  for (let i = -4; i <= 4; i++) {
    const tx = w / 2 + (i / 4) * travel;
    const th = i === 0 ? majorTick : minorTick;
    ctx.lineWidth = i === 0 ? THICK : THIN;
    ctx.beginPath();
    ctx.moveTo(tx, midY - th); ctx.lineTo(tx, midY + th);
    ctx.stroke();
  }

  const bx = w / 2 + clamp(deg / TORPEDO_MAX_DEG, -1, 1) * travel;
  drawBubble(ctx, bx, midY, bubbleR, flat, theme);
}
