// App entry point: wires the DOM, holds the small amount of mutable state,
// runs the rAF loop, and orchestrates mode switching, tare and fullscreen.

import { SMOOTHING, CLAMP_DEG, FLAT_THRESHOLD_DEG } from './config.js';
import {
  clamp, lowPass, rotateToScreen, edgeRatio, nextEdgeMode, torpedoAngles, formatAngle,
} from './angles.js';
import { createSensorSource } from './sensors.js';
import { drawBullseye, drawTorpedo } from './renderers.js';

const $ = (id) => document.getElementById(id);

// --- DOM refs ---
const valX = $('valX'), valY = $('valY');
const labelX = $('labelX'), labelY = $('labelY');
const modeLabel = $('modeLabel');
const bullseyeWrap = $('bullseyeWrap');
const torpedoStack = $('torpedoStack');
const footerMsg = $('footerMsg');
const tareBtn = $('tareBtn'), resetBtn = $('resetBtn');
const permGate = $('permGate'), permBtn = $('permBtn');
const levelUI = $('levelUI');

// Each canvas plus its context and cached CSS dimensions (measured on resize
// only — never in the animation loop).
const bullseye = makeSurface('canvas');
const torpedo1 = makeSurface('torpedoCanvas');
const torpedo2 = makeSurface('torpedoCanvas2');

function makeSurface(id) {
  const el = $(id);
  return { el, ctx: el.getContext('2d'), w: 0, h: 0 };
}

// Colors mirror the CSS custom properties so the canvas matches the design and
// the design agent only needs to edit them in one place (css/styles.css).
const css = getComputedStyle(document.documentElement);
const theme = {
  ink: css.getPropertyValue('--ink').trim() || '#eaeef2',
  good: css.getPropertyValue('--good').trim() || '#17e08c',
  bad: css.getPropertyValue('--bad').trim() || '#ff3b30',
  bg: css.getPropertyValue('--bg').trim() || '#0a0c0f',
};

// --- Canvas sizing ---
let dpr = 1;

function measure(surface) {
  const rect = surface.el.parentElement.getBoundingClientRect();
  surface.w = rect.width;
  surface.h = rect.height;
  surface.el.width = Math.round(surface.w * dpr);
  surface.el.height = Math.round(surface.h * dpr);
  surface.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resize() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  measure(bullseye);
  measure(torpedo1);
  measure(torpedo2);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  reseed = true; // axes remap on rotation; snap smoothing to avoid a swing
  setTimeout(resize, 100);
});

// --- Fullscreen (hides browser chrome / URL bar) ---
// requestFullscreen() only works from within a user gesture, so this fires on
// the first tap anywhere and then persists across rotations. Not supported on
// iOS Safari outside of "Add to Home Screen" apps.
function requestFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
             el.mozRequestFullScreen || el.msRequestFullscreen;
  if (fn && !document.fullscreenElement && !document.webkitFullscreenElement) {
    try { fn.call(el)?.catch?.(() => {}); } catch (_) { /* ignore */ }
  }
}
window.addEventListener('pointerdown', requestFullscreen, { once: true });
document.addEventListener('fullscreenchange', () => setTimeout(resize, 100));
document.addEventListener('webkitfullscreenchange', () => setTimeout(resize, 100));

// Current screen rotation, normalized to screen.orientation.angle convention.
function screenAngle() {
  const so = window.screen && screen.orientation;
  if (so && typeof so.angle === 'number') return so.angle;
  // window.orientation uses the opposite sign convention; convert it.
  if (typeof window.orientation === 'number') return (360 - window.orientation) % 360;
  return 0;
}

// --- State ---
const raw = { beta: 0, gamma: 0 };                    // latest orientation (device frame)
const grav = { x: 0, y: 0, z: 0, seeded: false };     // low-passed gravity (device frame)
const smooth = { x: 0, y: 0, level: 0, lean: 0 };     // smoothed display angles
const tare = { x: 0, y: 0, level: 0, lean: 0 };       // zero offsets
let inEdgeMode = false;
let haveOrientation = false, haveMotion = false;
let lastShowTorpedo = null;
let reseed = false; // when true, snap smoothing to current raw (no visible slide)

const sensors = createSensorSource({
  onOrientation(beta, gamma) {
    haveOrientation = true;
    raw.beta = beta;
    raw.gamma = gamma;
  },
  onMotion(ax, ay, az) {
    haveMotion = true;
    if (!grav.seeded) {
      // Seed directly on the first sample so we don't slowly converge from the
      // placeholder zero (and so the resting sign is whatever the platform reports).
      grav.x = ax; grav.y = ay; grav.z = az;
      grav.seeded = true;
    } else {
      grav.x = lowPass(grav.x, ax, SMOOTHING.gravity);
      grav.y = lowPass(grav.y, ay, SMOOTHING.gravity);
      grav.z = lowPass(grav.z, az, SMOOTHING.gravity);
    }
    // Edge detection is rotation-invariant (magnitude-based), so raw device-frame
    // gravity is fine here.
    inEdgeMode = nextEdgeMode(inEdgeMode, edgeRatio(grav.x, grav.y, grav.z));
  },
});

// --- Mode switching ---
function applyMode(showTorpedo) {
  bullseyeWrap.classList.toggle('hidden', showTorpedo);
  torpedoStack.classList.toggle('hidden', !showTorpedo);
  modeLabel.classList.toggle('hidden', !showTorpedo);
  labelX.textContent = showTorpedo ? 'LEVEL' : 'SIDE X';
  labelY.textContent = showTorpedo ? 'LEAN' : 'FRONT Y';
  resize(); // the newly-shown canvases now have a non-zero size to measure
}

function setReadout(valEl, deg) {
  valEl.innerHTML = formatAngle(deg) + '<span class="unit">°</span>';
  valEl.classList.toggle('flat', Math.abs(deg) < FLAT_THRESHOLD_DEG);
}

// --- Animation loop ---
function loop() {
  const angle = screenAngle();
  const showTorpedo = haveMotion && inEdgeMode;

  // Compensate raw device-frame vectors for the current screen rotation.
  const tilt = rotateToScreen(raw.gamma, raw.beta, angle); // x=left/right, y=front/back
  const g = rotateToScreen(grav.x, grav.y, angle);
  const edge = torpedoAngles(g.x, g.y, grav.z);

  if (showTorpedo !== lastShowTorpedo) {
    lastShowTorpedo = showTorpedo;
    applyMode(showTorpedo);
    reseed = true; // avoid sliding from the other mode's stale smoothed value
  }

  if (reseed) {
    reseed = false;
    smooth.x = tilt.x; smooth.y = tilt.y;
    smooth.level = edge.level; smooth.lean = edge.lean;
  }

  if (showTorpedo) {
    smooth.level = lowPass(smooth.level, edge.level, SMOOTHING.torpedo);
    smooth.lean = lowPass(smooth.lean, edge.lean, SMOOTHING.torpedo);
    const level = clamp(smooth.level - tare.level, -CLAMP_DEG, CLAMP_DEG);
    const lean = clamp(smooth.lean - tare.lean, -CLAMP_DEG, CLAMP_DEG);
    drawTorpedo(torpedo1.ctx, torpedo1, level, theme);
    drawTorpedo(torpedo2.ctx, torpedo2, lean, theme);
    setReadout(valX, level);
    setReadout(valY, lean);
  } else {
    smooth.x = lowPass(smooth.x, tilt.x, SMOOTHING.bullseye);
    smooth.y = lowPass(smooth.y, tilt.y, SMOOTHING.bullseye);
    const x = clamp(smooth.x - tare.x, -CLAMP_DEG, CLAMP_DEG);
    const y = clamp(smooth.y - tare.y, -CLAMP_DEG, CLAMP_DEG);
    drawBullseye(bullseye.ctx, bullseye, x, y, theme);
    // In flat mode both readouts share the bullseye's combined flat state.
    const flat = Math.abs(x) < FLAT_THRESHOLD_DEG && Math.abs(y) < FLAT_THRESHOLD_DEG;
    valX.innerHTML = formatAngle(x) + '<span class="unit">°</span>';
    valY.innerHTML = formatAngle(y) + '<span class="unit">°</span>';
    valX.classList.toggle('flat', flat);
    valY.classList.toggle('flat', flat);
  }

  requestAnimationFrame(loop);
}

// --- Controls ---
// Tare from the *smoothed* value so the readout snaps to exactly 0.0 with no
// jump, then tracks from there.
tareBtn.addEventListener('click', () => {
  requestFullscreen();
  tare.x = smooth.x; tare.y = smooth.y;
  tare.level = smooth.level; tare.lean = smooth.lean;
});
resetBtn.addEventListener('click', () => {
  tare.x = 0; tare.y = 0; tare.level = 0; tare.lean = 0;
});

// --- Startup ---
function startSensors() {
  sensors.start();
  levelUI.classList.remove('hidden');
  permGate.classList.add('hidden');
  resize();
  requestAnimationFrame(loop);
  setTimeout(() => {
    if (!haveOrientation && !haveMotion) {
      footerMsg.textContent = 'NO SENSOR DATA DETECTED.';
    }
  }, 2500);
}

if (sensors.needsPermission()) {
  permGate.classList.remove('hidden');
  permBtn.addEventListener('click', () => {
    requestFullscreen();
    sensors.requestPermission()
      .then((granted) => {
        if (granted) startSensors();
        else permGate.querySelector('p').textContent =
          'PERMISSION DENIED. ENABLE MOTION ACCESS IN SETTINGS.';
      })
      .catch(() => {
        permGate.querySelector('p').textContent = 'COULD NOT REQUEST PERMISSION.';
      });
  });
} else {
  startSensors();
}
