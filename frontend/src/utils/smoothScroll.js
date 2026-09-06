// Custom eased scroll — the browser's native `scrollIntoView({behavior:'smooth'})`
// feels abrupt/fast for short distances. This gives us control over duration
// so nav clicks feel like a natural, gentle glide instead of a snap.
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

export function smoothScrollToElement(elementId, { offset = 90, duration = 1100 } = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startY = window.scrollY;
  const targetY = el.getBoundingClientRect().top + startY - offset;
  const distance = targetY - startY;
  let startTime = null;

  const step = (timestamp) => {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutQuad(progress));
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}
