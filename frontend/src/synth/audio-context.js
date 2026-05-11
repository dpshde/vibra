let ctx = null;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

export function resumeContext() {
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume();
  }
  return Promise.resolve();
}
