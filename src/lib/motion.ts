/* Constantes de movimiento: duraciones y curvas coherentes en toda la app (150–350 ms, sin rebotes). */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const DUR = { fast: 0.15, base: 0.22, slow: 0.32 } as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } }
};

/** Entrada escalonada y discreta de bloques hermanos. */
export const stagger = (delay = 0.04) => ({ hidden: {}, show: { transition: { staggerChildren: delay, delayChildren: 0.02 } } });
