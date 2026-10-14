import { money } from '@/lib/format';

interface Item { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }
interface Props {
  active?: boolean;
  payload?: readonly Item[];
  label?: string | number;
  etiqueta?: (label: string | number) => string;
  nota?: string;
}

/** Tooltip de gráficos con formato monetario consistente. */
export function ChartTooltip({ active, payload, label, etiqueta, nota }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-card border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink">{label !== undefined ? (etiqueta ? etiqueta(label) : label) : ''}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted"><i aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
            <span className="num font-medium text-ink">{money(Number(p.value))}</span>
          </li>
        ))}
      </ul>
      {nota && <p className="mt-1.5 border-t border-line pt-1.5 text-ink-muted">{nota}</p>}
    </div>
  );
}
