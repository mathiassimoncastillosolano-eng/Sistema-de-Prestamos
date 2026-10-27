import { AlertTriangle, ShieldAlert, Vault } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { money } from '@/lib/format';
import { cajaApi, mensajeError, type CajaSupervisionApi, type SupervisionApi } from '@/services/caja-api';
import { fechaHora } from './caja-utils';

/** El servidor entrega cada alerta ya redactada; aquí solo se elige el tono. */
const esCritica = (a: string) => a.includes('no coincide');

function FilaCaja({ c }: { c: CajaSupervisionApi }) {
  return (
    <tr className="align-top hover:bg-surface-2/60">
      <td className="px-4 py-3 text-ink">{c.asesor}<span className="block text-xs text-ink-muted">{c.agencia}</span></td>
      <td className="num px-4 py-3 text-right font-medium">{money(c.saldo)}<span className="block text-xs font-normal text-ink-muted">de {money(c.limite)}</span></td>
      <td className="num px-4 py-3 text-right">{money(c.autorizadoPendiente)}</td>
      <td className="num px-4 py-3 text-right">{money(c.enTransito)}</td>
      <td className="num px-4 py-3 text-right">{c.diferenciasPendientes > 0 ? <span className="text-danger-ink">{money(c.diferenciasPendientes)}</span> : '—'}</td>
      <td className="px-4 py-3">
        {c.alertas.length === 0 && c.reposicionesPorRevisar === 0 ? <span className="text-xs text-ink-muted">Sin novedades</span> : (
          <ul className="flex flex-wrap gap-1.5">
            {c.alertas.map((a) => <li key={a}><Badge tone={esCritica(a) ? 'danger' : 'warning'} dot className="whitespace-normal text-left">{a}</Badge></li>)}
            {c.reposicionesPorRevisar > 0 && <li><Badge tone="info" dot>{c.reposicionesPorRevisar} por revisar</Badge></li>}
          </ul>
        )}
      </td>
    </tr>
  );
}

export default function SupervisionPage() {
  const [datos, setDatos] = useState<SupervisionApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    cajaApi.supervision().then((d) => { if (vigente) { setDatos(d); setError(null); } })
      .catch((e: unknown) => { if (vigente) setError(mensajeError(e, 'No se pudo cargar la supervisión.')); });
    return () => { vigente = false; };
  }, [intento]);

  return (
    <>
      <PageHeader title="Supervisión de cajas" description="Efectivo de cada asesor, lo autorizado que aún no llegó y las alertas que requieren atención."
        actions={<><Button onClick={() => setIntento((n) => n + 1)}>Actualizar</Button><Button asChild variant="primary"><Link to="/reposiciones">Ir a la gestión</Link></Button></>} />
      {error && !datos ? (
        <Card><EmptyState icon={ShieldAlert} tone="danger" title="No se pudo cargar la supervisión" description={error} action={<Button onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} /></Card>
      ) : !datos ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid gap-5">
          <Card aria-label="Totales">
            <CardBody>
              <dl className="num grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <div><dt className="text-xs text-ink-muted">Efectivo total en cajas</dt><dd className="text-lg font-semibold">{money(datos.saldoTotal)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Autorizado sin recibir</dt><dd className="text-lg font-semibold">{money(datos.autorizadoPendienteTotal)}</dd></div>
                <div><dt className="text-xs text-ink-muted">En tránsito</dt><dd className="text-lg font-semibold">{money(datos.enTransitoTotal)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Diferencias pendientes</dt><dd className="text-lg font-semibold">{money(datos.diferenciasPendientesTotal)}</dd></div>
              </dl>
              {datos.alertasTotal > 0 && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-warning-ink"><AlertTriangle className="size-4" aria-hidden />{datos.alertasTotal} alerta(s) activa(s) en las cajas.</p>}
              <p className="mt-2 text-xs text-ink-muted">Datos al {fechaHora(datos.ahora)}. Se actualizan al abrir la pantalla o con «Actualizar»; no son en tiempo real.</p>
            </CardBody>
          </Card>

          {datos.agencias.length > 0 && (
            <Card>
              <CardHeader title="Por agencia" />
              <div className="overflow-x-auto pb-2">
                <table className="mt-2 w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">Efectivo por agencia</caption>
                  <thead className="text-xs text-ink-muted"><tr className="border-b border-line">
                    <th scope="col" className="px-4 py-2.5 font-medium">Agencia</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Cajas</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Efectivo</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Autorizado sin recibir</th>
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {datos.agencias.map((a) => (
                      <tr key={a.agenciaId}><td className="px-4 py-3">{a.agencia}</td><td className="num px-4 py-3 text-right">{a.cajas}</td>
                        <td className="num px-4 py-3 text-right font-medium">{money(a.saldoTotal)}</td><td className="num px-4 py-3 text-right">{money(a.autorizadoPendiente)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Cajas" description="Primero las que tienen alertas." />
            {datos.cajas.length === 0 ? <EmptyState icon={Vault} title="Todavía no hay cajas abiertas" description="Cada asesor abre su caja al registrar su primer préstamo o al consultarla." /> : (
              <div className="overflow-x-auto pb-2">
                <table className="mt-2 w-full min-w-[46rem] text-left text-sm">
                  <caption className="sr-only">Cajas de los asesores</caption>
                  <thead className="text-xs text-ink-muted"><tr className="border-b border-line">
                    <th scope="col" className="px-4 py-2.5 font-medium">Asesor</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Efectivo</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Autorizado sin recibir</th><th scope="col" className="px-4 py-2.5 text-right font-medium">En tránsito</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Diferencias</th><th scope="col" className="px-4 py-2.5 font-medium">Alertas</th>
                  </tr></thead>
                  <tbody className="divide-y divide-line">{[...datos.cajas].sort((a, b) => b.alertas.length - a.alertas.length).map((c) => <FilaCaja key={c.cajaId} c={c} />)}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
