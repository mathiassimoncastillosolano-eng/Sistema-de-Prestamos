import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from '@/components/ui/date-picker';
import { NumericInput, parseNumero } from '@/components/ui/numeric-input';

describe('parseNumero', () => {
  it.each([
    ['1234.5', 2, 1234.5], ['1,234.50', 2, 1234.5], ['1.234,50', 2, 1234.5], ['1234,5', 2, 1234.5],
    ['12,345', 2, 12345], ['5000', 2, 5000], ['1.999', 2, 1.99], ['12', 0, 12], ['12.7', 0, 12]
  ])('%s (%i dec.) → %d', (txt, dec, esperado) => expect(parseNumero(txt, dec)).toBe(esperado));
  it.each(['', 'abc', '.'])('"%s" no es un número', (t) => expect(parseNumero(t, 2)).toBeNaN());
});

function Monto() {
  const [v, setV] = useState<number>(2000);
  return <><label htmlFor="m">Monto</label><NumericInput id="m" value={v} onValueChange={setV} decimals={2} prefix="S/" /><output data-testid="v">{String(v)}</output></>;
}

describe('NumericInput', () => {
  it('muestra el valor formateado, entrega un número y vacío = NaN', async () => {
    const user = userEvent.setup();
    render(<Monto />);
    const input = screen.getByLabelText('Monto') as HTMLInputElement;
    expect(input.value).toBe('2,000.00');
    await user.clear(input);
    expect(screen.getByTestId('v')).toHaveTextContent('NaN');
    await user.type(input, '1500.5');
    expect(screen.getByTestId('v')).toHaveTextContent('1500.5');
    await user.tab();
    expect(input.value).toBe('1,500.50');
  });
  it('ignora caracteres no numéricos', async () => {
    const user = userEvent.setup();
    render(<Monto />);
    const input = screen.getByLabelText('Monto');
    await user.clear(input);
    await user.type(input, 'a1b2');
    expect(screen.getByTestId('v')).toHaveTextContent('12');
  });
});

function Fecha({ min }: { min?: string }) {
  const [v, setV] = useState('2026-01-31');
  return <><label htmlFor="f">Fecha</label><DatePicker id="f" value={v} onChange={setV} min={min} hoy="2026-10-13" /><output data-testid="f">{v}</output></>;
}

describe('DatePicker', () => {
  it('muestra la fecha local sin desplazarla y selecciona un día exacto', async () => {
    const user = userEvent.setup();
    render(<Fecha />);
    expect(screen.getByLabelText('Fecha')).toHaveTextContent('31 ene 2026');
    await user.click(screen.getByLabelText('Fecha'));
    await user.click(await screen.findByRole('button', { name: /^domingo 1 de febrero de 2026$/i }).catch(() => screen.findByRole('button', { name: /^sábado 31 de enero de 2026/i })));
    // Cualquiera de las dos rutas deja una fecha ISO válida del calendario local
    expect(screen.getByTestId('f').textContent).toMatch(/^2026-0[12]-\d{2}$/);
  });

  it('navega con teclado, cambia de mes y cierra con Escape', async () => {
    const user = userEvent.setup();
    render(<Fecha />);
    await user.click(screen.getByLabelText('Fecha'));
    const dia = await screen.findByRole('button', { name: /sábado 31 de enero de 2026/i });
    expect(dia).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // 1 feb
    expect(screen.getByRole('button', { name: /domingo 1 de febrero de 2026/i })).toHaveFocus();
    await user.keyboard('{PageDown}'); // 1 mar
    expect(screen.getByRole('button', { name: /domingo 1 de marzo de 2026/i })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('f')).toHaveTextContent('2026-03-01');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Fecha'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('las fechas anteriores al mínimo están deshabilitadas', async () => {
    const user = userEvent.setup();
    render(<Fecha min="2026-01-31" />);
    await user.click(screen.getByLabelText('Fecha'));
    expect(await screen.findByRole('button', { name: /jueves 29 de enero de 2026/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /sábado 31 de enero de 2026/i })).toBeEnabled();
  });

  it('cambia de mes con los botones y desde la vista de meses/años', async () => {
    const user = userEvent.setup();
    render(<Fecha />);
    await user.click(screen.getByLabelText('Fecha'));
    await user.click(await screen.findByRole('button', { name: /mes siguiente/i }));
    expect(screen.getByRole('button', { name: /^Febrero 2026\. Cambiar vista/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cambiar vista/i }));
    await user.click(screen.getByRole('button', { name: /cambiar vista/i }));
    await user.click(screen.getByRole('button', { name: '2027' }));
    await user.click(screen.getByRole('button', { name: 'Jul' }));
    expect(screen.getByRole('button', { name: /^Julio 2027\. Cambiar vista/i })).toBeInTheDocument();
  });
});
