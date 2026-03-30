'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const animationClasses = {
  up: 'animate-fade-in-up',
  left: 'animate-fade-in-left',
  right: 'animate-fade-in-right',
  scale: 'animate-scale-in',
} as const;

const delayClasses: Record<number, string> = {
  100: 'animate-delay-100',
  200: 'animate-delay-200',
  300: 'animate-delay-300',
  400: 'animate-delay-400',
  500: 'animate-delay-500',
};

export function ScrollReveal({
  children,
  animation = 'up',
  delay = 0,
  className = '',
  threshold = 0.15,
}: {
  children: ReactNode;
  animation?: keyof typeof animationClasses;
  delay?: number;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    el.classList.add('scroll-hidden');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove('scroll-hidden');
          el.classList.add(animationClasses[animation]);
          if (delay && delayClasses[delay]) {
            el.classList.add(delayClasses[delay]);
          }
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animation, delay, threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
