import { useMotionValue, useSpring, useMotionValueEvent } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type AnimatedValueProps = {
  value: number;
  formatter: (v: number) => string;
  className?: string;
};

const SPRING_CONFIG = { stiffness: 60, damping: 20, mass: 0.8 };

export function AnimatedValue({ value, formatter, className }: AnimatedValueProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, SPRING_CONFIG);
  const [display, setDisplay] = useState(() => formatter(value));
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      // Skip spring on first render — show value immediately
      isFirst.current = false;
      motionValue.set(value);
      return;
    }
    motionValue.set(value);
  }, [value, motionValue]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplay(formatter(latest));
  });

  return <span className={className}>{display}</span>;
}
