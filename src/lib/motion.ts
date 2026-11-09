import { useEffect, useRef, useState } from 'react';
import {
  animate,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion';

/**
 * Shared framer-motion presets for the POS tablet UI.
 * Keep animations transform/opacity-only so they stay smooth on tablets.
 */

// ---------- Transitions ----------
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

export const easeOutQuick: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

// ---------- Page / view transitions ----------
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

// ---------- Stagger containers / items ----------
export const staggerContainer = (stagger = 0.04, delayChildren = 0.02): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeOutQuick },
};

export const popItem: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSoft },
};

// ---------- Modals ----------
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.18, delay: 0.05 } },
};

export const modalPanelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, y: 16, transition: { duration: 0.16 } },
};

// ---------- Interaction presets ----------
export const tapScale = { scale: 0.96 };
export const hoverLift = { y: -3, scale: 1.015 };

/**
 * Animated number hook (count-up / count-down) — used for Rupiah totals
 * and stat cards. Respects prefers-reduced-motion.
 */
export function useAnimatedNumber(value: number, duration = 0.5): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      prev.current = value;
      setDisplay(value);
      return;
    }
    // Start from the currently displayed value so interrupted animations stay smooth
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        prev.current = v;
        setDisplay(Math.round(v));
      },
      onComplete: () => {
        prev.current = value;
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return display;
}
