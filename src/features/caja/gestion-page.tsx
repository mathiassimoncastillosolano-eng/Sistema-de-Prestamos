import { Download, Inbox, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { usePendientes } from '@/hooks/use-caja';
import { money } from '@/lib/format';
import { cajaApi, mensajeError, type EstadoReposicionApi, type FiltroReposiciones, type PaginaApi, type ReporteApi, type ReposicionFilaApi } from '@/services/caja-api';
import { Paginador } from './caja-page';
import { TablaReposiciones } from './tabla-reposiciones';

type Bandeja = 'por_revisar' | 'en_curso' | 'por_conciliar' | 'observadas' | 'cerradas' | 'todas';

const BANDEJAS: Record<Bandeja, { etiqueta: string; estados: EstadoReposicionApi[] }> = {
  por_revisar: { etiqueta: 'Por revisar', estados: ['PENDIENTE_APROBACION'] },
  en_curso: { etiqueta: 'Aprobadas / en curso', estados: ['APROBADA', 'EN_TRANSITO', 'RECEPCION_PARCIAL'] },
  por_conciliar: { etiqueta: 'Por conciliar', estados: ['RECIBIDA'] },
  observadas: { etiqueta: 'Observadas', estados: ['OBSERVADA'] },
  cerradas: { etiqueta: 'Cerradas', estados: ['COMPLETADA', 'RECHAZADA', 'CANCELADA'] },
  todas: { etiqueta: 'Todas', estados: [] }
};

const TAMANO = 15;

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-muted">{etiqueta}</dt>
      <dd className="num mt-0.5 truncate text-base font-semibold text-ink">{money(valor)}</dd>
      <dd className="truncate text-xs text-ink-muted">{nota}</dd>
    </div>
  );
}

/** Totales del periodo calculados por el servidor (mes en curso por defecto). Mantiene separados los cinco importes. */
function ResumenPeriodo({ filtro }: { filtro: FiltroReposiciones }) {
  const [r, setR] = useState<ReporteApi | null>(null);
  const [error, setError] = useState(false);
  const clave = JSON.stringify({ d: filtro.desde, h: filtro.hasta });
  useEffect(() => {
    let vigente = true;
    cajaApi.reporte({ desde: filtro.desde, hasta: filtro.hasta }).then((x) => { if (vigente) { setR(x); setError(false); } })
      .catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  if (error) return <p role="status" className="mb-4 text-sm text-ink-muted">No se pudo calcular el resumen del periodo.</p>;
  if (!r) return <Skeleton className="mb-4 h-20 w-full" />;
  return (
    <Card aria-label="Resumen del periodo" className="mb-4 px-4 py-3.5 sm:px-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        <Cifra etiqueta="Solicitado" valor={r.totalSolicitado} nota={`${r.reposiciones} reposiciones`} />
        <Cifra etiqueta="Autorizado" valor={r.totalAutorizado} nota="Aprobado con Hermes" />
        <Cifra etiqueta="Enviado" valor={r.totalEnviado} nota="Despachado" />
        <Cifra etiqueta="Recibido" valor={r.totalRecibido} nota="Entró a las cajas" />
        <Cifra etiqueta="Conciliado" valor={r.totalConciliado} nota={r.diferenciasPendientes > 0 ? `Diferencias: ${money(r.diferenciasPendientes)}` : 'Sin diferencias'} />
      </dl>
    </Card>
  );
}

export default function GestionPage() {
  const [bandeja, setBandeja] = useState<Bandeja>('por_revisar');
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaApi<ReposicionFilaApi> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);
  const { pendientes } = usePendientes(true);

  // Búsqueda con pausa para no consultar en cada tecla.
  useEffect(() => { const t = setTimeout(() => { setQ(texto); setPagina(1); }, 300); return () => clearTimeout(t); }, [texto]);

  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const filtro = useMemo<FiltroReposiciones>(() => ({
    estados: BANDEJAS[bandeja].estados.length ? BANDEJAS[bandeja].estados : undefined,
    q: q || undefined, desde: desde || undefined, hasta: hasta || undefined, orden: orden || undefined
  }), [bandeja, q, desde, hasta, orden]);

  useEffect(() => {
    if (rangoInvalido) return;
    let vigente = true;
    setError(null);
    cajaApi.listar({ ...filtro, pagina, tamano: TAMANO }).then((d) => { if (vigente) setDatos(d); })
      .catch((e: unknown) => { if (vigente) setError(mensajeError(e, 'No se pudo cargar la bandeja.')); });
    return () => { vigente = false; };
  }, [filtro, pagina, intento, rangoInvalido]);

  const exportar = async () => {
    setExportando(true);
    try {
      const blob = await cajaApi.descargarCsv(filtro);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reposiciones.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(mensajeError(e, 'No se pudo exportar el reporte.'));
    } finally {
      setExportando(false);
    }
  };

  const cuenta = (b: Bandeja): number | null => {
    if (!pendientes) return null;
    return b === 'por_revisar' ? pendientes.solicitudesPorRevisar : b === 'por_conciliar' ? pendientes.porConciliar : b === 'observadas' ? pendientes.observadas : b === 'en_curso' ? pendientes.enTransito : null;
  };

  return (
    <>
      <PageHeader title="Gestión de reposiciones"
        description="Revisa las solicitudes de las cajas, aprueba con código Hermes, registra el envío y concilia lo recibido."
        actions={<Button onClick={() => void exportar()} loading={exportando} disabled={rangoInvalido}><Download className="size-4" />Exportar CSV</Button>} />
      <ResumenPeriodo filtro={{ desde: desde || undefined, hasta: hasta || undefined }} />

      <Card>
        <div className="space-y-3 px-4 pt-4">
          <Segmented<Bandeja> aria-label="Bandeja" value={bandeja} onValueChange={(b) => { setBandeja(b); setPagina(1); }}
            options={(Object.keys(BANDEJAS) as Bandeja[]).map((b) => ({ value: b, label: <>{BANDEJAS[b].etiqueta}{cuenta(b) ? <span className="num ml-1.5 rounded-full bg-teal-soft px-1.5 text-xs text-teal-ink">{cuenta(b)}</span> : null}</> }))} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Buscar" hint="Asesor, agencia o REP-0001.">
              <Input value={texto} onChange={(e) => setTexto(e.target.value)} prefix={<Search className="size-4" aria-hidden />} maxLength={80} />
            </Field>
            <Field label="Desde"><DatePicker value={desde} max={hasta || undefined} onChange={(v) => { setDesde(v); setPagina(1); }} /></Field>
            <Field label="Hasta" error={rangoInvalido ? '«Desde» no puede ser posterior a «Hasta».' : undefined}><DatePicker value={hasta} min={desde || undefined} onChange={(v) => { setHasta(v); setPagina(1); }} /></Field>
            <Field label="Ordenar por">
              <Select value={orden} onChange={(e) => { setOrden(e.target.value); setPagina(1); }}>
                <option value="">Prioridad (lo urgente primero)</option>
                <option value="creado:desc">Más recientes</option>
                <option value="creado:asc">Más antiguas</option>
                <option value="solicitado:desc">Mayor monto solicitado</option>
                <option value="solicitado:asc">Menor monto solicitado</option>
                <option value="asesor:asc">Asesor (A–Z)</option>
                <option value="agencia:asc">Agencia (A–Z)</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-3 border-t border-line">
          {rangoInvalido ? <EmptyState icon={Inbox} title="Revisa las fechas" description="La fecha inicial no puede ser posterior a la final." />
            : error && !datos ? <EmptyState icon={Inbox} tone="danger" title="No se pudo cargar la bandeja" description={error} action={<Button onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />
            : !datos ? <div className="p-5"><Skeleton className="h-28 w-full" /></div>
            : datos.items.length === 0 ? <EmptyState icon={Inbox} title="No hay reposiciones aquí" description={q || desde || hasta ? 'Prueba con otros filtros.' : 'Cuando haya solicitudes en esta bandeja aparecerán en esta lista.'} />
            : (<>
              {error && <p role="alert" className="px-4 py-2 text-sm text-danger-ink">{error} Se muestran los últimos datos cargados.</p>}
              <TablaReposiciones filas={datos.items} base="/reposiciones" conAsesor caption="Reposiciones" />
              <Paginador pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onIr={setPagina} />
            </>)}
        </div>
      </Card>
    </>
  );
}
