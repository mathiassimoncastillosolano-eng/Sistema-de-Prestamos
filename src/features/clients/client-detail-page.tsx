import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, Eye, FilePlus2, Hash, Landmark, Mail, MapPin, Pencil, Phone, SearchX, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DataTable } from '@/components/data-display/data-table';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Meter } from '@/components/ui/meter';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { CFG } from '@/lib/config';
import { fecha, toISO } from '@/lib/dates';
import { r2 } from '@/lib/finance';
import { money } from '@/lib/format';
import { contactoSchema, type ContactoForm } from '@/lib/validation';
import { clientesApi, consultarCliente, type ClienteDetalle } from '@/services/clientes-api';
import { prestamosApi, type PrestamoResumenApi } from '@/services/prestamos-api';
import { useCapacidad } from '@/hooks/use-capacidad';
import type { EstadoPrestamo, TipoCliente } from '@/types';

const TONO_TIPO: Record<TipoCliente, 'teal' | 'navy' | 'neutral'> = { DNI: 'neutral', 'RUC 10': 'teal', 'RUC 20': 'navy' };
const ORDEN_ESTADO: readonly EstadoPrestamo[] = ['Vigente', 'En mora', 'Cancelado'];
const codigoPrestamo = (p: PrestamoResumenApi) => `PR-${p.numero}`;
const noAplica = <span className="text-ink-subtle" aria-label="No aplica">—</span>;

const columnas: ColumnDef<PrestamoResumenApi>[] = [
  {
    id: 'numero', header: 'Préstamo', accessorFn: (p) => p.numero, meta: { className: 'w-[7rem]' },
    cell: ({ row: { original: p } }) => (
      <div>
        <Link to={`/prestamos/${p.id}`} className="num font-medium text-teal-ink hover:underline" onClick={(e) => e.stopPropagation()}>{codigoPrestamo(p)}</Link>
        <p className="num whitespace-nowrap text-xs text-ink-muted" title="Fecha de desembolso">{fecha(p.fechaDesembolso)}</p>
      </div>
    )
  },
  { id: 'capital', header: 'Capital', accessorFn: (p) => p.capital, meta: { derecha: true }, cell: ({ row: { original: p } }) => money(p.capital) },
  { id: 'capitalPend', header: 'Cap. pend.', accessorFn: (p) => p.capitalPendiente, meta: { derecha: true, descripcion: 'Capital pendiente' }, cell: ({ row: { original: p } }) => money(p.capitalPendiente) },
  { id: 'pendiente', header: 'Total pend.', accessorFn: (p) => p.totalPendiente, meta: { derecha: true, descripcion: 'Importe contractual pendiente (capital + intereses)' }, cell: ({ row: { original: p } }) => money(p.totalPendiente) },
  { id: 'proxima', header: 'Próx. venc.', accessorFn: (p) => p.proximoVencimiento ?? '9999', cell: ({ row: { original: p } }) => <span className="whitespace-nowrap">{p.proximoVencimiento ? fecha(p.proximoVencimiento) : noAplica}</span> },
  {
    id: 'estado', header: 'Estado', accessorFn: (p) => p.estado,
    sortingFn: (a, b) => ORDEN_ESTADO.indexOf(a.original.estado) - ORDEN_ESTADO.indexOf(b.original.estado),
    cell: ({ row: { original: p } }) => <StatusBadge estado={p.estado} />
  },
  {
    id: 'acciones', header: () => <span className="sr-only">Acciones</span>, enableSorting: false, meta: { className: 'w-12 text-right' },
    cell: ({ row: { original: p } }) => (
      <Button asChild variant="ghost" size="iconSm" className="-my-1"><Link to={`/prestamos/${p.id}`} aria-label={`Ver detalle del préstamo ${codigoPrestamo(p)}`} onClick={(e) => e.stopPropagation()}><Eye className="size-4" aria-hidden /></Link></Button>
    )
  }
];

function TarjetaPrestamo({ p }: { p: PrestamoResumenApi }) {
  return (
    <Link to={`/prestamos/${p.id}`} className="block space-y-2.5 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <p className="num font-medium text-teal-ink">{codigoPrestamo(p)}</p>
        <StatusBadge estado={p.estado} className="shrink-0" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><dt className="text-xs text-ink-muted">Capital</dt><dd className="num text-ink">{money(p.capital)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Cap. pendiente</dt><dd className="num text-ink">{money(p.capitalPendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Total pendiente</dt><dd className="num font-medium text-ink">{money(p.totalPendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Próx. vencimiento</dt><dd className="text-ink">{p.proximoVencimiento ? fecha(p.proximoVencimiento) : '—'}</dd></div>
      </dl>
    </Link>
  );
}

/** Dato de la ficha: etiqueta pequeña + valor. Si no hay valor se muestra «No registrado» de forma discreta. */
function Dato({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value?: ReactNode; className?: string }) {
  const vacio = value === undefined || value === null || value === '';
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs text-ink-muted"><Icon className="size-3.5" aria-hidden />{label}</dt>
      <dd className={vacio ? 'mt-0.5 text-sm text-ink-muted' : 'num mt-0.5 break-words text-sm font-medium text-ink'}>{vacio ? 'No registrado' : value}</dd>
    </div>
  );
}

function Indicador({ label, children, pie }: { label: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="flex flex-col bg-surface p-5">
      <p className="text-[0.8125rem] text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{children}</p>
      <div className="mt-auto pt-2 text-xs text-ink-muted">{pie}</div>
    </div>
  );
}

/** Edición del celular y el correo del cliente (únicos datos que se pueden cambiar; el resto viene de RENIEC/SUNAT). */
function EditarContacto({ cliente, open, onOpenChange, onGuardado }: { cliente: ClienteDetalle; open: boolean; onOpenChange: (open: boolean) => void; onGuardado: (c: ClienteDetalle) => void }) {
  const [guardando, setGuardando] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactoForm>({
    resolver: zodResolver(contactoSchema),
    defaultValues: { telefono: cliente.telefono ?? '', correo: cliente.correo ?? '' }, mode: 'onTouched', reValidateMode: 'onChange'
  });

  // Cada vez que se abre, parte de los datos guardados.
  useEffect(() => {
    if (open) reset({ telefono: cliente.telefono ?? '', correo: cliente.correo ?? '' });
  }, [open, cliente.telefono, cliente.correo, reset]);

  const guardar = async (v: ContactoForm) => {
    setGuardando(true);
    try {
      const actualizado = await clientesApi.actualizarContacto(cliente.id, v.telefono, v.correo);
      toast.success('Datos de contacto actualizados.');
      onGuardado(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los cambios. Inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => { if (!guardando) onOpenChange(o); }} size="sm" title="Editar contacto"
      description="Actualiza el celular y el correo electrónico del cliente."
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
        <Button variant="primary" type="submit" form="form-contacto" loading={guardando}>Guardar cambios</Button>
      </>}>
      <form id="form-contacto" noValidate onSubmit={handleSubmit(guardar)} className="space-y-4">
        <Field label="Celular" error={errors.telefono?.message}>
          <Input inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" autoComplete="off" {...register('telefono')} />
        </Field>
        <Field label="Correo electrónico" error={errors.correo?.message}>
          <Input type="email" inputMode="email" maxLength={120} placeholder="nombre@dominio.com" autoComplete="off" {...register('correo')} />
        </Field>
      </form>
    </Modal>
  );
}


export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [prestamos, setPrestamos] = useState<PrestamoResumenApi[]>([]);
  const [cargandoPrestamos, setCargandoPrestamos] = useState(true);
  const [errorPrestamos, setErrorPrestamos] = useState<string | null>(null);
  const [intentoPrestamos, setIntentoPrestamos] = useState(0);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!id) {
      setCliente(null);
      setCargando(false);
      return;
    }

    let activo = true;
    setCargando(true);
    setError(null);
    consultarCliente(id)
      .then((datos) => { if (activo) setCliente(datos); })
      .catch((fallo: unknown) => {
        if (activo) setError(fallo instanceof Error ? fallo.message : 'No se pudo consultar el cliente.');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [id, intento]);

  // Los préstamos se piden aparte: si fallan, la ficha del cliente se sigue mostrando.
  useEffect(() => {
    if (!id) return;
    let activo = true;
    setCargandoPrestamos(true);
    setErrorPrestamos(null);
    prestamosApi.listarPorCliente(id)
      .then((datos) => { if (activo) setPrestamos(datos); })
      .catch((fallo: unknown) => {
        if (activo) setErrorPrestamos(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los préstamos.');
      })
      .finally(() => { if (activo) setCargandoPrestamos(false); });
    return () => { activo = false; };
  }, [id, intentoPrestamos]);

  // Capital pendiente, importe pendiente y capacidad disponible los calcula el servidor: es la misma cifra que usa
  // la solicitud de préstamo y la que se valida al registrar.
  const { capacidad, error: errorCapacidad } = useCapacidad(id);

  const resumen = useMemo(() => {
    const suma = (f: (p: PrestamoResumenApi) => number) => r2(prestamos.reduce((a, p) => a + f(p), 0));
    const totalContractual = suma((p) => p.totalContractual);
    const pendiente = capacidad?.importePendiente ?? 0;
    const ultimoDesembolso = prestamos.reduce<string | null>((m, p) => (m === null || p.fechaDesembolso > m ? p.fechaDesembolso : m), null);
    return {
      deuda: capacidad?.capitalPendiente ?? 0,
      pendiente,
      totalContractual,
      usoCubierto: totalContractual > 0 ? ((totalContractual - pendiente) / totalContractual) * 100 : 0,
      disponible: capacidad?.disponible ?? 0,
      limite: capacidad?.limite ?? CFG.limite,
      desembolsado: suma((p) => p.capital),
      ultimoDesembolso,
      conSaldo: prestamos.filter((p) => p.totalPendiente > 0.005).length
    };
  }, [prestamos, capacidad]);

  if (cargando) {
    return <Card className="p-5" role="status">Cargando cliente...</Card>;
  }

  if (error) {
    return (
      <Card className="space-y-3 p-5" role="alert">
        <p>{error}</p>
        <Button onClick={() => setIntento((valor) => valor + 1)}>Reintentar</Button>
      </Card>
    );
  }

  if (!cliente) {
    return <EmptyState icon={SearchX} title="Cliente no encontrado" description="El cliente solicitado no existe." action={<Button asChild variant="primary"><Link to="/clientes">Volver al listado</Link></Button>} />;
  }

  const esEmpresa = cliente.tipoDocumento === 'RUC 20';
  const esNegocio = cliente.tipoDocumento === 'RUC 10';
  const { deuda, pendiente, totalContractual, usoCubierto, disponible, limite, desembolsado, ultimoDesembolso, conSaldo } = resumen;
  const nuevaSolicitud = () => navigate(`/solicitud/${cliente.id}`);
  const subtitulo = [
    String(cliente.numero),
    `${cliente.tipoDocumento} ${cliente.numeroDocumento}`,
    cliente.nombreAgencia,
    cliente.nombreAsesor && `Asesor ${cliente.nombreAsesor}`
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader back={{ to: '/clientes', label: 'Clientes' }}
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{cliente.nombre}<Badge tone={TONO_TIPO[cliente.tipoDocumento]}>{cliente.tipoDocumento}</Badge></span>}
        description={<span className="num">{subtitulo}</span>}
        actions={<Button variant="primary" onClick={nuevaSolicitud}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Ficha de identificación */}
        <Card className="lg:col-span-1" aria-labelledby="datos-cliente">
          <h2 id="datos-cliente" className="sr-only">Datos del cliente</h2>
          <div className="flex items-center gap-4 border-b border-line p-5">
            <Avatar nombre={cliente.nombre} tipo={cliente.tipoDocumento} size="xl" />
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">{esEmpresa ? 'Razón social' : esNegocio ? 'Titular' : 'Nombre completo'}</p>
              <p className="break-words text-base font-semibold leading-snug text-ink">{cliente.nombre}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5">
            <Dato icon={Hash} label="Documento" value={`${cliente.tipoDocumento} ${cliente.numeroDocumento}`} />
            <Dato icon={Hash} label="Código de cliente" value={String(cliente.numero)} />
            <Dato icon={Phone} label="Celular" value={cliente.telefono} />
            <Dato icon={CalendarDays} label="Fecha de registro" value={cliente.creadoEn ? fecha(toISO(new Date(cliente.creadoEn))) : null} />
            <Dato icon={Landmark} label="Agencia" value={cliente.nombreAgencia} />
            <Dato icon={UserRound} label="Asesor asignado" value={cliente.nombreAsesor} />
            <Dato icon={Mail} label="Correo electrónico" value={cliente.correo} className="col-span-2" />
            {esEmpresa && <Dato icon={MapPin} label="Domicilio fiscal" value={cliente.domicilio} className="col-span-2" />}
            {esEmpresa && <Dato icon={UsersRound} label="Representante legal" value={cliente.representanteNombre && `${cliente.representanteNombre}${cliente.representanteDni ? ` · DNI ${cliente.representanteDni}` : ''}`} className="col-span-2" />}
            {esNegocio && <Dato icon={Hash} label="DNI del titular" value={cliente.dniTitular} />}
            {(esEmpresa || esNegocio) && <Dato icon={Hash} label="Estado SUNAT" value={[cliente.estadoSunat, cliente.condicionSunat].filter(Boolean).join(' · ')} className={esNegocio ? undefined : 'col-span-2'} />}
          </dl>
          <div className="border-t border-line px-5 py-4">
            <Button size="sm" onClick={() => setEditando(true)}><Pencil className="size-4" />Editar celular y correo</Button>
          </div>
        </Card>

        {/* Resumen financiero y actividad crediticia */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3">
            <Indicador label="Capital pendiente" pie="Base del límite de endeudamiento">
              <AnimatedNumber value={deuda} format={money} duration={0.5} />
            </Indicador>
            <Indicador label="Importe contractual pendiente"
              pie={totalContractual > 0
                ? <><Meter value={usoCubierto} tone="brand" label={`Cubierto del total contractual: ${Math.round(usoCubierto)} %`} /><p className="mt-1.5">Capital + intereses pactados · total {money(totalContractual)}</p></>
                : 'Capital + intereses pactados, según cronograma'}>
              <AnimatedNumber value={pendiente} format={money} duration={0.5} />
            </Indicador>
            <Indicador label="Capacidad disponible"
              pie={<><LimitMeter deuda={deuda} showText={false} label="Uso del límite" /><p className="mt-1.5">{Math.round((deuda / limite) * 100)} % de {money(limite)} (límite por cliente, toda la empresa)</p></>}>
              <AnimatedNumber value={disponible} format={money} duration={0.5} />
            </Indicador>
          </div>
          {errorCapacidad && <p role="alert" className="-mt-2 text-sm text-danger-ink">No se pudo consultar la capacidad de endeudamiento: {errorCapacidad}</p>}

          <Card>
            <CardHeader as="h2" title="Actividad crediticia" description="Resumen calculado desde los préstamos registrados del cliente" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 sm:grid-cols-4">
              <div><dt className="text-xs text-ink-muted">Préstamos asociados</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{prestamos.length}</dd></div>
              <div><dt className="text-xs text-ink-muted">Con saldo pendiente</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{conSaldo}</dd></div>
              <div><dt className="text-xs text-ink-muted">Capital desembolsado</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{money(desembolsado)}</dd></div>
              <div><dt className="text-xs text-ink-muted">Último desembolso</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{ultimoDesembolso ? fecha(ultimoDesembolso) : '—'}</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader as="h2" title={`Préstamos · ${prestamos.length}`} description="Abre un préstamo para ver su cronograma completo" className="pb-4" />
        <div className="border-t border-line">
          {errorPrestamos ? (
            <div className="space-y-3 p-5" role="alert">
              <p>{errorPrestamos}</p>
              <Button onClick={() => setIntentoPrestamos((valor) => valor + 1)}>Reintentar</Button>
            </div>
          ) : (
            <DataTable data={prestamos} columns={columnas} getRowId={(p) => p.id} textoBusqueda={() => ''} ordenInicial={[{ id: 'numero', desc: true }]}
              cargando={cargandoPrestamos}
              alAbrir={(p) => navigate(`/prestamos/${p.id}`)} tarjeta={(p) => <TarjetaPrestamo p={p} />}
              etiqueta="Préstamos del cliente" unidad="préstamos"
              vacio={<EmptyState icon={Landmark} title="Sin préstamos" description="Este cliente aún no tiene préstamos asociados." action={<Button variant="primary" onClick={nuevaSolicitud}><FilePlus2 className="size-4" />Crear solicitud</Button>} />} />
          )}
        </div>
      </Card>
            <EditarContacto cliente={cliente} open={editando} onOpenChange={setEditando} onGuardado={setCliente} />
    </>
  );
}
