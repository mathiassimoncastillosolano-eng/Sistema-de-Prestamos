/** Acceso seguro a localStorage: puede fallar (modo privado, cuota, políticas del navegador). Nunca lanza. */
type Listener = () => void;
let fallos = 0;
const oyentes = new Set<Listener>();

export const storage = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string): boolean {
    try { localStorage.setItem(k, v); return true; } catch { fallos++; oyentes.forEach((l) => l()); return false; }
  },
  del(k: string): boolean {
    try { localStorage.removeItem(k); return true; } catch { return false; }
  }
};

/** Contador de escrituras fallidas: la interfaz lo usa para avisar de que los cambios no persistirán. */
export const salud = {
  subscribe(l: Listener) { oyentes.add(l); return () => { oyentes.delete(l); }; },
  getSnapshot: () => fallos,
  reset() { fallos = 0; }
};
