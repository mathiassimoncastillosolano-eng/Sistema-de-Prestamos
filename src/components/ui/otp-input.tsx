import { Eye, EyeOff } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { controlBase } from './input';

interface OtpInputProps {
  value: string;
  onChange: (valor: string) => void;
  largo?: number;
  id?: string;
  disabled?: boolean;
  /** Enmascara los dígitos (con botón para verlos). */
  oculto?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/** Código de N dígitos en casillas separadas: avanza solo, admite pegar el código completo y borrar con retroceso. */
export function OtpInput({ value, onChange, largo = 8, id, disabled, oculto = true, 'aria-label': etiqueta = 'Código', ...aria }: OtpInputProps) {
  const [ver, setVer] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digitos = value.replace(/\D/g, '').slice(0, largo);

  const enfocar = (i: number) => {
    const n = Math.max(0, Math.min(largo - 1, i));
    refs.current[n]?.focus();
    refs.current[n]?.select();
  };
  const poner = (texto: string, desde: number) => {
    const limpio = texto.replace(/\D/g, '');
    if (!limpio) return;
    const nuevo = (digitos.slice(0, desde) + limpio).slice(0, largo);
    onChange(nuevo + digitos.slice(nuevo.length));
    enfocar(Math.min(desde + limpio.length, largo - 1));
  };
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digitos[i]) onChange(digitos.slice(0, i) + digitos.slice(i + 1));
      else if (i > 0) { onChange(digitos.slice(0, i - 1) + digitos.slice(i)); enfocar(i - 1); }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); enfocar(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); enfocar(i + 1); }
  };
  const alPegar = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault();
    poner(e.clipboardData.getData('text'), i);
  };

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={etiqueta} className="flex min-w-0 flex-1 justify-between gap-1.5 sm:gap-2">
        {Array.from({ length: largo }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            id={i === 0 ? id : undefined}
            type={oculto && !ver ? 'password' : 'text'}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            spellCheck={false}
            maxLength={1}
            disabled={disabled}
            value={digitos[i] ?? ''}
            aria-label={`${etiqueta}, dígito ${i + 1} de ${largo}`}
            aria-invalid={aria['aria-invalid']}
            aria-describedby={i === 0 ? aria['aria-describedby'] : undefined}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => poner(e.target.value, i)}
            onKeyDown={(e) => alTeclear(e, i)}
            onPaste={(e) => alPegar(e, i)}
            className={cn(controlBase, 'num h-12 min-w-0 flex-1 px-0 text-center text-lg font-semibold sm:h-12', digitos[i] && 'border-teal/60 bg-teal-soft/40')}
          />
        ))}
      </div>
      {oculto && (
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar código' : 'Mostrar código'}
          aria-pressed={ver}
          className="grid size-10 shrink-0 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25"
        >
          {ver ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}
