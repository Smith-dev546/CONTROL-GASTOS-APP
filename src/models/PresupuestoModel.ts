import type { StorageService } from '../services/StorageService';
import { Observable } from './Observable';
import { Presupuesto, type ErroresPresupuesto, type PresupuestoDatos, type PresupuestoDTO } from './Presupuesto';

export type ResultadoPresupuesto =
  | { ok: true; presupuesto: Presupuesto }
  | { ok: false; errores: ErroresPresupuesto };

/** Modelo de presupuestos: un límite mensual por categoría de gasto. */
export class PresupuestoModel extends Observable {
  private presupuestos: Presupuesto[];

  constructor(private readonly storage: StorageService<PresupuestoDTO>) {
    super();
    this.presupuestos = storage
      .cargar()
      .map((dto) => Presupuesto.desdeDTO(dto))
      .filter((p): p is Presupuesto => p !== null);
  }

  getAll(): Presupuesto[] { return [...this.presupuestos]; }
  getById(id: string): Presupuesto | undefined { return this.presupuestos.find((p) => p.id === id); }

  validar(datos: PresupuestoDatos, ignorarId?: string): ErroresPresupuesto {
    const errores = Presupuesto.validar(datos);
    if (!errores.categoria && this.presupuestos.some((p) => p.id !== ignorarId && p.categoria === datos.categoria)) {
      errores.categoria = `Ya existe un presupuesto para ${datos.categoria}. Edítalo en la lista.`;
    }
    return errores;
  }

  addPresupuesto(datos: PresupuestoDatos): ResultadoPresupuesto {
    const errores = this.validar(datos);
    if (Object.keys(errores).length > 0) return { ok: false, errores };
    const presupuesto = Presupuesto.crear(datos);
    this.aplicar([...this.presupuestos, presupuesto]);
    return { ok: true, presupuesto };
  }

  updatePresupuesto(id: string, datos: PresupuestoDatos): ResultadoPresupuesto {
    const errores = this.validar(datos, id);
    if (Object.keys(errores).length > 0) return { ok: false, errores };
    const presupuesto = new Presupuesto(id, datos.categoria, datos.limite);
    this.aplicar(this.presupuestos.map((p) => (p.id === id ? presupuesto : p)));
    return { ok: true, presupuesto };
  }

  deletePresupuesto(id: string): boolean {
    if (!this.getById(id)) return false;
    this.aplicar(this.presupuestos.filter((p) => p.id !== id));
    return true;
  }

  private aplicar(nueva: Presupuesto[]): void {
    if (!this.storage.guardar(nueva.map((p) => p.toDTO()))) {
      throw new Error('No se pudo guardar en el navegador. Revisa el espacio o los permisos de almacenamiento.');
    }
    this.presupuestos = nueva;
    this.notificar();
  }
}
