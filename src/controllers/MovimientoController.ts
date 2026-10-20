import { FILTROS_VACIOS, type Filtros, type MovimientoDatos } from '../models/Movimiento';
import type { MovimientoModel } from '../models/MovimientoModel';
import type { PresupuestoModel } from '../models/PresupuestoModel';
import { formatoMoneda, mesActual, mesDe, nombreMes } from '../utils/formato';
import type { Confirmacion, Notificador } from '../views/ComponentesUI';
import type { MovimientoView } from '../views/MovimientoView';

/** Controlador de movimientos: CRUD, filtros y alertas de presupuesto. */
export class MovimientoController {
  private filtros: Filtros = { ...FILTROS_VACIOS };
  private editandoId: string | null = null;

  constructor(
    private readonly modelo: MovimientoModel,
    private readonly presupuestos: PresupuestoModel,
    private readonly vista: MovimientoView,
    private readonly notificador: Notificador,
    private readonly confirmacion: Confirmacion,
  ) {}

  iniciar(): void {
    this.vista.alEnviar((datos) => (this.editandoId ? this.handleUpdate(datos) : this.handleCreate(datos)));
    this.vista.alCancelarEdicion(() => this.cancelarEdicion());
    this.vista.alCambiarFiltros((f) => this.handleFilter(f));
    this.vista.alAccionarFila((accion, id) => {
      if (accion === 'editar') this.handleEdit(id);
      else void this.handleDelete(id);
    });
    // Observer: cualquier cambio en los modelos redibuja la vista.
    this.modelo.suscribir(() => this.renderizar());
    this.presupuestos.suscribir(() => this.renderizar());
    this.renderizar();
  }

  // ---------- Handlers ----------

  private handleCreate(datos: MovimientoDatos): void {
    try {
      const res = this.modelo.addMovimiento(datos);
      if (!res.ok) return this.rechazar(res.errores);
      this.vista.resetearFormulario();
      this.notificador.mostrar('Movimiento agregado.', 'exito');
      this.avisarPresupuesto(res.movimiento.categoria, res.movimiento.tipo, res.movimiento.fecha);
    } catch (e) {
      this.notificador.mostrar((e as Error).message, 'error', 6000);
    }
  }

  private handleEdit(id: string): void {
    const m = this.modelo.getById(id);
    if (!m) return;
    this.editandoId = id;
    this.vista.cargarEnFormulario(m);
  }

  private handleUpdate(datos: MovimientoDatos): void {
    if (!this.editandoId) return;
    try {
      const res = this.modelo.updateMovimiento(this.editandoId, datos);
      if (!res.ok) return this.rechazar(res.errores);
      this.editandoId = null;
      this.vista.resetearFormulario();
      this.notificador.mostrar('Cambios guardados.', 'exito');
      this.avisarPresupuesto(res.movimiento.categoria, res.movimiento.tipo, res.movimiento.fecha);
    } catch (e) {
      this.notificador.mostrar((e as Error).message, 'error', 6000);
    }
  }

  private async handleDelete(id: string): Promise<void> {
    const m = this.modelo.getById(id);
    if (!m) return;
    const ok = await this.confirmacion.pedir(
      'Eliminar movimiento',
      `¿Eliminar "${m.descripcion || m.categoria}" por ${formatoMoneda(m.monto)}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      if (this.editandoId === id) this.cancelarEdicion();
      this.modelo.deleteMovimiento(id);
      this.notificador.mostrar('Movimiento eliminado.', 'info');
    } catch (e) {
      this.notificador.mostrar((e as Error).message, 'error', 6000);
    }
  }

  private handleFilter(f: Filtros): void {
    if (f.desde && f.hasta && f.desde > f.hasta) {
      this.notificador.mostrar('La fecha "Desde" no puede ser posterior a "Hasta". Se ignoró el rango de fechas.', 'aviso');
      f = { ...f, desde: '', hasta: '' };
    }
    this.filtros = f;
    this.renderizar();
  }

  private cancelarEdicion(): void {
    this.editandoId = null;
    this.vista.resetearFormulario();
  }

  // ---------- Soporte ----------

  private rechazar(errores: Parameters<MovimientoView['mostrarErrores']>[0]): void {
    this.vista.mostrarErrores(errores);
    this.notificador.mostrar('Revisa los campos marcados.', 'error');
  }

  /** RF-06: avisa al instante si el gasto guardado deja una categoría cerca o por encima de su límite. */
  private avisarPresupuesto(categoria: string, tipo: string, fecha: string): void {
    if (tipo !== 'gasto') return;
    const mes = mesDe(fecha);
    const estado = this.modelo.checkPresupuesto(this.presupuestos.getAll(), mes)
      .find((e) => e.presupuesto.categoria === categoria);
    if (!estado || estado.nivel === 'ok') return;
    const detalle = `${formatoMoneda(estado.gastado)} de ${formatoMoneda(estado.presupuesto.limite)} en ${nombreMes(mes)}`;
    this.notificador.mostrar(
      estado.nivel === 'excedido'
        ? `Superaste el presupuesto de ${categoria}: ${detalle}.`
        : `Estás cerca del límite de ${categoria}: ${detalle}.`,
      'aviso', 7000);
  }

  private renderizar(): void {
    const { tipo, categoria, busqueda, desde, hasta } = this.filtros;
    const hayFiltros = tipo !== 'todos' || categoria !== '' || busqueda !== '' || desde !== '' || hasta !== '';
    this.vista.renderizarLista(this.modelo.filtrar(this.filtros), this.modelo.getAll().length, hayFiltros);
    // Balance y alertas siempre consideran TODOS los movimientos, no solo los filtrados.
    this.vista.renderBalance(this.modelo.getBalance());
    const mes = mesActual();
    this.vista.renderAlertaPresupuesto(this.modelo.checkPresupuesto(this.presupuestos.getAll(), mes), mes);
  }
}
