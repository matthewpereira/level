// Sensor source: owns the deviceorientation/devicemotion listeners and the iOS
// motion-permission gate. It does no math and no smoothing — it just forwards
// the latest raw device-frame readings. Everything downstream (angles.js)
// applies screen-orientation compensation and filtering.

export function createSensorSource({ onOrientation, onMotion }) {
  function handleOrientation(e) {
    if (e.beta === null || e.gamma === null) return;
    // beta  = front/back pitch (device y-axis rotation)
    // gamma = left/right roll  (device x-axis rotation)
    onOrientation(e.beta, e.gamma);
  }

  function handleMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    onMotion(a.x, a.y, a.z);
  }

  function start() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('devicemotion', handleMotion, true);
  }

  // iOS 13+ requires a user-gesture-triggered permission request for motion.
  function needsPermission() {
    return (
      (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') ||
      (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function')
    );
  }

  // Returns a promise resolving true only if every requested sensor was granted.
  function requestPermission() {
    const requests = [];
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        DeviceOrientationEvent.requestPermission) {
      requests.push(DeviceOrientationEvent.requestPermission());
    }
    if (typeof DeviceMotionEvent !== 'undefined' &&
        DeviceMotionEvent.requestPermission) {
      requests.push(DeviceMotionEvent.requestPermission());
    }
    return Promise.all(requests).then((states) => states.every((s) => s === 'granted'));
  }

  return { start, needsPermission, requestPermission };
}
