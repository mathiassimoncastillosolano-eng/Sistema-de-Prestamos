import { ArrowRight, HandCoins, History, ReceiptText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useCaja } from '@/hooks/use-caja';
import { money } from '@/lib/format';
import { cajaApi, mensajeError, type MovimientoApi, type PaginaApi, type ReposicionFilaApi } from '@/services/caja-api';
import { codigoRep, fechaHora } from './caja-utils';
import { CajaResumen } from './caja-resumen-card';
import { DialogoSolicitar } from './dialogo-solicitar';
import { EstadoReposicionBadge } from './estado-reposicion-badge';
import { TablaReposiciones } from './tabla-reposiciones';

const TAMANO = 10;
type Vista = 'reposiciones' | 'movimientos';

const ETIQUETA_MOV: Record<MovimientoApi['tipo'], string> = { APERTURA: 'Apertura de caja', DESEMBOLSO: 'Desembolso de préstamo', REPOSICION: 'Reposición recibida', AJUSTE: 'Ajuste' };

/** Texto de lo que sigue para el asesor, según el estado de su reposición abierta. */
function siguientePaso(f: ReposicionFilaApi): string {
  switch (f.estado) {
    case 'PENDIENTE_APROBACION': return 'Gerencia aún no la revisa. Puedes cancelarla mientras tanto.';
    case 'OBSERVADA': return 'Gerencia pidió una aclaración: respóndela para que siga el trámite.';
    case 'APROBADA': return `Aprobada por ${money(f.montoAutorizado ?? 0)}. Cuando recibas el dinero, cuéntalo y regístralo.`;
    case 'EN_TRANSITO': return 'El dinero va en camino. Cuando llegue, cuéntalo y regístralo.';
    case 'RECEPCION_PARCIAL': return `Faltan ${money(f.pendienteRecepcion)} por recibir. Registra lo que llegue.`;
    default: return '';
  }
}

function Reposiciones({ recargaClave }: { recargaClave: number }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaApi<ReposicionFilaApi> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    cajaApi.listar({ pagina, tamano: TAMANO }).then((d) => { if (vigente) { setDatos(d); setError(null); } })
      .catch((e: unknown) => { if (vigente) setError(mensajeError(e, 'No se pudo cargar tus reposiciones.')); });
    return () => { vigente = false; };
  }, [pagina, intento, recargaClave]);

  if (error && !datos) return <EmptyState icon={ReceiptText} tone="danger" title="No se pudieron cargar tus reposiciones" description={error} action={<Button onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />;
  if (!datos) return <div className="p-5"><Skeleton className="h-24 w-full" /></div>;
  if (datos.items.length === 0) return <EmptyState icon={HandCoins} title="Aún no has pedido reposiciones" description="Cuando tu caja necesite efectivo, solicítalo aquí y gerencia lo revisará." />;
  return (
    <>
      <TablaReposiciones filas={datos.items} base="/caja" caption="Mis reposiciones" />
      <Paginador pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onIr={setPagina} />
    </>
  );
}

export function Paginador({ pagina, tamano, total, onIr }: { pagina: number; tamano: number; total: number; onIr: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / tamano));
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="text-ink-muted">Página {pagina} de {paginas} · {total} en total</span>
      <span className="flex gap-2">
        <Button size="sm" onClick={() => onIr(pagina - 1)} disabled={pagina <= 1}>Anterior</Button>
        <Button size="sm" onClick={() => onIr(pagina + 1)} disabled={pagina >= paginas}>Siguiente</Button>
      </span>
    </nav>
  );
}

function Movimientos({ recargaClave }: { recargaClave: number }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaApi<MovimientoApi> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    cajaApi.movimientos(pagina, 15).then((d) => { if (vigente) { setDatos(d); setError(null); } })
      .catch((e: unknown) => { if (vigente) setError(mensajeError(e, 'No se pudieron cargar los movimientos.')); });
    return () => { vigente = false; };
  }, [pagina, intento, recargaClave]);

  if (error && !datos) return <EmptyState icon={History} tone="danger" title="No se pudieron cargar los movimientos" description={error} action={<Button onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />;
  if (!datos) return <div className="p-5"><Skeleton className="h-24 w-full" /></div>;
  if (datos.items.length === 0) return <EmptyState icon={History} title="Sin movimientos" description="Cada desembolso y cada recepción de efectivo aparecerá aquí." />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Movimientos de mi caja</caption>
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Movimiento</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Importe</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo después</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {datos.items.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-xs text-ink-muted">{fechaHora(m.creadoEn)}</td>
                <td className="px-4 py-3">{ETIQUETA_MOV[m.tipo]}{m.prestamoNumero !== null && <span className="text-ink-muted"> · PR-{m.prestamoNumero}</span>}{m.reposicionNumero !== null && <span className="text-ink-muted"> · {codigoRep(m.reposicionNumero)}</span>}</td>
                <td className={`num px-4 py-3 text-right font-medium ${m.sentido === 'ENTRADA' ? 'text-success-ink' : 'text-ink'}`}>
                  <span className="sr-only">{m.sentido === 'ENTRADA' ? 'Entrada ' : 'Salida '}</span>{m.sentido === 'ENTRADA' ? '+' : '−'}{money(m.importe)}
                </td>
                <td className="num px-4 py-3 text-right">{money(m.saldoDespues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginador pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onIr={setPagina} />
    </>
  );
}

export default function CajaPage() {
  const { caja, error, recargar } = useCaja();
  const [vista, setVista] = useState<Vista>('reposiciones');
  const [solicitando, setSolicitando] = useState(false);
  const [recargaClave, setRecargaClave] = useState(0);
  const creada = useCallback(() => { recargar(); setRecargaClave((n) => n + 1); }, [recargar]);

  const abierta = caja?.reposicionAbierta ?? null;
  const motivoBloqueo = !caja ? null
    : caja.estado !== 'ABIERTA' ? 'Tu caja está cerrada.'
    : abierta ? `Ya tienes ${codigoRep(abierta.numero)} en trámite.`
    : caja.capacidadLibre <= 0 ? 'Tu caja ya está en su límite: no admite más efectivo.' : null;

  return (
    <>
      <PageHeader title="Caja y reposiciones" description="Tu efectivo, las reposiciones que pediste y cada movimiento de tu caja."
        actions={<Button variant="primary" disabled={!caja || motivoBloqueo !== null} onClick={() => setSolicitando(true)}><HandCoins className="size-4" />Solicitar reposición</Button>} />
      <CajaResumen caja={caja} error={error} onReintentar={recargar} />
      {motivoBloqueo && <p role="status" className="-mt-2 mb-5 text-sm text-ink-muted">No puedes solicitar ahora: {motivoBloqueo}</p>}

      {abierta && (
        <Card className="mb-5 border-teal/40">
          <CardHeader title={<span className="flex flex-wrap items-center gap-2">En trámite · {codigoRep(abierta.numero)} <EstadoReposicionBadge estado={abierta.estado} /></span>}
            action={<Button asChild size="sm"><Link to={`/caja/${abierta.id}`}>Ver detalle<ArrowRight className="size-4" /></Link></Button>} />
          <CardBody className="pt-2 text-sm">
            <p className="text-ink-muted">{siguientePaso(abierta)}</p>
            <dl className="num mt-3 grid gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-ink-muted">Solicitado</dt><dd className="font-semibold">{money(abierta.montoSolicitado)}</dd></div>
              <div><dt className="text-xs text-ink-muted">Autorizado</dt><dd className="font-semibold">{abierta.montoAutorizado === null ? '—' : money(abierta.montoAutorizado)}</dd></div>
              <div><dt className="text-xs text-ink-muted">Recibido</dt><dd className="font-semibold">{abierta.montoAutorizado === null ? '—' : money(abierta.totalRecibido)}</dd></div>
            </dl>
            {caja && caja.incidenciasAbiertas > 0 && <Badge tone="warning" dot className="mt-3">{caja.incidenciasAbiertas} incidencia(s) abierta(s)</Badge>}
          </CardBody>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <Segmented<Vista> aria-label="Ver" value={vista} onValueChange={setVista} options={[{ value: 'reposiciones', label: 'Mis reposiciones' }, { value: 'movimientos', label: 'Movimientos de caja' }]} />
        </div>
        <div className="mt-3">{vista === 'reposiciones' ? <Reposiciones recargaClave={recargaClave} /> : <Movimientos recargaClave={recargaClave} />}</div>
      </Card>

      {caja && <DialogoSolicitar open={solicitando} onOpenChange={setSolicitando} caja={caja} onCreada={creada} />}
    </>
  );
}
