import { useCallback, useEffect, useState } from 'react';
import { prestamosApi, type LimiteDiarioApi } from '@/services/prestamos-api';

/**
 * Límite diario de colocación del asesor en sesión, tal como lo calcula el servidor.
 * Se vuelve a pedir cuando cambia `clave` (p. ej. el paso de la solicitud) o al llamar a `recargar`, sin borrar el
 * valor que se está mostrando: así la barra no parpadea.
 */
export function useLimiteDiario(clave?: unknown) {
  const [limite, setLimite] = useState<LimiteDiarioApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    prestamosApi.limiteDiario()
      .then((l) => { if (vigente) { setLimite(l); setError(null); } })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : 'No se pudo consultar tu límite diario.');
      });
    return () => { vigente = false; };
  }, [intento, clave]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { limite, error, cargando: !limite && !error, recargar };
}
