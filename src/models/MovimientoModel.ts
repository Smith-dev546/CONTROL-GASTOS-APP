import type { StorageService } from '../services/StorageService';
import { mesDe, redondear2 } from '../utils/formato';
import { Observable } from './Observable';
import {
  Movimiento, categoriasDe,
  type ErroresValidacion, type Filtros, type MovimientoDatos, type MovimientoDTO,
} from './Movimiento';
import type { Presupuesto } from './Presupuesto';

export interface Resumen { ingresos: number; gastos: number; balance: number }
export interface GastoCategoria { categoria: string; total: number; porcentaje: number }

export interface ResumenMensual extends Resumen {
  mes: string;
  cantidad: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  categoriaTop: string | null;
}

export interface ComparacionCategoria { categoria: string; a: number; b: number; diferencia: number }
export interface ComparacionMeses { a: ResumenMensual; b: ResumenMensual; categorias: ComparacionCategoria[] }

export type NivelPresupuesto = 'ok' | 'cerca' | 'excedido';
export interface EstadoPresupuesto {
  presupuesto: Presupuesto;
  gastado: number;
  restante: number;
  porcentaje: number;
  nivel: NivelPresupuesto;
}

export type Resultado =
  | { ok: true; movimiento: Movimiento }
  | { ok: false; errores: ErroresValidacion };

/** Modelo: colección de movimientos, reglas de negocio, cálculos y persistencia. */
export class MovimientoModel extends Observable {
  /** A partir de este porcentaje del límite se considera "cerca del límite". */
  static readonly UMBRAL_AVISO = 0.8;

  private movimientos: Movimiento[];

  constructor(private readonly storage: StorageService<MovimientoDTO>) {
    super();
    this.movimientos = storage
      .cargar()
      .map((dto) => Movimiento.desdeDTO(dto))
      .filter((m): m is Movimiento => m !== null);
  }

  // ---------- Consulta ----------

  getAll(): Movimiento[] { return [...this.movimientos]; }
  getById(id: string): Movimiento | undefined { return this.movimientos.find((m) => m.id === id); }

  /** Búsqueda y filtros combinados (todos deben cumplirse), del más reciente al más antiguo. */
  filtrar(f: Filtros): Movimiento[] {
    const texto = f.busqueda.trim().toLowerCase();
    return this.movimientos
      .filter((m) => f.tipo === 'todos' || m.tipo === f.tipo)
      .filter((m) => !f.categoria || m.categoria === f.categoria)
      .filter((m) => !f.desde || m.fecha >= f.desde)
      .filter((m) => !f.hasta || m.fecha <= f.hasta)
      .filter((m) => !texto
        || m.descripcion.toLowerCase().includes(texto)
        || m.categoria.toLowerCase().includes(texto))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // ---------- Validación (reglas que dependen de la colección) ----------

  validar(datos: MovimientoDatos, ignorarId?: string): ErroresValidacion {
    const errores = Movimiento.validar(datos);
    if (!errores.tipo && !errores.categoria && !categoriasDe(datos.tipo).includes(datos.categoria)) {
      errores.categoria = `"${datos.categoria}" no corresponde a un ${datos.tipo}.`;
    }
    if (Object.keys(errores).length === 0 && this.existeDuplicado(datos, ignorarId)) {
      errores.general = 'Ya existe un movimiento idéntico (mismo tipo, monto, categoría, fecha y descripción).';
    }
    return errores;
  }

  private existeDuplicado(d: MovimientoDatos, ignorarId?: string): boolean {
    return this.movimientos.some((m) => m.id !== ignorarId
      && m.tipo === d.tipo && m.monto === d.monto && m.categoria === d.categoria
      && m.fecha === d.fecha && m.descripcion.toLowerCase() === d.descripcion.toLowerCase());
  }

  // ---------- CRUD ----------

  addMovimiento(datos: MovimientoDatos): Resultado {
    const errores = this.validar(datos);
    if (Object.keys(errores).length > 0) return { ok: false, errores };
    const movimiento = Movimiento.crear(datos);
    this.aplicar([...this.movimientos, movimiento]);
    return { ok: true, movimiento };
  }

  updateMovimiento(id: string, datos: MovimientoDatos): Resultado {
    if (!this.getById(id)) return { ok: false, errores: { general: 'El movimiento ya no existe.' } };
    const errores = this.validar(datos, id);
    if (Object.keys(errores).length > 0) return { ok: false, errores };
    const movimiento = new Movimiento(id, datos.tipo, datos.monto, datos.categoria, datos.descripcion, datos.fecha);
    this.aplicar(this.movimientos.map((m) => (m.id === id ? movimiento : m)));
    return { ok: true, movimiento };
  }

  deleteMovimiento(id: string): boolean {
    if (!this.getById(id)) return false;
    this.aplicar(this.movimientos.filter((m) => m.id !== id));
    return true;
  }

  /** Guarda primero y solo entonces cambia el estado, para no quedar desincronizado si falla el almacenamiento. */
  private aplicar(nueva: Movimiento[]): void {
    if (!this.storage.guardar(nueva.map((m) => m.toDTO()))) {
      throw new Error('No se pudo guardar en el navegador. Revisa el espacio o los permisos de almacenamiento.');
    }
    this.movimientos = nueva;
    this.notificar();
  }

  // ---------- Cálculos ----------

  getBalance(lista: Movimiento[] = this.movimientos): Resumen {
    const suma = (tipo: Movimiento['tipo']) =>
      lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
    const ingresos = suma('ingreso');
    const gastos = suma('gasto');
    return { ingresos: redondear2(ingresos), gastos: redondear2(gastos), balance: redondear2(ingresos - gastos) };
  }

  /** Gastos agrupados por categoría (de mayor a menor), opcionalmente de un mes "YYYY-MM". */
  getGastosPorCategoria(mes?: string): GastoCategoria[] {
    const acumulado = new Map<string, number>();
    for (const m of this.movimientos) {
      if (m.tipo !== 'gasto' || (mes && mesDe(m.fecha) !== mes)) continue;
      acumulado.set(m.categoria, (acumulado.get(m.categoria) ?? 0) + m.monto);
    }
    const total = [...acumulado.values()].reduce((s, v) => s + v, 0);
    return [...acumulado]
      .map(([categoria, t]) => ({ categoria, total: redondear2(t), porcentaje: total ? (t / total) * 100 : 0 }))
      .sort((x, y) => y.total - x.total);
  }

  getResumenMensual(mes: string): ResumenMensual {
    const delMes = this.movimientos.filter((m) => mesDe(m.fecha) === mes);
    return {
      ...this.getBalance(delMes),
      mes,
      cantidad: delMes.length,
      cantidadIngresos: delMes.filter((m) => m.tipo === 'ingreso').length,
      cantidadGastos: delMes.filter((m) => m.tipo === 'gasto').length,
      categoriaTop: this.getGastosPorCategoria(mes)[0]?.categoria ?? null,
    };
  }

  /** Compara dos meses; `diferencia` = mes A − mes B. */
  compararMeses(mesA: string, mesB: string): ComparacionMeses {
    const ga = new Map(this.getGastosPorCategoria(mesA).map((g) => [g.categoria, g.total]));
    const gb = new Map(this.getGastosPorCategoria(mesB).map((g) => [g.categoria, g.total]));
    const categorias = [...new Set([...ga.keys(), ...gb.keys()])]
      .map((categoria) => {
        const a = ga.get(categoria) ?? 0;
        const b = gb.get(categoria) ?? 0;
        return { categoria, a, b, diferencia: redondear2(a - b) };
      })
      .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
    return { a: this.getResumenMensual(mesA), b: this.getResumenMensual(mesB), categorias };
  }

  /** Estado de cada presupuesto frente a los gastos de un mes. */
  checkPresupuesto(presupuestos: Presupuesto[], mes: string): EstadoPresupuesto[] {
    const gastos = new Map(this.getGastosPorCategoria(mes).map((g) => [g.categoria, g.total]));
    return presupuestos.map((presupuesto) => {
      const gastado = gastos.get(presupuesto.categoria) ?? 0;
      const ratio = gastado / presupuesto.limite;
      const nivel: NivelPresupuesto = ratio > 1 ? 'excedido' : ratio >= MovimientoModel.UMBRAL_AVISO ? 'cerca' : 'ok';
      return {
        presupuesto, gastado, nivel,
        restante: redondear2(presupuesto.limite - gastado),
        porcentaje: ratio * 100,
      };
    });
  }
}
