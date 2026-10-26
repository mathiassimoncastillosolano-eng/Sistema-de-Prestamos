import { useCallback, useEffect, useState } from 'react';
import { prestamosApi, type PerfilFinancieroApi } from '@/services/prestamos-api';

interface Resultado {
  clienteId: string;
  perfil: PerfilFinancieroApi | null;
  error: string | null;
}

/** Perfil financiero consolidado (DNI ↔ RUC 10) del cliente pedido; nunca devuelve el de otro cliente mientras carga. */
export function usePerfilFinanciero(clienteId: string | undefined) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;
    prestamosApi.perfilFinanciero(clienteId)
      .then((perfil) => { if (vigente) setResultado({ clienteId, perfil, error: null }); })
      .catch((e: unknown) => { if (vigente) setResultado({ clienteId, perfil: null, error: e instanceof Error ? e.message : 'No se pudo consultar el perfil financiero.' }); });
    return () => { vigente = false; };
  }, [clienteId, intento]);

  const recargar = useCallback(() => { setResultado(null); setIntento((n) => n + 1); }, []);
  const actual = clienteId && resultado?.clienteId === clienteId ? resultado : null;
  return { perfil: actual?.perfil ?? null, error: actual?.error ?? null, cargando: !!clienteId && !actual, recargar };
}
