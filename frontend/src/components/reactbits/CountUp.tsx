import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

// Adapted from the React Bits CountUp component (TypeScript and Tailwind variant).
type CountUpProps = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  className?: string;
  locale?: string;
};

export default function CountUp({ to, from = 0, duration = 1.1, decimals = 0, className, locale = "en-GB" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);
  const damping = 20 + 40 * (1 / Math.max(duration, 0.2));
  const stiffness = 100 * (1 / Math.max(duration, 0.2));
  const spring = useSpring(motionValue, { damping, stiffness });
  const inView = useInView(ref, { once: true, margin: "0px" });

  const format = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(from);
    // Only the initial text. Later values come from the spring below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inView) motionValue.set(to);
  }, [inView, to, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      // The spring can overshoot a little. Keep the shown value inside the range.
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      if (ref.current) ref.current.textContent = format(Math.min(high, Math.max(low, latest)));
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring, decimals, locale, from, to]);

  return <span ref={ref} className={className} aria-label={format(to)} />;
}
