/* =========================================================
   DATOS MOCK — todos ficticios. Incluyen un REGISTRO HISTÓRICO importado (solo lectura) que respalda las
   cuotas "Cubierta (histórico)"; la aplicación no permite crear pagos.
   Los 15 clientes y 16 préstamos originales se conservan
   (mismos IDs, importes y cronogramas); se añaden clientes y préstamos para poder
   probar búsquedas, filtros, paginación y gráficos.
   ========================================================= */
import { AGENCIAS, CFG } from '@/lib/config';
import { addDays, addMonths } from '@/lib/dates';
import { money } from '@/lib/format';
import { generarCronograma, importarHistorico } from '@/lib/finance';
import type { Actividad, Cliente, Db, Prestamo, RegistroHistorico } from '@/types';

const NOMBRES = [
  'Rosa Elena Quispe Huamán', 'Luis Alberto Cárdenas Rojas', 'Marta Flores Ccori', 'Jorge Salas Vidal',
  'Ana Paredes Luna', 'Carlos Mamani Apaza', 'Lucía Torres Gómez', 'Pedro Ramos Ticona',
  'Elena Vargas Soto', 'Diego Chávez Ruiz', 'Sofía Arce Linares', 'Hugo Benavides Paz'
];
const ASESORES = ['Camila Ortiz', 'Renzo Salazar'] as const;

/** [índiceCliente, capital, plazo, mesesDesdeDesembolso, índiceAsesor, cuotasAtrasadas] */
type FilaPrestamo = readonly [number, number, number, number, number, number];

/** Préstamos del prototipo original (PR-1001 a PR-1016). No modificar: hay pruebas "golden" contra el código antiguo. */
const SEMILLA_PRESTAMOS: readonly FilaPrestamo[] = [
  [0, 6000, 24, 3, 0, 0], [0, 4000, 18, 2, 0, 0], [1, 3000, 12, 6, 1, 2], [2, 2000, 6, 8, 0, 0],
  [3, 1500, 6, 3, 0, 0], [4, 2500, 24, 5, 1, 0], [5, 1000, 6, 7, 0, 3], [6, 3500, 12, 9, 1, 1],
  [7, 2000, 12, 1, 0, 0], [8, 4500, 24, 7, 0, 0], [9, 1500, 12, 10, 1, 4], [10, 3000, 18, 3, 0, 0],
  [11, 6000, 24, 5, 1, 0], [12, 5000, 36, 8, 0, 0], [13, 2500, 12, 2, 1, 0], [14, 1000, 6, 9, 0, 0]
];

/** Préstamos adicionales (PR-1017 en adelante) para enriquecer la demostración. */
const PRESTAMOS_EXTRA: readonly FilaPrestamo[] = [
  [15, 3000, 12, 4, 0, 0], [16, 1500, 6, 5, 1, 1], [17, 5000, 24, 6, 0, 0], [18, 2000, 9, 2, 1, 0],
  [19, 4000, 12, 11, 0, 0], [20, 2500, 12, 3, 1, 0], [21, 1200, 6, 7, 0, 2], [22, 7000, 36, 6, 1, 0],
  [23, 3500, 18, 5, 0, 1], [4, 3000, 12, 2, 1, 0], [11, 1800, 12, 1, 0, 0]
];

const EXTRA_CLIENTES: Cliente[] = [
  { id: 'C016', nombre: 'Andrea Villanueva Cruz', tipo: 'DNI', doc: '47283915', agencia: 'Lima Centro', telefono: '987345120', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -8) },
  { id: 'C017', nombre: 'Miguel Ángel Huertas Salcedo', tipo: 'DNI', doc: '31526784', agencia: 'Arequipa', telefono: '958120364', asesor: 'Renzo Salazar', alta: addMonths(CFG.hoy, -6) },
  { id: 'C018', nombre: 'Patricia Condori Yupanqui', tipo: 'DNI', doc: '23845671', agencia: 'Cusco', telefono: '984771203', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -7) },
  { id: 'C019', nombre: 'Raúl Espinoza Mendoza', tipo: 'DNI', doc: '42971358', agencia: 'Lima Centro', telefono: '991203457', asesor: 'Renzo Salazar', alta: addMonths(CFG.hoy, -3) },
  { id: 'C020', nombre: 'Carmen Rosa Ayala Cornejo', tipo: 'DNI', doc: '29134806', agencia: 'Arequipa', telefono: '959348812', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -12) },
  { id: 'C021', nombre: 'Fernando Zúñiga Barrios', tipo: 'DNI', doc: '44620917', agencia: 'Cusco', telefono: '982660471', asesor: 'Renzo Salazar', alta: addMonths(CFG.hoy, -4) },
  { id: 'C022', nombre: 'Daniela Cáceres Ponce', tipo: 'RUC 10', doc: '10481523904', agencia: 'Lima Centro', telefono: '996802145', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -8), negocio: 'Pastelería y repostería por encargo', dniTitular: '48152390' },
  { id: 'C023', nombre: 'Constructora Pacífico Norte SAC', tipo: 'RUC 20', doc: '20548712390', agencia: 'Cusco', telefono: '984225017', asesor: 'Renzo Salazar', alta: addMonths(CFG.hoy, -7), domicilio: 'Av. El Sol 214, Cusco', representante: { nombre: 'Héctor Palomino Aguirre', dni: '09845231' } },
  { id: 'C024', nombre: 'Distribuidora Valle Verde EIRL', tipo: 'RUC 20', doc: '20601987345', agencia: 'Arequipa', telefono: '958774206', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -6), domicilio: 'Av. Ejército 702, Arequipa', representante: { nombre: 'Silvia Rojas Tapia', dni: '30987452' } }
];

function construirClientes(): Cliente[] {
  const clientes: Cliente[] = NOMBRES.map((nombre, i) => ({
    id: 'C' + String(i + 1).padStart(3, '0'),
    nombre,
    tipo: 'DNI',
    doc: String(30000000 + i * 2749113).slice(0, 8),
    agencia: AGENCIAS[i % 3] as string,
    telefono: '9' + String(10000000 + i * 3711).slice(0, 8),
    asesor: ASESORES[i % 2] as string,
    alta: addMonths(CFG.hoy, -(14 - i))
  }));
  clientes.push(
    { id: 'C013', nombre: 'Inversiones Andes SAC', tipo: 'RUC 20', doc: '20512340011', agencia: 'Lima Centro', telefono: '987120450', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -9), domicilio: 'Av. Javier Prado Este 1450, San Isidro', representante: { nombre: 'Mario Quiroz Delgado', dni: '40125879' } },
    { id: 'C014', nombre: 'Textiles del Sur SRL', tipo: 'RUC 20', doc: '20498765432', agencia: 'Arequipa', telefono: '954220331', asesor: 'Renzo Salazar', alta: addMonths(CFG.hoy, -7), domicilio: 'Calle Mercaderes 312, Arequipa', representante: { nombre: 'Gabriela Núñez Cáceres', dni: '29874512' } },
    { id: 'C015', nombre: 'Sonia Valdivia Paz', tipo: 'RUC 10', doc: '10456789012', agencia: 'Cusco', telefono: '984556120', asesor: 'Camila Ortiz', alta: addMonths(CFG.hoy, -10), negocio: 'Bodega y minimarket', dniTitular: '45678901' },
    ...EXTRA_CLIENTES
  );
  return clientes;
}

export function construirSemilla(): Db {
  const clientes = construirClientes();
  let op = 100;

  /** Importa como histórico la cobertura de las primeras `k` cuotas, cada una en su fecha de vencimiento. */
  const importarCuotas = (inicial: Prestamo, k: number): Prestamo => {
    let p = inicial;
    inicial.cronograma.slice(0, k).forEach((cu) => {
      const reg: RegistroHistorico = { op: 'HIS-' + ++op, fecha: cu.fecha, monto: cu.cuota, usuario: p.asesor };
      p = importarHistorico(p, reg);
    });
    return p;
  };

  const construir = (filas: readonly FilaPrestamo[], desde: number): Prestamo[] =>
    filas.map((s, i) => {
      const [ci, capital, plazo, meses, ai, atraso] = s;
      const c = clientes[ci] as Cliente;
      const inicial: Prestamo = {
        id: 'PR-' + (desde + i), clienteId: c.id, agencia: c.agencia, capital, plazo, tea: CFG.tea,
        desembolso: addMonths(CFG.hoy, -meses), asesor: ASESORES[ai] as string,
        cronograma: generarCronograma(capital, plazo, addMonths(CFG.hoy, -meses)), historico: [], observaciones: ''
      };
      return importarCuotas(inicial, Math.max(0, Math.min(plazo, meses) - atraso));
    });

  const prestamos = [...construir(SEMILLA_PRESTAMOS, 1001), ...construir(PRESTAMOS_EXTRA, 1001 + SEMILLA_PRESTAMOS.length)];

  /* Un préstamo finalizado por plazo: todas sus cuotas figuran cubiertas en el registro histórico importado. */
  {
    const c = clientes[7] as Cliente;
    const desembolso = addMonths(CFG.hoy, -7);
    const base: Prestamo = {
      id: 'PR-' + (1001 + prestamos.length), clienteId: c.id, agencia: c.agencia, capital: 2000, plazo: 6, tea: CFG.tea,
      desembolso, asesor: ASESORES[1], cronograma: generarCronograma(2000, 6, desembolso), historico: [], observaciones: ''
    };
    prestamos.push(importarCuotas(base, 6));
  }

  /* Coherencia: ningún cliente figura dado de alta después de su primer desembolso. */
  clientes.forEach((c) => {
    const primero = prestamos.filter((p) => p.clienteId === c.id).map((p) => p.desembolso).sort()[0];
    if (primero && c.alta > primero) c.alta = addDays(primero, -14);
  });

  return { v: 5, clientes, prestamos, actividad: actividadReciente(clientes, prestamos) };
}

/** El feed de actividad se deriva de los propios registros (altas y registros de préstamos), nunca se inventa aparte. */
function actividadReciente(clientes: Cliente[], prestamos: Prestamo[]): Actividad[] {
  type Evento = Actividad & { dia: string };
  const eventos: Evento[] = [];
  const cliente = (id: string) => clientes.find((c) => c.id === id);
  const dinero = money;
  clientes.forEach((c) => eventos.push({ dia: c.alta, t: '', usuario: c.asesor, tipo: 'Cliente registrado', desc: 'Alta de ' + c.nombre, ref: { entidad: 'cliente', id: c.id } }));
  prestamos.forEach((p) => {
    eventos.push({ dia: p.desembolso, t: '', usuario: p.asesor, tipo: 'Préstamo registrado', desc: `${p.id} por ${dinero(p.capital)} a ${cliente(p.clienteId)?.nombre ?? p.clienteId}`, ref: { entidad: 'prestamo', id: p.id } });
  });
  eventos.sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
  return eventos.slice(0, 40).map(({ dia, ...e }, i) => ({ ...e, t: `${dia} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` }));
}
