/* Esquemas Zod reutilizables. Las reglas financieras NO se reescriben aquí: se delega en lib/finance.ts. */
import { z } from 'zod';
import { MEDIOS_PAGO, type Prestamo, type TipoCliente } from '@/types';
import { validarPago, validarSolicitud } from './finance';

/* ---------- Clientes ---------- */
export const TIPOS_CLIENTE: { value: TipoCliente; label: string }[] = [
  { value: 'DNI', label: 'Persona · DNI' },
  { value: 'RUC 10', label: 'Negocio · RUC 10' },
  { value: 'RUC 20', label: 'Empresa · RUC 20' }
];

export const clienteVacio = (tipo: TipoCliente = 'DNI') => ({
  tipo, doc: '', nombre: '', telefono: '', dniTitular: '', negocio: '', repNombre: '', repDni: '', domicilio: ''
});

export const esDocumentoValido = (tipo: TipoCliente, doc: string) =>
  tipo === 'DNI' ? /^\d{8}$/.test(doc) : new RegExp(`^${tipo === 'RUC 10' ? '10' : '20'}\\d{9}$`).test(doc);

const base = z.object({
  tipo: z.enum(['DNI', 'RUC 10', 'RUC 20']),
  doc: z.string().trim(),
  nombre: z.string().trim(),
  telefono: z.string().trim(),
  dniTitular: z.string().trim(),
  negocio: z.string().trim(),
  repNombre: z.string().trim(),
  repDni: z.string().trim(),
  domicilio: z.string().trim()
});
export type ClienteForm = z.infer<typeof base>;

/** `docsExistentes` evita duplicados contra el estado actual. */
export const clienteSchema = (docsExistentes: string[]) =>
  base.superRefine((v, ctx) => {
    const err = (path: keyof ClienteForm, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const pref = v.tipo === 'RUC 10' ? '10' : '20';
    if (!esDocumentoValido(v.tipo, v.doc)) err('doc', v.tipo === 'DNI' ? 'El DNI debe tener exactamente 8 dígitos.' : `El RUC ${pref} debe tener 11 dígitos y empezar con ${pref}.`);
    else if (docsExistentes.includes(v.doc)) err('doc', 'Este documento ya está registrado. Búscalo en la lista para no crear un duplicado.');
    if (v.nombre.length < 3) err('nombre', v.tipo === 'RUC 20' ? 'Indica la razón social.' : 'Indica el nombre completo.');
    if (v.telefono && !/^9\d{8}$/.test(v.telefono)) err('telefono', 'El celular debe tener 9 dígitos y empezar con 9.');
    if (v.tipo === 'RUC 10') {
      if (!/^\d{8}$/.test(v.dniTitular)) err('dniTitular', 'Ingresa el DNI del titular (8 dígitos).');
      if (!v.negocio) err('negocio', 'Describe la actividad del negocio.');
    }
    if (v.tipo === 'RUC 20') {
      if (v.repNombre.length < 3) err('repNombre', 'Indica el nombre del representante legal.');
      if (!/^\d{8}$/.test(v.repDni)) err('repDni', 'Ingresa el DNI del representante (8 dígitos).');
      if (!v.domicilio) err('domicilio', 'Indica el domicilio fiscal.');
    }
  });

/* ---------- Solicitud de préstamo ---------- */
export const solicitudSchema = (deudaDe: (clienteId: string) => number) =>
  z
    .object({
      clienteId: z.string().min(1, 'Selecciona un cliente existente.'),
      monto: z.number({ error: 'Ingresa un monto válido.' }),
      plazo: z.number({ error: 'Ingresa el plazo en meses.' }),
      desembolso: z.string().min(1, 'Indica la fecha de desembolso.'),
      observaciones: z.string()
    })
    .superRefine((v, ctx) => {
      const r = validarSolicitud({ ...v, deudaActual: v.clienteId ? deudaDe(v.clienteId) : 0 });
      const vistos = new Set<string>();
      for (const c of r.checks) {
        if (c.ok || vistos.has(c.campo)) continue;
        vistos.add(c.campo);
        ctx.addIssue({ code: 'custom', path: [c.campo], message: c.ayuda });
      }
    });
export type SolicitudForm = z.infer<ReturnType<typeof solicitudSchema>>;

/* ---------- Pagos ---------- */
export const pagoSchema = (prestamoDe: (id: string) => Prestamo | undefined) =>
  z
    .object({
      prestamoId: z.string().min(1, 'Selecciona un préstamo.'),
      modo: z.enum(['cuota', 'anticipada']),
      cuotaN: z.string(),
      monto: z.number({ error: 'Ingresa un importe válido.' }),
      fecha: z.string().min(1, 'Indica la fecha del pago.'),
      medio: z.enum(MEDIOS_PAGO),
      ref: z.string().trim()
    })
    .superRefine((v, ctx) => {
      const p = prestamoDe(v.prestamoId);
      if (!p) return;
      const r = validarPago(p, { monto: v.monto, fecha: v.fecha, ref: v.ref, tipo: v.modo === 'anticipada' ? 'Cancelación anticipada' : 'Pago de cuota' });
      if (!r.ok) ctx.addIssue({ code: 'custom', path: [r.campo === 'prestamoId' ? 'prestamoId' : r.campo], message: r.error });
    });
export type PagoForm = z.infer<ReturnType<typeof pagoSchema>>;
