# LEVEL

A phone spirit level. Open it on your phone and it uses the device's motion
sensors to show how level a surface is, styled as a Swiss-brutalist instrument.

**Live:** https://matthewpereira.github.io/level

## Modes

- **Flat** — lay the phone on a surface. Toggle between:
  - **Bullseye** — a 2-axis bubble vial.
  - **Torpedo** — two linear gauges: `SIDE` (left/right tilt) and `FRONT` (front/back tilt).
- **On edge** — stand the phone up and it switches automatically to `LEVEL` / `LEAN` gauges.

**TARE** zeroes the current reading against the surface you're on; **CLEAR** removes that offset.

## Notes

- Works in portrait and landscape; the axes are corrected for screen rotation.
- iOS asks for motion-sensor permission on first use.
- Best full-screen — the first tap requests fullscreen where the browser allows it.

## Development

No build step, no dependencies — plain HTML, CSS, and ES modules. Serve the
folder and open it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Sensor data only comes from a real device, so use your phone (or browser
device emulation) to see it working.

```
index.html        markup / app shell
css/styles.css    styling + theme
js/
  config.js       tunable constants (smoothing, thresholds, ranges)
  angles.js       pure orientation math (screen-rotation, edge detection, smoothing)
  sensors.js      deviceorientation / devicemotion + iOS permission
  renderers.js    canvas drawing for the vials
  main.js         DOM wiring, state, animation loop
test/             node unit tests for the angle math
```

Run the tests:

```sh
node test/angles.test.mjs
```

Deployed to GitHub Pages from `main` via `.github/workflows/static.yml`.
