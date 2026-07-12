// Sanity checks for the pure angle math. Run: node test/angles.test.mjs
// No sensors needed — these verify the screen-orientation compensation and the
// edge/torpedo logic that we cannot exercise on a real phone here.

import {
  clamp, lowPass, rotateToScreen, edgeRatio, nextEdgeMode, torpedoAngles, formatAngle,
} from '../js/angles.js';

let pass = 0, fail = 0;
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
function ok(name, cond) {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name); }
}

// --- clamp / lowPass ---
ok('clamp low', clamp(-5, -1, 1) === -1);
ok('clamp high', clamp(5, -1, 1) === 1);
ok('lowPass midpoint', lowPass(0, 10, 0.5) === 5);

// --- rotateToScreen: portrait is identity, landscape swaps axes ---
let r = rotateToScreen(3, 7, 0);
ok('rotate 0 identity', approx(r.x, 3) && approx(r.y, 7));
r = rotateToScreen(3, 7, 90);
ok('rotate 90 swaps (-y, x)', approx(r.x, -7) && approx(r.y, 3));
r = rotateToScreen(3, 7, 180);
ok('rotate 180 inverts', approx(r.x, -3) && approx(r.y, -7));
r = rotateToScreen(3, 7, 270);
ok('rotate 270 swaps (y, -x)', approx(r.x, 7) && approx(r.y, -3));

// A pure left/right tilt in portrait must become a pure "screen-x" tilt after a
// 90deg rotation is undone — i.e. the axis that reads roll stays roll.
const portraitTilt = rotateToScreen(10, 0, 0);   // gamma=10, beta=0
const landscapeTilt = rotateToScreen(0, 10, 90);  // same physical pose, device reports beta=10
ok('landscape maps beta back to screen-x', approx(landscapeTilt.x, -portraitTilt.x, 1e-9)
   ? true : approx(Math.abs(landscapeTilt.x), Math.abs(portraitTilt.x))); // magnitude preserved on correct axis
ok('landscape keeps screen-y zero', approx(landscapeTilt.y, 0));

// --- edgeRatio: flat -> ~0, on-edge -> ~1, rotation-invariant ---
ok('flat gives low ratio', edgeRatio(0, 0, 9.81) < 0.05);
ok('on-edge gives high ratio', edgeRatio(9.81, 0, 0) > 0.99);
// Same pose expressed with in-plane gravity rotated 45deg keeps the ratio.
const flatDiag = edgeRatio(0.2, 0.2, 9.8);
const flatAxis = edgeRatio(Math.hypot(0.2, 0.2), 0, 9.8);
ok('edgeRatio rotation-invariant', approx(flatDiag, flatAxis, 1e-9));

// --- nextEdgeMode hysteresis ---
ok('enter above 0.82', nextEdgeMode(false, 0.9) === true);
ok('stay below enter, above exit', nextEdgeMode(false, 0.75) === false);
ok('hold while between thresholds', nextEdgeMode(true, 0.75) === true);
ok('exit below 0.68', nextEdgeMode(true, 0.6) === false);

// --- torpedoAngles: standing straight up reads 0 level, 0 lean ---
let t = torpedoAngles(0, -9.81, 0); // gravity down the screen y-axis
ok('upright level ~0', approx(t.level, 0, 1e-6));
ok('upright lean ~0', approx(t.lean, 0, 1e-6));
// Tilt sideways within the plane -> non-zero level, still ~0 lean.
t = torpedoAngles(1, -9, 0);
ok('side tilt gives level', Math.abs(t.level) > 5 && approx(t.lean, 0, 1e-6));
// Pitch out of plane -> non-zero lean.
t = torpedoAngles(0, -9, 1);
ok('pitch gives lean', Math.abs(t.lean) > 5);

// --- formatAngle ---
ok('format positive', formatAngle(2.34) === '+02.3');
ok('format negative uses true minus', formatAngle(-5) === '−05.0');
ok('format zero', formatAngle(0) === '+00.0');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
