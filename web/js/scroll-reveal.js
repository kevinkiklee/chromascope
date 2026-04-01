// Scroll-triggered reveal animations
document.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const els = document.querySelectorAll('[data-reveal]');
  els.forEach(el => el.classList.add('scroll-hidden'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.remove('scroll-hidden');
      const anim = el.dataset.reveal || 'up';
      const map = { up: 'animate-fade-in-up', left: 'animate-fade-in-left', right: 'animate-fade-in-right', scale: 'animate-scale-in' };
      el.classList.add(map[anim] || map.up);
      const delay = el.dataset.revealDelay;
      if (delay) el.classList.add(`animate-delay-${delay}`);
      observer.unobserve(el);
    });
  }, { threshold: 0.15 });

  els.forEach(el => observer.observe(el));
});
