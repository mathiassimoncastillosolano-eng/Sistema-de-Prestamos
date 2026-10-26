import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, Eye, FilePlus2, Hash, IdCard, Landmark, Mail, MapPin, Pencil, Phone, SearchX, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DataTable } from '@/components/data-display/data-table';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
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
import { cn } from '@/lib/utils';
import { contactoSchema, type ContactoForm } from '@/lib/validation';
import { clientesApi, consultarCliente, puedeSolicitarPrestamo, type ClienteDetalle } from '@/services/clientes-api';
import { prestamosApi, type IntegrantePerfilApi, type PrestamoResumenApi } from '@/services/prestamos-api';
import { usePerfilFinanciero } from '@/hooks/use-perfil-financiero';
import { useCapacidad } from '@/hooks/use-capacidad';
import type { EstadoPrestamo } from '@/types';

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

/** Dato de la ficha: icono a la izquierda, etiqueta pequeña y valor. Sin valor se muestra «No registrado» en gris. */
function Dato({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value?: ReactNode; className?: string }) {
  const vacio = value === undefined || value === null || value === '';
  return (
    <div className={cn('flex min-w-0 items-start gap-3', className)}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className={vacio ? 'mt-0.5 text-sm text-ink-subtle' : 'num mt-0.5 break-words text-[0.9375rem] font-medium text-ink'}>{vacio ? 'No registrado' : value}</dd>
      </div>
    </div>
  );
}

/** Indicador financiero: etiqueta e importe arriba; barra y explicación abajo. */
function Indicador({ label, children, pie }: { label: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="flex flex-col bg-surface p-5">
      <p className="text-[0.8125rem] text-ink-muted">{label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{children}</p>
      <div className="mt-auto pt-4 text-xs leading-relaxed text-ink-muted">{pie}</div>
    </div>
  );
}

const ETIQUETA_RELACION: Record<string, string> = { TITULAR: 'Titular (persona natural)', NEGOCIO_DEL_TITULAR: 'Negocio del titular', SIN_VINCULO: 'Sin vínculo' };

/** Personas y negocios cuya deuda se suma con la de este cliente (DNI ↔ RUC 10 por dni_titular). */
function Vinculados({ integrantes }: { integrantes: IntegrantePerfilApi[] }) {
  const otros = integrantes.filter((i) => !i.consultado);
  return (
    <Card aria-label="Entidades vinculadas">
      <CardHeader as="h2" title="Entidades vinculadas" description="Su deuda se suma a la de este cliente para el límite de endeudamiento (persona natural y sus negocios con RUC 10)." />
      {otros.length === 0
        ? <p className="px-5 pb-5 text-sm text-ink-muted">Este cliente no tiene personas ni negocios vinculados.</p>
        : (
          <ul className="divide-y divide-line border-t border-line">
            {otros.map((i) => (
              <li key={i.clienteId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0">
                  <Link to={`/clientes/${i.clienteId}`} className="font-medium text-teal-ink hover:underline">{i.nombre}</Link>
                  <p className="num text-xs text-ink-muted">{i.tipoDocumento} {i.numeroDocumento} · {ETIQUETA_RELACION[i.relacion] ?? i.relacion}</p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold text-ink">{money(i.capitalPendiente)}</p>
                  <p className="text-xs text-ink-muted">capital pendiente</p>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Card>
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
  const { perfil, error: errorPerfil } = usePerfilFinanciero(id);

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
  // MOROSO y EXTRAJUDICIAL no pueden pedir préstamos nuevos; el servidor también lo rechaza al registrar.
  const puedeSolicitar = puedeSolicitarPrestamo(cliente.estado);
  // Con perfil consolidado, la tabla incluye los préstamos de los vinculados que el usuario puede ver, con su titular.
  const filasPrestamos: PrestamoResumenApi[] = perfil ? perfil.prestamos : prestamos;
  const columnasTabla = perfil?.consolidada
    ? [{
        id: 'titular', header: 'Cliente', accessorFn: (p: PrestamoResumenApi) => (p as { clienteNombre?: string }).clienteNombre ?? '',
        cell: ({ row: { original: p } }: { row: { original: PrestamoResumenApi } }) => {
          const c = p as PrestamoResumenApi & { clienteNombre?: string; clienteTipoDocumento?: string; clienteNumeroDocumento?: string };
          return <div className="min-w-[8rem]"><p className="truncate text-ink">{c.clienteNombre}</p><p className="num truncate text-xs text-ink-muted">{c.clienteTipoDocumento} {c.clienteNumeroDocumento}</p></div>;
        }
      } as ColumnDef<PrestamoResumenApi>, ...columnas]
    : columnas;
  const nuevaSolicitud = () => { if (puedeSolicitar) navigate(`/solicitud/${cliente.id}`); };

  return (
    <>
      <PageHeader back={{ to: '/clientes', label: 'Clientes' }}
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{cliente.nombre}<StatusBadge estado={cliente.estado} /></span>}
        actions={<Button variant="primary" onClick={nuevaSolicitud} disabled={!puedeSolicitar}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      {!puedeSolicitar && (
        <p role="alert" className="mb-5 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">
          <b className="font-semibold">Cliente {cliente.estado}.</b> Tiene cuotas vencidas sin pagar, por lo que no puede solicitar nuevos préstamos.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Ficha de identificación: el nombre ya es el título de la página, aquí solo van los datos. */}
        <Card aria-labelledby="datos-cliente">
          <h2 id="datos-cliente" className="sr-only">Datos del cliente</h2>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 sm:grid-cols-2">
            <Dato icon={IdCard} label="Documento" value={`${cliente.tipoDocumento} ${cliente.numeroDocumento}`} />
            <Dato icon={Hash} label="Código de cliente" value={String(cliente.numero)} />
            <Dato icon={Phone} label="Celular" value={cliente.telefono} />
            <Dato icon={CalendarDays} label="Fecha de registro" value={cliente.creadoEn ? fecha(toISO(new Date(cliente.creadoEn))) : null} />
            <Dato icon={Landmark} label="Agencia" value={cliente.nombreAgencia} />
            <Dato icon={UserRound} label="Asesor asignado" value={cliente.nombreAsesor} />
            <Dato icon={Mail} label="Correo electrónico" value={cliente.correo} className="sm:col-span-2" />
            {esEmpresa && <Dato icon={MapPin} label="Domicilio fiscal" value={cliente.domicilio} className="sm:col-span-2" />}
            {esEmpresa && <Dato icon={UsersRound} label="Representante legal" value={cliente.representanteNombre && `${cliente.representanteNombre}${cliente.representanteDni ? ` · DNI ${cliente.representanteDni}` : ''}`} className="sm:col-span-2" />}
            {esNegocio && <Dato icon={Hash} label="DNI del titular" value={cliente.dniTitular} />}
            {(esEmpresa || esNegocio) && <Dato icon={Hash} label="Estado SUNAT" value={[cliente.estadoSunat, cliente.condicionSunat].filter(Boolean).join(' · ')} className={esNegocio ? undefined : 'sm:col-span-2'} />}
          </dl>
          <div className="border-t border-line px-5 py-4">
            <Button size="sm" className="w-full sm:w-auto" onClick={() => setEditando(true)}><Pencil className="size-4" />Editar celular y correo</Button>
          </div>
        </Card>

        {/* Resumen financiero y actividad crediticia */}
        <div className="flex min-w-0 flex-col gap-5">
          {perfil ? (
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-2 xl:grid-cols-4">
              <Indicador label="Deuda consolidada"
                pie={perfil.consolidada
                  ? <>Propia {money(perfil.deudaPropia)} · Vinculada {money(perfil.deudaVinculada)}<br />Suma de {perfil.integrantes.length} clientes vinculados</>
                  : 'Capital pendiente · base del límite de endeudamiento'}>
                <AnimatedNumber value={perfil.capitalPendiente} format={money} duration={0.5} />
              </Indicador>
              <Indicador label="Cuotas pendientes"
                pie={<>{perfil.cuotasVencidas} vencidas · {perfil.cuotasPagadas} pagadas<br />Importe pendiente (capital + intereses): <span className="num font-medium text-ink">{money(perfil.importePendiente)}</span></>}>
                <AnimatedNumber value={perfil.cuotasPendientes + perfil.cuotasVencidas} format={(n) => String(Math.round(n))} duration={0.5} />
              </Indicador>
              <Indicador label="Límite de endeudamiento"
                pie={<><LimitMeter deuda={perfil.capitalPendiente} showText={false} label="Uso del límite" /><p className="mt-1.5">{Math.round((perfil.capitalPendiente / perfil.limite) * 100)} % utilizado (toda la empresa{perfil.consolidada ? ' y vinculados' : ''})</p></>}>
                <AnimatedNumber value={perfil.limite} format={money} duration={0.5} />
              </Indicador>
              <Indicador label="Capacidad disponible" pie="Máximo que puede solicitar ahora: límite − deuda consolidada">
                <AnimatedNumber value={perfil.disponible} format={money} duration={0.5} />
              </Indicador>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3">
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
          )}
          {errorPerfil && <p role="alert" className="-mt-2 text-sm text-danger-ink">No se pudo consultar el perfil financiero consolidado: {errorPerfil}</p>}
          {perfil && <Vinculados integrantes={perfil.integrantes} />}
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
        <CardHeader as="h2" title={`Préstamos · ${filasPrestamos.length}`} description="Abre un préstamo para ver su cronograma completo" className="pb-4" />
        <div className="border-t border-line">
          {errorPrestamos ? (
            <div className="space-y-3 p-5" role="alert">
              <p>{errorPrestamos}</p>
              <Button onClick={() => setIntentoPrestamos((valor) => valor + 1)}>Reintentar</Button>
            </div>
          ) : (
            <DataTable data={filasPrestamos} columns={columnasTabla} getRowId={(p) => p.id} textoBusqueda={() => ''} ordenInicial={[{ id: 'numero', desc: true }]}
              cargando={cargandoPrestamos}
              alAbrir={(p) => navigate(`/prestamos/${p.id}`)} tarjeta={(p) => <TarjetaPrestamo p={p} />}
              etiqueta="Préstamos del cliente" unidad="préstamos"
              vacio={<EmptyState icon={Landmark} title="Sin préstamos" description="Este cliente aún no tiene préstamos asociados." action={<Button variant="primary" onClick={nuevaSolicitud} disabled={!puedeSolicitar}><FilePlus2 className="size-4" />Crear solicitud</Button>} />} />
          )}
        </div>
      </Card>
      <EditarContacto cliente={cliente} open={editando} onOpenChange={setEditando} onGuardado={setCliente} />
    </>
  );
}
