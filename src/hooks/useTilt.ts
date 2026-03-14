import { useMotionValue, useSpring, type MotionStyle } from "framer-motion";
import { useCallback, useRef, type RefObject } from "react";

const TILT_MAX_DEG = 4;
const SPRING_CONFIG = { stiffness: 300, damping: 25, mass: 0.5 };

// Check once if device supports hover (no-op on touch devices)
const supportsHover =
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

export function useTilt(): {
  ref: RefObject<HTMLElement | null>;
  style: MotionStyle;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
} {
  const ref = useRef<HTMLElement | null>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, SPRING_CONFIG);
  const springY = useSpring(rotateY, SPRING_CONFIG);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!supportsHover) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize -1 to 1
      const normalX = (e.clientX - centerX) / (rect.width / 2);
      const normalY = (e.clientY - centerY) / (rect.height / 2);

      // rotateY follows X axis, rotateX follows Y axis (inverted)
      rotateY.set(normalX * TILT_MAX_DEG);
      rotateX.set(-normalY * TILT_MAX_DEG);
    },
    [rotateX, rotateY],
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const style: MotionStyle = supportsHover
    ? {
        rotateX: springX,
        rotateY: springY,
        transformPerspective: 800,
      }
    : {};

  return { ref, style, onMouseMove, onMouseLeave };
}
