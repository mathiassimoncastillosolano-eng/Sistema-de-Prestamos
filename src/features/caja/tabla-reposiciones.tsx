import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '@/lib/format';
import type { ReposicionFilaApi } from '@/services/caja-api';
import { codigoRep, fechaHora } from './caja-utils';
import { EstadoReposicionBadge } from './estado-reposicion-badge';

interface Props {
  filas: ReposicionFilaApi[];
  /** Ruta base del detalle: `/caja` (asesor) o `/reposiciones` (gerencia). */
  base: string;
  conAsesor?: boolean;
  caption: string;
}

/** Tabla de reposiciones. Los importes solicitado/autorizado/recibido van en columnas separadas: nunca se mezclan. */
export function TablaReposiciones({ filas, base, conAsesor, caption }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2.5 font-medium">Reposición</th>
            {conAsesor && <th scope="col" className="px-4 py-2.5 font-medium">Asesor</th>}
            <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Solicitado</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Autorizado</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Recibido</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Última novedad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filas.map((f) => (
            <tr key={f.id} className="hover:bg-surface-2/60">
              <td className="px-4 py-3">
                <Link to={`${base}/${f.id}`} className="font-medium text-teal-ink underline-offset-4 hover:underline">{codigoRep(f.numero)}</Link>
                {f.incidenciasAbiertas > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-warning-ink" title={`${f.incidenciasAbiertas} incidencia(s) abierta(s)`}>
                    <AlertTriangle className="size-3.5" aria-hidden /><span className="sr-only">Incidencias abiertas:</span>{f.incidenciasAbiertas}
                  </span>
                )}
              </td>
              {conAsesor && <td className="px-4 py-3 text-ink">{f.asesor}<span className="block text-xs text-ink-muted">{f.agencia}</span></td>}
              <td className="px-4 py-3"><EstadoReposicionBadge estado={f.estado} /></td>
              <td className="num px-4 py-3 text-right">{money(f.montoSolicitado)}</td>
              <td className="num px-4 py-3 text-right">{f.montoAutorizado === null ? '—' : money(f.montoAutorizado)}</td>
              <td className="num px-4 py-3 text-right">{f.montoAutorizado === null ? '—' : money(f.totalRecibido)}</td>
              <td className="px-4 py-3 text-xs text-ink-muted">{fechaHora(f.actualizadoEn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
