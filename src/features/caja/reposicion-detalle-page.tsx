import { AlertTriangle, CheckCircle2, Circle, FileSearch, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useReposicion } from '@/hooks/use-caja';
import { money } from '@/lib/format';
import { cajaApi, type AccionReposicion, type ReposicionDetalleApi } from '@/services/caja-api';
import { ETIQUETA_ACCION, codigoRep, fechaHora } from './caja-utils';
import { EstadoReposicionBadge } from './estado-reposicion-badge';
import { DialogoAprobar, DialogoDespachar, DialogoIncidencia, DialogoRecibir, DialogoTexto } from './reposicion-dialogos';

type Dialogo = AccionReposicion | null;

/** Los cinco importes del flujo, SIEMPRE separados: solicitado ≠ autorizado ≠ enviado ≠ recibido ≠ conciliado. */
function Importes({ d }: { d: ReposicionDetalleApi }) {
  const f = d.fila;
  const conciliado = f.estado === 'COMPLETADA' ? f.totalRecibido : null;
  const filas: { etiqueta: string; valor: number | null; nota: string }[] = [
    { etiqueta: 'Solicitado', valor: f.montoSolicitado, nota: 'Lo que pidió el asesor.' },
    { etiqueta: 'Autorizado', valor: f.montoAutorizado, nota: 'Lo que aprobó gerencia con código Hermes.' },
    { etiqueta: 'Enviado', valor: f.montoEnviado, nota: 'Lo que se despachó (si se registró el envío).' },
    { etiqueta: 'Recibido', valor: f.montoAutorizado === null ? null : f.totalRecibido, nota: 'Lo que el asesor contó y registró: es el único que entra a su caja.' },
    { etiqueta: 'Por recibir', valor: f.montoAutorizado === null ? null : f.pendienteRecepcion, nota: 'Autorizado − recibido − saldo cerrado.' },
    { etiqueta: 'Conciliado', valor: conciliado, nota: 'Confirmado por gerencia al cerrar sin incidencias.' }
  ];
  return (
    <Card>
      <CardHeader title="Importes" description="Cada importe es un dato distinto: autorizar o enviar no suma al efectivo del asesor." />
      <CardBody>
        <dl className="num grid gap-x-6 gap-y-4 sm:grid-cols-3">
          {filas.map((x) => (
            <div key={x.etiqueta}>
              <dt className="text-xs font-medium text-ink-muted">{x.etiqueta}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink">{x.valor === null ? '—' : money(x.valor)}</dd>
              <dd className="text-xs text-ink-muted">{x.nota}</dd>
            </div>
          ))}
        </dl>
        {f.remanenteCerrado > 0 && (
          <p className="mt-4 rounded-control bg-warning-soft p-3 text-sm text-warning-ink">
            Se cerraron <b className="num">{money(f.remanenteCerrado)}</b> sin recibir{d.cierreRemanenteMotivo ? `: ${d.cierreRemanenteMotivo}` : '.'}
            {d.cierreRemanentePor && <> ({d.cierreRemanentePor}, {fechaHora(d.cierreRemanenteEn)})</>}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function LineaTiempo({ d }: { d: ReposicionDetalleApi }) {
  return (
    <Card>
      <CardHeader title="Historial" description="Solo hechos que ocurrieron, con quién y cuándo (hora de Lima)." />
      <CardBody>
        {d.linea.length === 0 ? <p className="text-sm text-ink-muted">Aún no hay eventos.</p> : (
          <ol aria-label="Línea de tiempo" className="relative space-y-4 border-l border-line pl-5">
            {d.linea.map((e, i) => (
              <li key={`${e.creadoEn}-${i}`} className="relative">
                <span aria-hidden className="absolute -left-[1.6rem] top-1 grid size-4 place-items-center rounded-full bg-surface text-teal-ink">
                  {i === d.linea.length - 1 ? <CheckCircle2 className="size-4" /> : <Circle className="size-3" />}
                </span>
                <p className="text-sm font-medium text-ink">
                  {e.etiqueta}{e.importe !== null && e.importe > 0 && <span className="num font-normal text-ink-muted"> · {money(e.importe)}</span>}
                </p>
                <p className="text-xs text-ink-muted">{e.actor} · {fechaHora(e.creadoEn)}</p>
                {e.detalle && <p className="mt-0.5 text-sm text-ink-muted">{e.detalle}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function Recepciones({ d }: { d: ReposicionDetalleApi }) {
  if (d.recepciones.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Recepciones" description="Cada recepción es un registro propio; no se editan ni se borran." />
      <CardBody className="pt-3">
        <ul className="divide-y divide-line">
          {d.recepciones.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="num font-semibold text-ink">{money(r.importe)}</span>
              <span className="text-ink-muted">
                {r.registradoPor} · {fechaHora(r.recibidoEnDeclarado ?? r.registradoEn)}
                {r.recibidoEnDeclarado && <> (registrado {fechaHora(r.registradoEn)})</>}
              </span>
              {(r.referencia || r.comentarios) && <span className="w-full text-ink-muted">{[r.referencia, r.comentarios].filter(Boolean).join(' · ')}</span>}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function Incidencias({ d, esGerencia, onResolver }: { d: ReposicionDetalleApi; esGerencia: boolean; onResolver: (id: string) => void }) {
  if (d.incidencias.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Incidencias" description="Mientras haya una abierta, la reposición no se puede conciliar." />
      <CardBody className="pt-3">
        <ul className="divide-y divide-line">
          {d.incidencias.map((i) => (
            <li key={i.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{i.tipo === 'DIFERENCIA_ENVIO_RECEPCION' ? 'Diferencia entre lo enviado y lo recibido' : i.tipo.charAt(0) + i.tipo.slice(1).toLowerCase()}
                  {i.importe > 0 && <span className="num font-normal text-ink-muted"> · {money(i.importe)}</span>}</span>
                <Badge tone={i.estado === 'ABIERTA' ? 'warning' : 'success'} dot>{i.estado === 'ABIERTA' ? 'Abierta' : 'Resuelta'}</Badge>
              </div>
              <p className="mt-1 text-ink-muted">{i.descripcion}</p>
              <p className="text-xs text-ink-muted">Reportada por {i.reportadaPor} · {fechaHora(i.reportadaEn)}</p>
              {i.estado === 'RESUELTA' && <p className="mt-1 text-xs text-ink-muted">Resuelta por {i.resueltaPor} · {fechaHora(i.resueltaEn)}: {i.resolucion}</p>}
              {i.estado === 'ABIERTA' && esGerencia && <Button size="sm" className="mt-2" onClick={() => onResolver(i.id)}>Resolver</Button>}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default function ReposicionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const esGerencia = usuario?.rol === 'gerencia';
  const { detalle: d, error, cargando, recargar, fijar } = useReposicion(id);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [incidenciaId, setIncidenciaId] = useState<string | null>(null);

  const volver = esGerencia ? { to: '/reposiciones', label: 'Gestión de reposiciones' } : { to: '/caja', label: 'Caja y reposiciones' };

  if (cargando) return (<><PageHeader title="Reposición" back={volver} /><Skeleton className="h-40 w-full" /></>);
  if (error || !d) {
    return (
      <>
        <PageHeader title="Reposición" back={volver} />
        <Card><EmptyState icon={FileSearch} tone="danger" title={error?.noExiste ? 'No encontramos esta reposición' : 'No se pudo cargar la reposición'}
          description={error?.mensaje}
          action={!error?.noExiste ? <Button onClick={recargar}>Reintentar</Button> : undefined} /></Card>
      </>
    );
  }

  const f = d.fila;
  const tiene = (a: AccionReposicion) => d.acciones.includes(a);
  const abrir = (a: AccionReposicion) => () => setDialogo(a);
  const cerrar = (abierto: boolean) => { if (!abierto) { setDialogo(null); setIncidenciaId(null); } };
  const base = { detalle: d, onHecho: fijar, onRecargar: recargar };

  // Botones principales según lo que el SERVIDOR permite en este estado y para este rol.
  const botones: { a: AccionReposicion; variante: 'primary' | 'secondary' | 'danger' }[] = [
    { a: 'APROBAR', variante: 'primary' }, { a: 'DESPACHAR', variante: 'primary' }, { a: 'REGISTRAR_RECEPCION', variante: 'primary' },
    { a: 'CONCILIAR', variante: 'primary' }, { a: 'RESPONDER', variante: 'primary' }, { a: 'OBSERVAR', variante: 'secondary' },
    { a: 'CERRAR_REMANENTE', variante: 'secondary' }, { a: 'REPORTAR_INCIDENCIA', variante: 'secondary' },
    { a: 'RECHAZAR', variante: 'danger' }, { a: 'CANCELAR', variante: 'danger' }
  ];

  return (
    <>
      <PageHeader
        back={volver}
        title={<span className="flex flex-wrap items-center gap-3">{codigoRep(f.numero)} <EstadoReposicionBadge estado={f.estado} /></span>}
        description={`${f.asesor} · ${f.agencia} · solicitada ${fechaHora(f.creadoEn)} · ${d.motivoEtiqueta}`}
        actions={botones.filter((b) => tiene(b.a)).map((b) => <Button key={b.a} variant={b.variante} onClick={abrir(b.a)}>{ETIQUETA_ACCION[b.a]}</Button>)}
      />

      {f.estado === 'OBSERVADA' && d.justificacionDecision && (
        <p role="status" className="mb-4 rounded-control bg-info-soft p-3 text-sm text-info-ink"><b>Gerencia pidió una aclaración:</b> {d.justificacionDecision}</p>
      )}
      {f.estado === 'RECHAZADA' && d.justificacionDecision && (
        <p role="status" className="mb-4 rounded-control bg-danger-soft p-3 text-sm text-danger-ink"><b>Rechazada por {d.decididoPor}:</b> {d.justificacionDecision}</p>
      )}
      {f.incidenciasAbiertas > 0 && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-control bg-warning-soft p-3 text-sm text-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />Hay {f.incidenciasAbiertas} incidencia(s) abierta(s): no se puede conciliar hasta resolverlas.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="grid gap-5">
          <Importes d={d} />
          <Card>
            <CardHeader title="Solicitud" />
            <CardBody className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap text-ink">{d.comentarios}</p>
              <p className="num text-xs text-ink-muted">Al solicitar: efectivo {money(f.saldoAlSolicitar)} · cabían {money(f.capacidadAlSolicitar)}</p>
              {d.decididoPor && f.estado !== 'RECHAZADA' && f.estado !== 'OBSERVADA' && (
                <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                  {d.hermesVerificada && <ShieldCheck className="size-4 text-teal-ink" aria-hidden />}
                  Autorizada por {d.decididoPor} · {fechaHora(d.decididoEn)}{d.hermesVerificada ? ' · código Hermes verificado' : ''}
                  {d.justificacionDecision && <> · {d.justificacionDecision}</>}
                </p>
              )}
              {d.enviadoEn && <p className="text-xs text-ink-muted">Enviada {fechaHora(d.enviadoEn)}{d.enviadoPor ? ` por ${d.enviadoPor}` : ''}{d.referenciaEnvio ? ` · ref. ${d.referenciaEnvio}` : ''}</p>}
              {d.conciliadoEn && <p className="text-xs text-ink-muted">Conciliada {fechaHora(d.conciliadoEn)} por {d.conciliadoPor}{d.conciliacionNota ? `: ${d.conciliacionNota}` : ''}</p>}
            </CardBody>
          </Card>
          <Recepciones d={d} />
          <Incidencias d={d} esGerencia={esGerencia} onResolver={(i) => { setIncidenciaId(i); setDialogo('RESOLVER_INCIDENCIA'); }} />
        </div>
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Caja del asesor" description="Datos de ahora, no de cuando se solicitó." />
            <CardBody>
              <dl className="num space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Efectivo</dt><dd className="font-semibold">{money(d.caja.saldoActual)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Límite</dt><dd className="font-semibold">{money(d.caja.limite)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Otras autorizadas sin recibir</dt><dd className="font-semibold">{money(d.caja.autorizadoPendienteOtras)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Máximo autorizable</dt><dd className="font-semibold">{money(d.caja.capacidadLibre)}</dd></div>
              </dl>
            </CardBody>
          </Card>
          <LineaTiempo d={d} />
        </div>
      </div>

      <DialogoAprobar {...base} open={dialogo === 'APROBAR'} onOpenChange={cerrar} />
      <DialogoDespachar {...base} open={dialogo === 'DESPACHAR'} onOpenChange={cerrar} />
      <DialogoRecibir {...base} open={dialogo === 'REGISTRAR_RECEPCION'} onOpenChange={cerrar} />
      <DialogoIncidencia {...base} open={dialogo === 'REPORTAR_INCIDENCIA'} onOpenChange={cerrar} />
      <DialogoTexto {...base} open={dialogo === 'RECHAZAR'} onOpenChange={cerrar} titulo={`Rechazar ${codigoRep(f.numero)}`}
        descripcion="El asesor verá el motivo. Una solicitud rechazada no se puede reabrir: tendrá que crear otra." etiqueta="Motivo del rechazo"
        confirmar="Rechazar solicitud" peligro exito="Solicitud rechazada" enviar={(t, v) => cajaApi.rechazar(f.id, t, v)} />
      <DialogoTexto {...base} open={dialogo === 'OBSERVAR'} onOpenChange={cerrar} titulo={`Pedir aclaración · ${codigoRep(f.numero)}`}
        descripcion="La solicitud queda observada hasta que el asesor responda. Mientras tanto no se puede aprobar." etiqueta="¿Qué necesitas que aclare?"
        confirmar="Enviar al asesor" exito="Aclaración solicitada" enviar={(t, v) => cajaApi.observar(f.id, t, v)} />
      <DialogoTexto {...base} open={dialogo === 'RESPONDER'} onOpenChange={cerrar} titulo={`Responder a gerencia · ${codigoRep(f.numero)}`}
        descripcion={d.justificacionDecision ? `Gerencia preguntó: «${d.justificacionDecision}»` : 'Responde a lo que pidió gerencia.'} etiqueta="Tu respuesta"
        minimo={10} confirmar="Enviar respuesta" exito="Respuesta enviada" enviar={(t, v) => cajaApi.responder(f.id, t, v)} />
      <DialogoTexto {...base} open={dialogo === 'CANCELAR'} onOpenChange={cerrar} titulo={`Cancelar ${codigoRep(f.numero)}`}
        descripcion="La solicitud se cierra y podrás crear otra." etiqueta="Motivo" opcional confirmar="Cancelar solicitud" peligro
        exito="Solicitud cancelada" enviar={(t, v) => cajaApi.cancelar(f.id, t || undefined, v)} />
      <DialogoTexto {...base} open={dialogo === 'CERRAR_REMANENTE'} onOpenChange={cerrar} titulo={`Cerrar saldo pendiente · ${codigoRep(f.numero)}`}
        descripcion={`Se dejarán de esperar ${money(f.pendienteRecepcion)} que no llegaron. Quedará registrado con tu nombre y la justificación.`}
        etiqueta="Justificación" confirmar="Cerrar saldo pendiente" peligro exito="Saldo pendiente cerrado" enviar={(t, v) => cajaApi.cerrarRemanente(f.id, t, v)} />
      <DialogoTexto {...base} open={dialogo === 'CONCILIAR'} onOpenChange={cerrar} titulo={`Conciliar ${codigoRep(f.numero)}`}
        descripcion={`Confirmas que autorizado (${money(f.montoAutorizado ?? 0)}), recibido (${money(f.totalRecibido)}) y lo cerrado sin recibir (${money(f.remanenteCerrado)}) cuadran y no quedan incidencias abiertas.`}
        etiqueta="Nota de conciliación" opcional confirmar="Conciliar" exito="Reposición conciliada" enviar={(t, v) => cajaApi.conciliar(f.id, t || undefined, v)} />
      <DialogoTexto {...base} open={dialogo === 'RESOLVER_INCIDENCIA' && incidenciaId !== null} onOpenChange={cerrar} titulo="Resolver incidencia"
        descripcion="Explica cómo se resolvió. Quedará en el historial." etiqueta="Resolución" minimo={5} confirmar="Marcar como resuelta"
        exito="Incidencia resuelta" enviar={(t) => cajaApi.resolverIncidencia(incidenciaId as string, t)} />
    </>
  );
}
