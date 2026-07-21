import { useEffect } from 'react';

// Fades sections in as they enter the viewport.
// The `.reveal` class is inert until this hook marks the document ready, so a
// JS-less or observer-less browser still shows every section.
// Pass the route key so the observer re-binds to the new page's elements.
const useReveal = (routeKey) => {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return undefined;

    document.documentElement.dataset.revealReady = 'true';

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.revealReady;
    };
  }, [routeKey]);
};

export default useReveal;
