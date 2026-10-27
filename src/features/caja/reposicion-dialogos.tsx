import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { money } from '@/lib/format';
import {
  CODIGO_HERMES_LARGO, CajaApiError, LIMITES_TEXTO, cajaApi, formatoCodigoHermes, mensajeError, nuevaClaveIdempotencia,
  type ReposicionDetalleApi
} from '@/services/caja-api';
import { ahoraLocalInput, codigoRep } from './caja-utils';

/** Errores tras los cuales lo que se ve en pantalla ya no es lo que hay en el servidor: se vuelve a cargar el detalle. */
const REQUIEREN_RECARGA = new Set(['VERSION_DESACTUALIZADA', 'ESTADO_INVALIDO', 'CONFLICTO_CONCURRENCIA', 'REPOSICION_NO_ENCONTRADA']);

interface Comun {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
  detalle: ReposicionDetalleApi;
  /** Recibe el detalle nuevo que devuelve el servidor tras la acción. */
  onHecho: (d: ReposicionDetalleApi) => void;
  /** Vuelve a pedir el detalle (si algo cambió mientras el diálogo estaba abierto). */
  onRecargar: () => void;
}

/** Ejecuta una acción del servidor una sola vez a la vez (evita doble clic) y traduce el error para el usuario. */
function useEnvio({ onHecho, onRecargar, onOpenChange }: Pick<Comun, 'onHecho' | 'onRecargar' | 'onOpenChange'>) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bloqueo = useRef(false);

  const ejecutar = async (accion: () => Promise<ReposicionDetalleApi>, exito: string) => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true);
    setError(null);
    try {
      const d = await accion();
      toast.success(exito);
      onHecho(d);
      onOpenChange(false);
    } catch (e) {
      setError(mensajeError(e));
      if (e instanceof CajaApiError && REQUIEREN_RECARGA.has(e.codigo)) onRecargar();
    } finally {
      bloqueo.current = false;
      setEnviando(false);
    }
  };
  return { enviando, error, setError, ejecutar };
}

function Alerta({ children }: { children: ReactNode }) {
  return <p role="alert" className="mt-3 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">{children}</p>;
}

// ---------------------------------------------------------------------------------------------- texto libre
interface TextoProps extends Comun {
  titulo: string;
  descripcion: ReactNode;
  etiqueta: string;
  ayuda?: string;
  minimo?: number;
  confirmar: string;
  peligro?: boolean;
  /** Si el texto es opcional se puede enviar vacío. */
  opcional?: boolean;
  exito: string;
  enviar: (texto: string, version: number) => Promise<ReposicionDetalleApi>;
}

/** Diálogo genérico de una decisión que se explica con un texto (rechazar, pedir aclaración, responder, cancelar, cerrar saldo, conciliar). */
export function DialogoTexto({ open, onOpenChange, detalle, onHecho, onRecargar, titulo, descripcion, etiqueta, ayuda, minimo = LIMITES_TEXTO.justificacionMin, confirmar, peligro, opcional, exito, enviar }: TextoProps) {
  const [texto, setTexto] = useState('');
  const [tocado, setTocado] = useState(false);
  const { enviando, error, setError, ejecutar } = useEnvio({ onHecho, onRecargar, onOpenChange });
  useEffect(() => { if (open) { setTexto(''); setTocado(false); setError(null); } }, [open, setError]);

  const largo = texto.trim().length;
  const falta = !opcional && largo < minimo ? `Escribe al menos ${minimo} caracteres (llevas ${largo}).` : largo > LIMITES_TEXTO.max ? `Máximo ${LIMITES_TEXTO.max} caracteres.` : undefined;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={titulo} description={descripcion}
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={enviando}>Volver</Button>
        <Button variant={peligro ? 'danger' : 'primary'} loading={enviando}
          onClick={() => { setTocado(true); if (!falta) void ejecutar(() => enviar(texto.trim(), detalle.version), exito); }}>
          {confirmar}
        </Button>
      </>}>
      <Field label={etiqueta} hint={ayuda} error={tocado ? falta : undefined} optional={opcional}>
        <Textarea value={texto} maxLength={LIMITES_TEXTO.max + 50} onChange={(e) => setTexto(e.target.value)} rows={4} />
      </Field>
      {error && <Alerta>{error}</Alerta>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------- aprobar
export function DialogoAprobar({ open, onOpenChange, detalle, onHecho, onRecargar }: Comun) {
  const f = detalle.fila;
  const libre = detalle.caja.capacidadLibre;
  const maximo = Math.min(f.montoSolicitado, libre);
  const [monto, setMonto] = useState<number>(maximo);
  const [justificacion, setJustificacion] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tocado, setTocado] = useState(false);
  const { enviando, error, setError, ejecutar } = useEnvio({ onHecho, onRecargar, onOpenChange });

  useEffect(() => {
    if (open) { setMonto(maximo); setJustificacion(''); setCodigo(''); setTocado(false); setError(null); }
  }, [open, maximo, setError]);

  const menor = Number.isFinite(monto) && monto < f.montoSolicitado;
  const errMonto = !Number.isFinite(monto) || monto <= 0 ? 'Indica el monto a autorizar.'
    : monto > f.montoSolicitado ? `No puedes autorizar más de lo solicitado (${money(f.montoSolicitado)}).`
    : monto > libre ? `La caja solo admite ${money(libre)} más (límite ${money(detalle.caja.limite)}).` : undefined;
  const errJust = menor && justificacion.trim().length < LIMITES_TEXTO.justificacionMin ? 'Explica por qué autorizas menos de lo solicitado (mínimo 10 caracteres).' : undefined;
  const errCodigo = !formatoCodigoHermes(codigo) ? `El código Hermes tiene exactamente ${CODIGO_HERMES_LARGO} dígitos.` : undefined;

  const aprobar = () => {
    setTocado(true);
    if (errMonto || errJust || errCodigo) return;
    // El código se envía una sola vez y se borra de la pantalla pase lo que pase: nunca queda guardado ni se repite.
    const enviado = codigo;
    setCodigo('');
    void ejecutar(() => cajaApi.aprobar(f.id, { montoAutorizado: monto, justificacion: justificacion.trim() || undefined, codigoHermes: enviado, version: detalle.version }),
      `Reposición ${codigoRep(f.numero)} aprobada`);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Aprobar ${codigoRep(f.numero)}`} size="lg"
      description="Autorizar no mueve efectivo: el dinero entra a la caja del asesor cuando él registra la recepción."
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={enviando}>Volver</Button>
        <Button variant="primary" loading={enviando} onClick={aprobar}>Aprobar con código Hermes</Button>
      </>}>
      <dl className="num mb-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-control bg-surface-2/70 p-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-ink-muted">Solicitado</dt><dd className="font-semibold">{money(f.montoSolicitado)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Efectivo del asesor</dt><dd className="font-semibold">{money(detalle.caja.saldoActual)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Otras autorizadas sin recibir</dt><dd className="font-semibold">{money(detalle.caja.autorizadoPendienteOtras)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Máximo autorizable</dt><dd className="font-semibold">{money(libre)}</dd></div>
      </dl>
      <div className="grid gap-4">
        <Field label="Monto a autorizar" error={tocado ? errMonto : undefined} hint="Puede ser menor a lo solicitado, nunca mayor.">
          <NumericInput value={monto} onValueChange={setMonto} decimals={2} prefix="S/" maxIntegerDigits={9} inputMode="decimal" />
        </Field>
        <Field label="Justificación" optional={!menor} error={tocado ? errJust : undefined} hint={menor ? 'Obligatoria porque autorizas menos de lo solicitado.' : undefined}>
          <Textarea value={justificacion} onChange={(e) => setJustificacion(e.target.value)} rows={3} maxLength={LIMITES_TEXTO.max} />
        </Field>
        <Field label="Código Hermes" error={tocado ? errCodigo : undefined}
          hint="Lo emite Hermes para esta autorización. El sistema no lo guarda: solo lo envía a Hermes para verificarlo.">
          <Input type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={CODIGO_HERMES_LARGO} value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, '').slice(0, CODIGO_HERMES_LARGO))} spellCheck={false} />
        </Field>
      </div>
      {error && <Alerta>{error}</Alerta>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------- despachar
export function DialogoDespachar({ open, onOpenChange, detalle, onHecho, onRecargar }: Comun) {
  const f = detalle.fila;
  const autorizado = f.montoAutorizado ?? 0;
  const [monto, setMonto] = useState<number>(autorizado);
  const [referencia, setReferencia] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [tocado, setTocado] = useState(false);
  const { enviando, error, setError, ejecutar } = useEnvio({ onHecho, onRecargar, onOpenChange });
  useEffect(() => { if (open) { setMonto(autorizado); setReferencia(''); setComentarios(''); setTocado(false); setError(null); } }, [open, autorizado, setError]);

  const err = !Number.isFinite(monto) || monto <= 0 ? 'Indica el importe enviado.' : monto > autorizado ? `No puedes enviar más de lo autorizado (${money(autorizado)}).` : undefined;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Registrar envío de ${codigoRep(f.numero)}`}
      description="Deja constancia de lo que se despachó. El efectivo del asesor no cambia hasta que él lo reciba."
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={enviando}>Volver</Button>
        <Button variant="primary" loading={enviando}
          onClick={() => { setTocado(true); if (!err) void ejecutar(() => cajaApi.despachar(f.id, { montoEnviado: monto, referencia: referencia.trim() || undefined, comentarios: comentarios.trim() || undefined, version: detalle.version }), 'Envío registrado'); }}>
          Registrar envío
        </Button>
      </>}>
      <div className="grid gap-4">
        <Field label="Importe enviado" error={tocado ? err : undefined} hint={`Autorizado: ${money(autorizado)}`}>
          <NumericInput value={monto} onValueChange={setMonto} decimals={2} prefix="S/" maxIntegerDigits={9} inputMode="decimal" />
        </Field>
        <Field label="Referencia del envío" optional hint="Guía, ruta o transportista.">
          <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={LIMITES_TEXTO.referenciaMax} />
        </Field>
        <Field label="Observaciones" optional>
          <Textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} maxLength={LIMITES_TEXTO.max} />
        </Field>
      </div>
      {error && <Alerta>{error}</Alerta>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------- recibir
export function DialogoRecibir({ open, onOpenChange, detalle, onHecho, onRecargar }: Comun) {
  const f = detalle.fila;
  const pendiente = f.pendienteRecepcion;
  const [importe, setImporte] = useState<number>(pendiente);
  const [cuando, setCuando] = useState('');
  const [referencia, setReferencia] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [tocado, setTocado] = useState(false);
  const clave = useRef(nuevaClaveIdempotencia());
  const { enviando, error, setError, ejecutar } = useEnvio({ onHecho, onRecargar, onOpenChange });
  useEffect(() => {
    if (open) { setImporte(pendiente); setCuando(''); setReferencia(''); setComentarios(''); setTocado(false); setError(null); clave.current = nuevaClaveIdempotencia(); }
  }, [open, pendiente, setError]);

  const saldoFinal = Number.isFinite(importe) ? Math.round((detalle.caja.saldoActual + importe) * 100) / 100 : detalle.caja.saldoActual;
  const err = !Number.isFinite(importe) || importe <= 0 ? 'Indica cuánto recibiste.'
    : importe > pendiente ? `Solo quedan ${money(pendiente)} por recibir de lo autorizado. Si recibiste más, repórtalo como incidencia: el excedente no se contabiliza.`
    : saldoFinal > detalle.caja.limite ? `Con ese ingreso tu caja pasaría de ${money(detalle.caja.limite)}.` : undefined;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Registrar recepción de ${codigoRep(f.numero)}`}
      description="Cuenta el dinero y registra solo lo que realmente recibiste. Puedes registrar recepciones parciales."
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={enviando}>Volver</Button>
        <Button variant="primary" loading={enviando}
          onClick={() => {
            setTocado(true);
            if (err) return;
            void ejecutar(() => cajaApi.recibir(f.id, {
              importe, recibidoEn: cuando ? new Date(cuando).toISOString() : undefined,
              referencia: referencia.trim() || undefined, comentarios: comentarios.trim() || undefined, claveIdempotencia: clave.current
            }), importe >= pendiente ? 'Recepción registrada: reposición completa' : 'Recepción parcial registrada');
          }}>
          Registrar recepción
        </Button>
      </>}>
      <dl className="num mb-4 grid grid-cols-3 gap-3 rounded-control bg-surface-2/70 p-3 text-sm">
        <div><dt className="text-xs text-ink-muted">Autorizado</dt><dd className="font-semibold">{money(f.montoAutorizado ?? 0)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Ya recibido</dt><dd className="font-semibold">{money(f.totalRecibido)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Por recibir</dt><dd className="font-semibold">{money(pendiente)}</dd></div>
      </dl>
      <div className="grid gap-4">
        <Field label="Importe recibido" error={tocado ? err : undefined} hint={`Tu efectivo quedaría en ${money(saldoFinal)}.`}>
          <NumericInput value={importe} onValueChange={setImporte} decimals={2} prefix="S/" maxIntegerDigits={9} inputMode="decimal" />
        </Field>
        <Field label="Fecha y hora de recepción" optional hint="Si la dejas vacía se usa el momento del registro.">
          <Input type="datetime-local" value={cuando} max={ahoraLocalInput()} onChange={(e) => setCuando(e.target.value)} />
        </Field>
        <Field label="Referencia" optional><Input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={LIMITES_TEXTO.referenciaMax} /></Field>
        <Field label="Comentarios" optional><Textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} maxLength={LIMITES_TEXTO.max} /></Field>
      </div>
      {error && <Alerta>{error}</Alerta>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------- incidencia
export function DialogoIncidencia({ open, onOpenChange, detalle, onHecho, onRecargar }: Comun) {
  const f = detalle.fila;
  const [tipo, setTipo] = useState<'EXCEDENTE' | 'FALTANTE' | 'OTRO'>('FALTANTE');
  const [importe, setImporte] = useState<number>(0);
  const [descripcion, setDescripcion] = useState('');
  const [tocado, setTocado] = useState(false);
  const { enviando, error, setError, ejecutar } = useEnvio({ onHecho, onRecargar, onOpenChange });
  useEffect(() => { if (open) { setTipo('FALTANTE'); setImporte(0); setDescripcion(''); setTocado(false); setError(null); } }, [open, setError]);

  const errDesc = descripcion.trim().length < 5 ? 'Describe lo ocurrido (mínimo 5 caracteres).' : undefined;
  const errImp = !Number.isFinite(importe) || importe < 0 ? 'El importe no puede ser negativo.' : undefined;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Reportar incidencia en ${codigoRep(f.numero)}`}
      description="Una incidencia no cambia el efectivo de la caja: deja constancia para que gerencia la revise. Mientras haya una abierta no se puede conciliar."
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={enviando}>Volver</Button>
        <Button variant="primary" loading={enviando}
          onClick={() => { setTocado(true); if (!errDesc && !errImp) void ejecutar(() => cajaApi.reportarIncidencia(f.id, { tipo, importe: importe || 0, descripcion: descripcion.trim() }), 'Incidencia reportada'); }}>
          Reportar
        </Button>
      </>}>
      <div className="grid gap-4">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="FALTANTE">Faltante</option>
            <option value="EXCEDENTE">Excedente</option>
            <option value="OTRO">Otro</option>
          </Select>
        </Field>
        <Field label="Importe involucrado" optional error={tocado ? errImp : undefined}>
          <NumericInput value={importe} onValueChange={setImporte} decimals={2} prefix="S/" maxIntegerDigits={9} inputMode="decimal" />
        </Field>
        <Field label="Descripción" error={tocado ? errDesc : undefined}>
          <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={LIMITES_TEXTO.max} />
        </Field>
      </div>
      {error && <Alerta>{error}</Alerta>}
    </Modal>
  );
}
