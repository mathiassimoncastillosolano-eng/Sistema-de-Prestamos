import { useCallback, useEffect, useRef, useState } from 'react';
import { cajaApi, mensajeError, type CajaResumenApi, type PendientesApi, type ReposicionDetalleApi } from '@/services/caja-api';

/**
 * Caja del asesor en sesión, tal como la calcula el servidor. Se vuelve a pedir cuando cambia `clave` o al llamar a
 * `recargar`, sin borrar el valor mostrado (la tarjeta no parpadea).
 */
export function useCaja(clave?: unknown, activo = true) {
  const [caja, setCaja] = useState<CajaResumenApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    cajaApi.resumen()
      .then((c) => { if (vigente) { setCaja(c); setError(null); } })
      .catch((e: unknown) => { if (vigente) setError(mensajeError(e, 'No se pudo consultar tu caja.')); });
    return () => { vigente = false; };
  }, [intento, clave, activo]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  return { caja, error, cargando: activo && !caja && !error, recargar };
}

/** Intervalo del aviso del menú. NO es tiempo real: es una consulta periódica, y se pausa con la pestaña oculta. */
export const INTERVALO_PENDIENTES_MS = 60_000;

/** Contadores de pendientes para los avisos del menú (consulta periódica; si falla, simplemente no muestra aviso). */
export function usePendientes(activo: boolean) {
  const [pendientes, setPendientes] = useState<PendientesApi | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    const pedir = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      cajaApi.pendientes().then((p) => { if (vigente) setPendientes(p); }).catch(() => { /* sin aviso */ });
    };
    pedir();
    const t = setInterval(pedir, INTERVALO_PENDIENTES_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vigente = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [activo, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  return { pendientes, recargar };
}

/** Detalle de una reposición con su línea de tiempo real. `fijar` acepta la respuesta de una acción (ya viene el detalle nuevo). */
export function useReposicion(id: string | undefined) {
  const [detalle, setDetalle] = useState<ReposicionDetalleApi | null>(null);
  const [error, setError] = useState<{ mensaje: string; noExiste: boolean } | null>(null);
  const [intento, setIntento] = useState(0);
  const idActual = useRef(id);
  idActual.current = id;

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    cajaApi.detalle(id)
      .then((d) => { if (vigente) { setDetalle(d); setError(null); } })
      .catch((e: unknown) => {
        if (!vigente) return;
        const noExiste = (e as { codigo?: string }).codigo === 'REPOSICION_NO_ENCONTRADA';
        setError({ mensaje: mensajeError(e, 'No se pudo cargar la reposición.'), noExiste });
      });
    return () => { vigente = false; };
  }, [id, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  const fijar = useCallback((d: ReposicionDetalleApi) => {
    if (d.fila.id === idActual.current) { setDetalle(d); setError(null); }
  }, []);
  return { detalle: id ? detalle : null, error, cargando: !!id && !detalle && !error, recargar, fijar };
}
