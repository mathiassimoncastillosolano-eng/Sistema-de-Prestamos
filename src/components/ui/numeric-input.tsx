import { forwardRef, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Input } from './input';

/**
 * Interpreta lo que escribe el usuario. Admite "1,234.50", "1234.5" y la coma decimal "1234,5".
 * Devuelve NaN si el texto está vacío o no es un número (el esquema Zod lo reporta como inválido).
 */
export function parseNumero(texto: string, decimales: number): number {
  let t = texto.replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return NaN;
  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // El separador que aparece último es el decimal; el otro es de miles.
    t = ultimaComa > ultimoPunto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    // Solo comas: "1,234" / "12,345,678" son miles; "1234,5" es decimal.
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const partes = t.split('.');
  const entera = partes[0] ?? '';
  const dec = decimales > 0 ? (partes[1] ?? '').slice(0, decimales) : '';
  const limpio = `${entera || '0'}${dec ? `.${dec}` : ''}`;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
}

/** Deja como máximo `decimales` cifras después del separador decimal mientras se escribe. */
function recortarDecimales(texto: string, decimales: number): string {
  const ultimaComa = texto.lastIndexOf(',');
  const ultimoPunto = texto.lastIndexOf('.');
  const corte = Math.max(ultimaComa, ultimoPunto);
  if (corte < 0) return texto;
  // "1,234" (solo comas en grupos de tres) son miles, no decimales.
  if (ultimoPunto < 0 && /^\d{1,3}(,\d{3})+$/.test(texto)) return texto;
  return texto.slice(0, corte + 1 + decimales);
}

const formatear = (n: number, decimales: number, agrupar: boolean) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: agrupar }).format(n)
    : '';

interface NumericInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'prefix' | 'defaultValue'> {
  /** Valor numérico (NaN o undefined = vacío). El estado del formulario sigue siendo un número. */
  value: number | undefined;
  onValueChange: (valor: number) => void;
  /** 2 para importes, 0 para enteros. */
  decimals?: number;
  /** Separador de miles al mostrar el valor (no mientras se escribe). */
  grouping?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Máximo de dígitos en la parte entera. Si se omite, no hay límite (comportamiento anterior). */
  maxIntegerDigits?: number;
}

/**
 * Campo numérico sin flechas nativas: el prefijo/sufijo forma parte del control, el valor se formatea al
 * salir del campo y mientras se escribe se respeta lo tecleado. Entrega siempre un `number` al formulario.
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  { value, onValueChange, decimals = 0, grouping = decimals > 0, maxIntegerDigits, onBlur, onFocus, ...props },
  ref
) {
  const [enfocado, setEnfocado] = useState(false);
  const [texto, setTexto] = useState(() => formatear(value ?? NaN, decimals, grouping));

  // Mientras no se edita, el texto sigue al valor del formulario (reset, cambios externos).
  useEffect(() => {
    if (!enfocado) setTexto(formatear(value ?? NaN, decimals, grouping));
  }, [value, enfocado, decimals, grouping]);

  return (
    <Input
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      className="num"
      {...props}
      value={texto}
      onFocus={(e) => { setEnfocado(true); onFocus?.(e); e.currentTarget.select(); }}
      onChange={(e) => {
        let permitido = e.target.value.replace(decimals > 0 ? /[^\d.,]/g : /\D/g, '');
        if (maxIntegerDigits !== undefined) {
          // Recorta los dígitos de la parte entera.
          const corte = permitido.search(/[.,]/);
          const entera = corte >= 0 ? permitido.slice(0, corte) : permitido;
          const resto = corte >= 0 ? permitido.slice(corte) : '';
          permitido = entera.slice(0, maxIntegerDigits) + resto;
        }
        if (decimals > 0) permitido = recortarDecimales(permitido, decimals);
        setTexto(permitido);
        onValueChange(parseNumero(permitido, decimals));
      }}
      onBlur={(e) => { setEnfocado(false); setTexto(formatear(parseNumero(e.target.value, decimals), decimals, grouping)); onBlur?.(e); }}
    />
  );
});
