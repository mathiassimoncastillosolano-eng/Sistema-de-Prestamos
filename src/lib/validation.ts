
import { z } from 'zod';
import type { TipoCliente } from '@/types';
import { validarSolicitud } from './finance';


export const TIPOS_CLIENTE: { value: TipoCliente; label: string }[] = [
  { value: 'DNI', label: 'Persona · DNI' },
  { value: 'RUC 10', label: 'Negocio · RUC 10' },
  { value: 'RUC 20', label: 'Empresa · RUC 20' }
];

export const clienteVacio = (tipo: TipoCliente = 'DNI') => ({
  tipo, doc: '', nombre: '', telefono: '', correo: '', dniTitular: '', repNombre: '', repDni: '', domicilio: '', estadoSunat: '', condicionSunat: ''
});

export const CORREO_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export const esDocumentoValido = (tipo: TipoCliente, doc: string) =>
  tipo === 'DNI' ? /^\d{8}$/.test(doc) : new RegExp(`^${tipo === 'RUC 10' ? '10' : '20'}\\d{9}$`).test(doc);

const base = z.object({
  tipo: z.enum(['DNI', 'RUC 10', 'RUC 20']),
  doc: z.string().trim(),
  nombre: z.string().trim(),
  telefono: z.string().trim(),
  correo: z.string().trim(),
  dniTitular: z.string().trim(),
  repNombre: z.string().trim(),
  repDni: z.string().trim(),
  domicilio: z.string().trim(),
  estadoSunat: z.string().trim(),
  condicionSunat: z.string().trim()
});
export type ClienteForm = z.infer<typeof base>;

export const clienteSchema = base.superRefine((v, ctx) => {
  const err = (path: keyof ClienteForm, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });

  if (!esDocumentoValido(v.tipo, v.doc)) {
    err(
      'doc',
      v.tipo === 'DNI'
        ? 'El DNI debe tener exactamente 8 dígitos.'
        : `El RUC ${v.tipo === 'RUC 10' ? '10' : '20'} debe tener 11 dígitos y empezar con ${v.tipo === 'RUC 10' ? '10' : '20'}.`
    );
  }

  if (!v.nombre) {
    err('nombre', 'Consulta el documento para obtener los datos del cliente.');
  }

  if (!v.telefono) {
    err('telefono', 'El celular es obligatorio.');
  } else if (!/^9\d{8}$/.test(v.telefono)) {
    err('telefono', 'El celular debe tener 9 dígitos y empezar con 9.');
  }

  if (!v.correo) {
    err('correo', 'El correo electrónico es obligatorio.');
  } else if (v.correo.length > 120 || !CORREO_REGEX.test(v.correo)) {
    err('correo', 'Ingresa un correo electrónico válido (por ejemplo, nombre@dominio.com).');
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