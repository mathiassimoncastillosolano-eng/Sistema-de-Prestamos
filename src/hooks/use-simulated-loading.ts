import { useEffect, useState } from 'react';

/** Simula la latencia de un servicio: true durante `ms` tras el montaje (muestra skeletons). */
export function useSimulatedLoading(ms = 260) {
  const [cargando, setCargando] = useState(ms > 0);
  useEffect(() => {
    if (ms <= 0) return;
    const t = setTimeout(() => setCargando(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return cargando;
}
