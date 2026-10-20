export type TipoMovimiento = 'ingreso' | 'gasto';

/** Datos planos de un movimiento (lo que se guarda en localStorage). */
export interface MovimientoDTO {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  categoria: string;
  descripcion: string;
  fecha: string; // formato ISO: YYYY-MM-DD
}

/** Datos que llegan del formulario, sin id. */
export type MovimientoDatos = Omit<MovimientoDTO, 'id'>;

/** Errores de validación por campo; `general` es para reglas que involucran varios campos. */
export type ErroresValidacion = Partial<Record<keyof MovimientoDatos | 'general', string>>;

/** Criterios combinables de búsqueda y filtrado ('' = sin filtro). */
export interface Filtros {
  tipo: TipoMovimiento | 'todos';
  categoria: string;
  busqueda: string;
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: Filtros = { tipo: 'todos', categoria: '', busqueda: '', desde: '', hasta: '' };

export const CATEGORIAS_GASTO: readonly string[] = [
  'Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Salud', 'Educación', 'Ocio', 'Otros',
];
export const CATEGORIAS_INGRESO: readonly string[] = ['Salario', 'Otros ingresos'];
export const CATEGORIAS: readonly string[] = [...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO];

export const categoriasDe = (tipo: TipoMovimiento): readonly string[] =>
  tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;

export class Movimiento {
  static readonly MONTO_MAXIMO = 1_000_000_000;
  static readonly FECHA_MINIMA = '2000-01-01';
  private static readonly FORMATO_TEXTO = /^[\p{L}\p{N}\s.,#&()\-/']+$/u;

  constructor(
    public readonly id: string,
    public readonly tipo: TipoMovimiento,
    public readonly monto: number,
    public readonly categoria: string,
    public readonly descripcion: string,
    public readonly fecha: string,
  ) {
    const errores = Movimiento.validar({ tipo, monto, categoria, descripcion, fecha });
    const primero = Object.values(errores)[0];
    if (primero) throw new Error(primero);
  }

  /** Validaciones propias de la entidad: formato, rangos y valores permitidos. */
  static validar(datos: MovimientoDatos): ErroresValidacion {
    const errores: ErroresValidacion = {};

    if (datos.tipo !== 'ingreso' && datos.tipo !== 'gasto') {
      errores.tipo = 'Selecciona un tipo válido.';
    }
    if (!Number.isFinite(datos.monto) || datos.monto <= 0) {
      errores.monto = 'Ingresa un monto mayor a cero.';
    } else if (datos.monto > Movimiento.MONTO_MAXIMO) {
      errores.monto = 'El monto máximo permitido es $1,000,000,000.';
    } else if (Number(datos.monto.toFixed(2)) !== datos.monto) {
      errores.monto = 'Usa máximo 2 decimales.';
    }
    if (!CATEGORIAS.includes(datos.categoria)) {
      errores.categoria = 'Selecciona una categoría.';
    }
    if (datos.descripcion !== '') {
      if (datos.descripcion.length < 3) errores.descripcion = 'Usa al menos 3 caracteres o déjala vacía.';
      else if (datos.descripcion.length > 80) errores.descripcion = 'Máximo 80 caracteres.';
      else if (!Movimiento.FORMATO_TEXTO.test(datos.descripcion)) {
        errores.descripcion = 'Solo letras, números y . , # & ( ) - / \'';
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) || Number.isNaN(Date.parse(datos.fecha))) {
      errores.fecha = 'Ingresa una fecha válida.';
    } else if (datos.fecha > Movimiento.hoy()) {
      errores.fecha = 'La fecha no puede ser futura.';
    } else if (datos.fecha < Movimiento.FECHA_MINIMA) {
      errores.fecha = 'La fecha no puede ser anterior al año 2000.';
    }
    return errores;
  }

  /** Fecha de hoy en formato YYYY-MM-DD (zona horaria local). */
  static hoy(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  static crear(datos: MovimientoDatos): Movimiento {
    return new Movimiento(crypto.randomUUID(), datos.tipo, datos.monto, datos.categoria, datos.descripcion, datos.fecha);
  }

  /**
   * Reconstruye un movimiento desde datos guardados; devuelve null si están corruptos.
   * Compatibilidad: si lo único inválido es la descripción (p. ej. datos de una versión
   * anterior con reglas más laxas), se conserva el movimiento sin descripción en lugar de perderlo.
   */
  static desdeDTO(dto: MovimientoDTO): Movimiento | null {
    const descripcion = dto.descripcion ?? '';
    const errores = Movimiento.validar({ tipo: dto.tipo, monto: dto.monto, categoria: dto.categoria, descripcion, fecha: dto.fecha });
    const claves = Object.keys(errores);
    const soloDescripcion = claves.length > 0 && claves.every((k) => k === 'descripcion');
    try {
      return new Movimiento(dto.id, dto.tipo, dto.monto, dto.categoria, soloDescripcion ? '' : descripcion, dto.fecha);
    } catch {
      return null;
    }
  }

  toDTO(): MovimientoDTO {
    return {
      id: this.id, tipo: this.tipo, monto: this.monto,
      categoria: this.categoria, descripcion: this.descripcion, fecha: this.fecha,
    };
  }
}
