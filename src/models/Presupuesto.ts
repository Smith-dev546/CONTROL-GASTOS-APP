import { CATEGORIAS_GASTO } from './Movimiento';

export interface PresupuestoDTO {
  id: string;
  categoria: string;
  limite: number; // límite mensual en USD
}

export type PresupuestoDatos = Omit<PresupuestoDTO, 'id'>;
export type ErroresPresupuesto = Partial<Record<keyof PresupuestoDatos, string>>;

/** Límite mensual de gasto para una categoría. Aplica a todos los meses. */
export class Presupuesto {
  static readonly LIMITE_MAXIMO = 1_000_000_000;

  constructor(
    public readonly id: string,
    public readonly categoria: string,
    public readonly limite: number,
  ) {
    const primero = Object.values(Presupuesto.validar({ categoria, limite }))[0];
    if (primero) throw new Error(primero);
  }

  static validar(datos: PresupuestoDatos): ErroresPresupuesto {
    const errores: ErroresPresupuesto = {};
    if (!CATEGORIAS_GASTO.includes(datos.categoria)) {
      errores.categoria = 'Selecciona una categoría de gasto.';
    }
    if (!Number.isFinite(datos.limite) || datos.limite <= 0) {
      errores.limite = 'Ingresa un límite mayor a cero.';
    } else if (datos.limite > Presupuesto.LIMITE_MAXIMO) {
      errores.limite = 'El límite máximo permitido es $1,000,000,000.';
    } else if (Number(datos.limite.toFixed(2)) !== datos.limite) {
      errores.limite = 'Usa máximo 2 decimales.';
    }
    return errores;
  }

  static crear(datos: PresupuestoDatos): Presupuesto {
    return new Presupuesto(crypto.randomUUID(), datos.categoria, datos.limite);
  }

  static desdeDTO(dto: PresupuestoDTO): Presupuesto | null {
    try {
      return new Presupuesto(dto.id, dto.categoria, dto.limite);
    } catch {
      return null;
    }
  }

  toDTO(): PresupuestoDTO {
    return { id: this.id, categoria: this.categoria, limite: this.limite };
  }
}
