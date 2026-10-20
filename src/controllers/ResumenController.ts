import type { MovimientoModel } from '../models/MovimientoModel';
import type { PresupuestoModel } from '../models/PresupuestoModel';
import type { ReporteService } from '../services/ReporteService';
import { esMesValido, mesActual, mesAnterior, mesDe } from '../utils/formato';
import type { Notificador } from '../views/ComponentesUI';
import type { ResumenView } from '../views/ResumenView';

/** Controlador del resumen mensual, gráfico, comparación de meses y exportación a PDF (RF-07, 08, 09). */
export class ResumenController {
  constructor(
    private readonly movimientos: MovimientoModel,
    private readonly presupuestos: PresupuestoModel,
    private readonly vista: ResumenView,
    private readonly notificador: Notificador,
    private readonly reportes: ReporteService,
  ) {}

  iniciar(): void {
    const actual = mesActual();
    this.vista.fijarMeses(actual, mesAnterior(actual));
    this.vista.alCambiarMeses(() => this.renderizar());
    this.vista.alExportar(() => void this.exportar());
    this.movimientos.suscribir(() => this.renderizar());
    this.presupuestos.suscribir(() => this.renderizar());
    this.renderizar();
  }

  private mesesValidos(): { a: string; b: string } | null {
    const { a, b } = this.vista.leerMeses();
    return esMesValido(a) && esMesValido(b) ? { a, b } : null;
  }

  private renderizar(): void {
    const meses = this.mesesValidos();
    if (!meses) return;
    this.vista.renderResumen(this.movimientos.getResumenMensual(meses.a));
    this.vista.renderGrafico(this.movimientos.getGastosPorCategoria(meses.a), meses.a);
    this.vista.renderComparacion(this.movimientos.compararMeses(meses.a, meses.b));
  }

  private async exportar(): Promise<void> {
    const meses = this.mesesValidos();
    if (!meses) {
      this.notificador.mostrar('Selecciona un mes válido para exportar.', 'error');
      return;
    }
    this.vista.setExportando(true);
    try {
      const archivo = await this.reportes.exportarPDF({
        resumen: this.movimientos.getResumenMensual(meses.a),
        gastosPorCategoria: this.movimientos.getGastosPorCategoria(meses.a),
        presupuestos: this.movimientos.checkPresupuesto(this.presupuestos.getAll(), meses.a),
        movimientos: this.movimientos.getAll()
          .filter((m) => mesDe(m.fecha) === meses.a)
          .sort((x, y) => x.fecha.localeCompare(y.fecha)),
      });
      this.notificador.mostrar(`Reporte exportado: ${archivo}`, 'exito');
    } catch {
      this.notificador.mostrar('No se pudo generar el PDF. Intenta de nuevo.', 'error', 6000);
    } finally {
      this.vista.setExportando(false);
    }
  }
}
