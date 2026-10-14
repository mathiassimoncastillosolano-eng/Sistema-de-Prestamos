import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Landmark, Search, SearchX, User } from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { useDb } from '@/hooks/use-db';
import { DUR, EASE } from '@/lib/motion';
import { buscar, getCliente, type ResultadoBusqueda } from '@/lib/selectors';
import { cn, normalizar } from '@/lib/utils';

/** Resalta el término buscado ignorando tildes y mayúsculas. */
function Resaltado({ texto, q }: { texto: string; q: string }) {
  const nq = normalizar(q);
  const i = nq ? normalizar(texto).indexOf(nq) : -1;
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded-sm bg-copper-soft px-0.5 text-inherit">{texto.slice(i, i + nq.length)}</mark>
      {texto.slice(i + nq.length)}
    </>
  );
}

export function GlobalSearch() {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const db = useDb();
  const navigate = useNavigate();
  const listId = useId();
  const listaRef = useRef<HTMLDivElement>(null);

  const { clientes, prestamos } = useMemo(() => buscar(db, q), [db, q]);
  const plano = useMemo<ResultadoBusqueda[]>(() => [...clientes, ...prestamos], [clientes, prestamos]);
  const consultaValida = q.trim().length >= 2;

  // Atajos: Ctrl/⌘ + K, o "/" fuera de campos de texto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !enCampo)) { e.preventDefault(); setAbierto(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setActivo(0); }, [q]);
  useEffect(() => { listaRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [activo]);

  const cambiar = (o: boolean) => { setAbierto(o); if (!o) setQ(''); };
  const ir = (r: ResultadoBusqueda) => { cambiar(false); navigate(r.ruta); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!plano.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => (a + 1) % plano.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => (a - 1 + plano.length) % plano.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = plano[activo]; if (r) ir(r); }
  };

  const grupo = (titulo: string, items: ResultadoBusqueda[], offset: number) =>
    items.length > 0 && (
      <div role="group" aria-labelledby={`${listId}-${titulo}`} className="py-1">
        <p id={`${listId}-${titulo}`} className="px-4 pb-1 pt-2 text-xs font-medium text-ink-muted">{titulo}</p>
        {items.map((r, i) => {
          const idx = offset + i;
          const sel = idx === activo;
          const cliente = r.tipo === 'cliente' ? getCliente(db, r.id) : undefined;
          return (
            <div key={r.tipo + r.id} id={`${listId}-o-${idx}`} role="option" aria-selected={sel} onMouseMove={() => setActivo(idx)} onClick={() => ir(r)}
              className={cn('mx-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-2.5 py-2', sel && 'bg-surface-2')}>
              {cliente ? <Avatar nombre={cliente.nombre} tipo={cliente.tipo} size="sm" /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-ink"><Landmark className="size-4" aria-hidden /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink"><Resaltado texto={r.titulo} q={q} /></span>
                <span className="block truncate text-xs text-ink-muted"><Resaltado texto={r.detalle} q={q} /></span>
              </span>
              {sel && <CornerDownLeft className="size-4 shrink-0 text-ink-muted" aria-hidden />}
            </div>
          );
        })}
      </div>
    );

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar}>
      <Tip label="Buscar (Ctrl + K)" disabled={false}>
        <button type="button" onClick={() => setAbierto(true)} aria-label="Buscar clientes o préstamos"
          className="hidden h-10 w-full max-w-sm flex-1 items-center gap-2.5 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink-muted transition-colors hover:border-ink-subtle md:flex">
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Buscar clientes o préstamos</span>
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium">Ctrl K</kbd>
        </button>
      </Tip>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buscar clientes o préstamos" onClick={() => setAbierto(true)}><Search className="size-5" /></Button>

      <AnimatePresence>
        {abierto && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-[#0a141f]/55 p-3 pt-[8dvh] backdrop-blur-[2px] sm:p-6 sm:pt-[12dvh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }}>
                <Dialog.Content asChild forceMount aria-describedby={undefined}>
                  <motion.div className="flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-pop" initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: DUR.base, ease: EASE }}>
                    <Dialog.Title className="sr-only">Búsqueda global</Dialog.Title>
                    <div className="flex items-center gap-3 border-b border-line px-4">
                      <Search className="size-5 shrink-0 text-ink-muted" aria-hidden />
                      <input
                        autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                        role="combobox" aria-expanded={plano.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={plano.length ? `${listId}-o-${activo}` : undefined}
                        aria-label="Buscar clientes o préstamos" placeholder="Nombre, DNI, RUC o código de préstamo" autoComplete="off" spellCheck={false}
                        className="h-14 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-subtle"
                      />
                      <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-muted sm:block">Esc</kbd>
                    </div>
                    <div ref={listaRef} id={listId} role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto pb-2">
                      {!consultaValida && (
                        <p className="px-4 py-8 text-center text-sm text-ink-muted">Escribe al menos 2 caracteres. Por ejemplo <span className="font-medium text-ink">quispe</span> o <span className="font-medium text-ink">PR-1006</span>.</p>
                      )}
                      {consultaValida && plano.length === 0 && (
                        <div className="flex flex-col items-center px-4 py-10 text-center" role="status">
                          <SearchX className="mb-2 size-6 text-ink-muted" aria-hidden />
                          <p className="text-sm font-medium text-ink">Sin resultados para “{q.trim()}”</p>
                          <p className="mt-0.5 text-sm text-ink-muted">Prueba con otro nombre, número de documento o código.</p>
                        </div>
                      )}
                      {consultaValida && plano.length > 0 && (
                        <Fragment>
                          {grupo('Clientes', clientes, 0)}
                          {grupo('Préstamos', prestamos, clientes.length)}
                        </Fragment>
                      )}
                    </div>
                    <div className="hidden items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2 text-xs text-ink-muted sm:flex">
                      <span className="flex items-center gap-1.5"><User className="size-3.5" aria-hidden />↑ ↓ para moverte</span>
                      <span>Enter para abrir</span>
                    </div>
                  </motion.div>
                </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
