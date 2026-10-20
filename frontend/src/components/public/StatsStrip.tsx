import React, { useState, useEffect } from 'react';

interface StatItemProps {
  endValue: number;
  label: string;
}

function useCountUp(endValue: number, durationMs: number = 1800, delayMs: number = 1100): number {
  const [value, setValue] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return endValue;
    }
    return 0;
  });

  useEffect(() => {
    // Respect reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setValue(endValue);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const timerId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / durationMs, 1);
        
        // Easing curve matching reference cubic-bezier(.2, .7, .2, 1)
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.min(endValue, Math.round(eased * endValue));
        setValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setValue(endValue); // Guarantee exact final integer
        }
      };

      animationFrameId = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timerId);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [endValue, durationMs, delayMs]);

  return value;
}

const StatCounter: React.FC<StatItemProps> = ({ endValue, label }) => {
  const count = useCountUp(endValue, 1800, 1100);

  return (
    <div className="stat">
      <div className="val">{count}</div>
      <div className="lbl">{label}</div>
    </div>
  );
};

export const StatsStrip: React.FC = () => {
  return (
    <div className="stats" aria-label="DealForge Platform Statistics">
      <StatCounter endValue={113} label="companies covered" />
      <StatCounter endValue={16} label="sectors" />
      <StatCounter endValue={4} label="sourced transactions" />
      <StatCounter endValue={10} label="years of financial history, at most" />
    </div>
  );
};
