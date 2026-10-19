import { useCallback, useEffect, useState } from 'react';
import { prestamosApi, type CapacidadApi } from '@/services/prestamos-api';

interface Resultado {
  clienteId: string;
  capacidad: CapacidadApi | null;
  error: string | null;
}

/**
 * Capacidad de endeudamiento de un cliente, tal como la calcula el servidor.
 * Solo devuelve datos del cliente pedido: mientras llega la respuesta del nuevo cliente, `capacidad` es null
 * (nunca queda la del cliente anterior).
 */
export function useCapacidad(clienteId: string | undefined) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;
    prestamosApi.capacidad(clienteId)
      .then((capacidad) => { if (vigente) setResultado({ clienteId, capacidad, error: null }); })
      .catch((e: unknown) => {
        if (vigente) setResultado({ clienteId, capacidad: null, error: e instanceof Error ? e.message : 'No se pudo consultar la capacidad del cliente.' });
      });
    return () => { vigente = false; };
  }, [clienteId, intento]);

  const recargar = useCallback(() => {
    setResultado(null);
    setIntento((n) => n + 1);
  }, []);

  const actual = clienteId && resultado?.clienteId === clienteId ? resultado : null;
  return {
    capacidad: actual?.capacidad ?? null,
    error: actual?.error ?? null,
    cargando: !!clienteId && !actual,
    recargar
  };
}
