// Pure orientation/angle math. No DOM, no globals — everything comes in as
// arguments so these functions are trivially unit-testable (see test/).

import { EDGE } from './config.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One step of an exponential low-pass filter.
export const lowPass = (prev, next, alpha) => prev + (next - prev) * alpha;

// Rotate a device-frame in-plane vector into the current *screen* frame.
//
// deviceorientation (beta/gamma) and devicemotion (accelerationIncludingGravity)
// are ALWAYS reported in the device's fixed natural frame: x points to the right
// of the screen, y to the top — in portrait. When the OS rotates the UI to
// landscape it does NOT rotate these readings, so the left/right and front/back
// axes appear swapped/inverted unless we undo the screen rotation ourselves.
//
// angleDeg is screen.orientation.angle (0 / 90 / 180 / 270). Applying the plane
// rotation R(angle) maps device axes onto screen axes:
//   0   -> (x, y)      portrait
//   90  -> (-y, x)     landscape
//   180 -> (-x, -y)    portrait upside down
//   270 -> (y, -x)     landscape (other way)
// The axis-swap (the visible bug) is corrected for every orientation. The CW/CCW
// sign of screen.orientation.angle is not perfectly uniform across engines, so a
// single landscape orientation could read inverted on some device — flagged for
// an on-device check.
export function rotateToScreen(x, y, angleDeg) {
  const r = (angleDeg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

// Fraction of gravity lying in the screen plane. Uses the in-plane magnitude
// (hypot) rather than max(|x|,|y|) so the value is rotation-invariant — the same
// physical pose gives the same ratio in portrait and landscape.
export function edgeRatio(gx, gy, gz) {
  const mag = Math.hypot(gx, gy, gz) || 1;
  return Math.hypot(gx, gy) / mag;
}

// Hysteresis state machine for entering/leaving on-edge (torpedo) mode.
export function nextEdgeMode(current, ratio) {
  if (!current && ratio > EDGE.enter) return true;
  if (current && ratio < EDGE.exit) return false;
  return current;
}

// On-edge angles from the (screen-frame) gravity vector.
// The vial aligns with whichever in-plane axis gravity is strongest along:
//   LEVEL = tilt of that axis within the screen plane
//   LEAN  = fore/aft pitch out of the screen plane (gz)
// abs(dominant) keeps the reference pointing "down" so the sign of the reported
// angle is consistent regardless of which way the phone is stood up.
export function torpedoAngles(gx, gy, gz) {
  const dominantIsX = Math.abs(gx) >= Math.abs(gy);
  const dominant = dominantIsX ? gx : gy;
  const other = dominantIsX ? gy : gx;
  const toDeg = 180 / Math.PI;
  return {
    level: Math.atan2(other, Math.abs(dominant)) * toDeg,
    lean: Math.atan2(gz, Math.abs(dominant)) * toDeg,
  };
}

// Format a signed angle as e.g. "+02.3" / "−05.0" (true minus, fixed width).
export function formatAngle(v) {
  const sign = v < 0 ? '−' : '+';
  const [intPart, decPart] = Math.abs(v).toFixed(1).split('.');
  return sign + intPart.padStart(2, '0') + '.' + decPart;
}
