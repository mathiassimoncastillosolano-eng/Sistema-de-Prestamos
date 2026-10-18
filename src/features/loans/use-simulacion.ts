import { useCallback, useEffect, useRef, useState } from 'react';
import { PrestamoApiError, prestamosApi, type SimulacionApi } from '@/services/prestamos-api';

export type EstadoSimulacion = 'inactiva' | 'cargando' | 'lista' | 'error';

/**
 * Pide al servidor el cronograma que se guardaría hoy con ese capital y plazo (misma fórmula y misma fecha de Lima que el
 * registro). Espera un instante tras el último cambio y descarta respuestas de peticiones superadas: solo la última cuenta.
 * No registra nada. Con `habilitada` en false (datos inválidos) no consulta y limpia el resultado.
 */
export function useSimulacion(capital: number, plazoMeses: number, habilitada: boolean, retardoMs = 350) {
  const [sim, setSim] = useState<SimulacionApi | null>(null);
  const [estado, setEstado] = useState<EstadoSimulacion>('inactiva');
  const [error, setError] = useState<PrestamoApiError | null>(null);
  const [recarga, setRecarga] = useState(0);
  const secuencia = useRef(0);

  useEffect(() => {
    const id = ++secuencia.current;
    if (!habilitada) {
      setSim(null);
      setError(null);
      setEstado('inactiva');
      return;
    }
    setEstado('cargando');
    setError(null);
    const temporizador = setTimeout(() => {
      prestamosApi.simular({ capital, plazoMeses })
        .then((r) => {
          if (id !== secuencia.current) return;
          setSim(r);
          setEstado('lista');
        })
        .catch((e: unknown) => {
          if (id !== secuencia.current) return;
          setSim(null);
          setError(e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo calcular el cronograma. Inténtalo nuevamente.'));
          setEstado('error');
        });
    }, retardoMs);
    return () => {
      clearTimeout(temporizador);
      secuencia.current++; // invalida la respuesta pendiente de esta ejecución
    };
  }, [capital, plazoMeses, habilitada, recarga, retardoMs]);

  const recalcular = useCallback(() => setRecarga((n) => n + 1), []);
  return { sim, estado, error, recalcular };
}
