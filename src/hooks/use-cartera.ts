import { useCallback, useEffect, useState } from 'react';
import { obtenerCartera, type Cartera } from '@/services/dashboard-api';

/** Carga la cartera real del dashboard. `recargar` vuelve a pedirla (por ejemplo, tras registrar un cliente). */
export function useCartera() {
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    setError(null);
    obtenerCartera().then(setCartera).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(recargar, [recargar]);

  return { cartera, error, recargar };
}
