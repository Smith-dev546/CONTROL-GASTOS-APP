import type { PresupuestoDatos } from '../models/Presupuesto';
import type { MovimientoModel } from '../models/MovimientoModel';
import type { PresupuestoModel } from '../models/PresupuestoModel';
import { esMesValido, formatoMoneda, mesActual } from '../utils/formato';
import type { Confirmacion, Notificador } from '../views/ComponentesUI';
import type { PresupuestoView } from '../views/PresupuestoView';

/** Controlador de presupuestos mensuales por categoría (RF-01). */
export class PresupuestoController {
  private mes = mesActual();
  private editandoId: string | null = null;

  constructor(
    private readonly modelo: PresupuestoModel,
    private readonly movimientos: MovimientoModel,
    private readonly vista: PresupuestoView,
    private readonly notificador: Notificador,
    private readonly confirmacion: Confirmacion,
  ) {}

  iniciar(): void {
    this.vista.fijarMes(this.mes);
    this.vista.alEnviar((d) => this.handleSubmit(d));
    this.vista.alCancelarEdicion(() => this.cancelarEdicion());
    this.vista.alCambiarMes((mes) => {
      if (!esMesValido(mes)) return;
      this.mes = mes;
      this.renderizar();
    });
    this.vista.alAccionar((accion, id) => {
      if (accion === 'editar') this.handleEdit(id);
      else void this.handleDelete(id);
    });
    this.modelo.suscribir(() => this.renderizar());
    this.movimientos.suscribir(() => this.renderizar());
    this.renderizar();
  }

  private handleSubmit(datos: PresupuestoDatos): void {
    try {
      const res = this.editandoId
        ? this.modelo.updatePresupuesto(this.editandoId, datos)
        : this.modelo.addPresupuesto(datos);
      if (!res.ok) {
        this.vista.mostrarErrores(res.errores);
        this.notificador.mostrar('Revisa los campos marcados.', 'error');
        return;
      }
      this.notificador.mostrar(this.editandoId ? 'Presupuesto actualizado.' : 'Presupuesto agregado.', 'exito');
      this.cancelarEdicion();
    } catch (e) {
      this.notificador.mostrar((e as Error).message, 'error', 6000);
    }
  }

  private handleEdit(id: string): void {
    const p = this.modelo.getById(id);
    if (!p) return;
    this.editandoId = id;
    this.vista.cargarEnFormulario(p);
  }

  private async handleDelete(id: string): Promise<void> {
    const p = this.modelo.getById(id);
    if (!p) return;
    const ok = await this.confirmacion.pedir(
      'Eliminar presupuesto',
      `¿Eliminar el presupuesto de ${p.categoria} (${formatoMoneda(p.limite)} al mes)? Tus movimientos no se borran.`);
    if (!ok) return;
    try {
      if (this.editandoId === id) this.cancelarEdicion();
      this.modelo.deletePresupuesto(id);
      this.notificador.mostrar('Presupuesto eliminado.', 'info');
    } catch (e) {
      this.notificador.mostrar((e as Error).message, 'error', 6000);
    }
  }

  private cancelarEdicion(): void {
    this.editandoId = null;
    this.vista.resetearFormulario();
  }

  private renderizar(): void {
    this.vista.renderizarLista(this.movimientos.checkPresupuesto(this.modelo.getAll(), this.mes));
  }
}
