// Tunable constants for the level. Kept in one place so behavior is easy to
// reason about and adjust without hunting through the drawing/loop code.

// Low-pass smoothing factors (0..1). Higher = snappier but noisier.
export const SMOOTHING = {
  gravity: 0.09,   // raw gravity vector (cuts high-frequency sensor noise)
  bullseye: 0.14,  // flat-mode beta/gamma angles
  torpedo: 0.12,   // on-edge derived angles (atan2 amplifies jitter, so settle it)
};

// Edge-mode hysteresis: enter when gravity is mostly in the screen plane,
// exit at a lower ratio so the mode does not flicker at the boundary.
export const EDGE = { enter: 0.82, exit: 0.68 };

// Below this many degrees on both axes the readout/bubble reads "flat" (green).
export const FLAT_THRESHOLD_DEG = 0.6;

// Displayed angles are clamped to +/- this so the readout stays sane on-edge.
export const CLAMP_DEG = 45;

// Angle that maps the bubble to the edge of its travel in each renderer.
export const BULLSEYE_MAX_DEG = 30;
export const TORPEDO_MAX_DEG = 25;
