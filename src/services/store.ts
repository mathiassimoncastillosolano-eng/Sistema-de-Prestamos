/* =========================================================
   STORE DE DATOS (fuente única de verdad del prototipo).
   Estado inmutable + suscripción para React (useSyncExternalStore) + persistencia en localStorage.
   Para un backend real: reemplazar services/actions.ts y este store por llamadas a servicios.
   ========================================================= */
import { STORAGE_KEYS } from '@/lib/config';
import { construirSemilla } from '@/mocks/seed';
import type { Db } from '@/types';
import { storage } from './storage';

type Listener = () => void;
const oyentes = new Set<Listener>();

function esDbValida(d: unknown): d is Db {
  const x = d as Partial<Db> | null;
  return !!x && x.v === 6 && Array.isArray(x.clientes) && Array.isArray(x.prestamos) && Array.isArray(x.actividad);
}

function cargar(): Db {
  const raw = storage.get(STORAGE_KEYS.db);
  if (raw) {
    try {
      const d: unknown = JSON.parse(raw);
      if (esDbValida(d)) return d;
    } catch {
      /* datos corruptos: se regeneran desde la semilla */
    }
  }
  return construirSemilla();
}

let estado: Db = cargar();

export const getDb = () => estado;
export const subscribe = (l: Listener) => { oyentes.add(l); return () => { oyentes.delete(l); }; };

/** Reemplaza el estado, lo persiste y notifica a la interfaz. Devuelve false si no se pudo persistir. */
export function commit(siguiente: Db): boolean {
  estado = siguiente;
  const ok = storage.set(STORAGE_KEYS.db, JSON.stringify(siguiente));
  oyentes.forEach((l) => l());
  return ok;
}

export function restaurarDb() {
  storage.del(STORAGE_KEYS.db);
  commit(construirSemilla());
}

/** Solo para pruebas: recarga el estado desde almacenamiento/semilla. */
export function _recargarParaPruebas() {
  estado = cargar();
  oyentes.forEach((l) => l());
}
