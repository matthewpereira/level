# level

A phone spirit level for your phone.

**Live:** https://matthewpereira.github.io/level (this isn't going to do anything if you open it on your laptop, use a phone)

## Modes

- **Flat** — lay the phone on a surface. Toggle between:
  - **Bullseye** — a 2-axis bubble vial.
  - **Torpedo** — two linear gauges: `SIDE` (left/right tilt) and `FRONT` (front/back tilt).
- **On edge** — stand the phone up and it switches automatically to `LEVEL` / `LEAN` gauges.

**TARE** zeroes the current reading against the surface you're on; **CLEAR** removes that offset.

## Notes

- Works in portrait and landscape; the axes are corrected for screen rotation.
- iOS should ask for motion-sensor permission on first use - I don't have an iPhone to test it with ¯\\\_(ツ)\_/¯.
- Best full-screen - the first tap requests fullscreen where the browser allows it.

## Development

No build step, no dependencies - if you want to fork and serve it yourself just use something like:

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
