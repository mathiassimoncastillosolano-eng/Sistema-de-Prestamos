import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Normaliza para búsquedas: minúsculas y sin tildes. */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** «Lima Centro» → «Agencia Lima Centro»; respeta nombres que ya empiezan por «Agencia». */
export const etiquetaAgencia = (nombre: string) => (/^agencia\b/i.test(nombre.trim()) ? nombre.trim() : `Agencia ${nombre.trim()}`);
