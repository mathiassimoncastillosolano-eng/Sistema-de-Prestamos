import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE } from '@/lib/motion';

interface Props {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Contador animado. Siempre termina en el valor exacto; con movimiento reducido muestra el valor final al instante.
 * Los lectores de pantalla reciben solo el valor final (no los intermedios).
 */
export function AnimatedNumber({ value, format, duration = 0.7, className }: Props) {
  const reducir = useReducedMotion();
  const [mostrado, setMostrado] = useState(reducir ? value : 0);
  const previo = useRef(reducir ? value : 0);

  useEffect(() => {
    if (reducir) { setMostrado(value); previo.current = value; return; }
    const ctl = animate(previo.current, value, { duration, ease: EASE, onUpdate: setMostrado, onComplete: () => setMostrado(value) });
    previo.current = value;
    return () => ctl.stop();
  }, [value, reducir, duration]);

  return (
    <>
      <span aria-hidden className={`num ${className ?? ''}`}>{format(mostrado)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
