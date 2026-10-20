import type { Movimiento } from '../models/Movimiento';
import type { EstadoPresupuesto, GastoCategoria, ResumenMensual } from '../models/MovimientoModel';
import { formatoFecha, nombreMes } from '../utils/formato';

export interface DatosReporte {
  resumen: ResumenMensual;
  gastosPorCategoria: GastoCategoria[];
  presupuestos: EstadoPresupuesto[];
  movimientos: Movimiento[];
}

// El PDF usa la fuente estándar (Helvetica): se evitan símbolos fuera de su juego de caracteres.
const usd = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Genera el reporte mensual en PDF. jsPDF se carga bajo demanda para no pesar en la carga inicial. */
export class ReporteService {
  async exportarPDF(datos: DatosReporte): Promise<string> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { resumen: r } = datos;
    const ancho = doc.internal.pageSize.getWidth();
    const margen = 15;
    const util = ancho - margen * 2;
    let y = 0;

    const nuevaPaginaSiHaceFalta = (alto: number) => {
      if (y + alto > 280) { doc.addPage(); y = 20; }
    };
    const titulo = (texto: string) => {
      nuevaPaginaSiHaceFalta(14);
      doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(23, 35, 59);
      doc.text(texto, margen, y);
      y += 6;
    };

    // Encabezado
    doc.setFillColor(23, 35, 59).rect(0, 0, ancho, 32, 'F');
    doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(18);
    doc.text('Reporte mensual de gastos', margen, 15);
    const nombre = nombreMes(r.mes);
    doc.setFont('helvetica', 'normal').setFontSize(11);
    doc.text(nombre.charAt(0).toUpperCase() + nombre.slice(1), margen, 23);
    y = 44;

    // Resumen
    const cifras: [string, string, [number, number, number]][] = [
      ['Ingresos', usd(r.ingresos), [11, 122, 92]],
      ['Gastos', usd(r.gastos), [180, 35, 74]],
      ['Balance', (r.balance < 0 ? '-' : '') + usd(Math.abs(r.balance)), r.balance < 0 ? [180, 35, 74] : [23, 35, 59]],
    ];
    cifras.forEach(([etiqueta, valor, color], i) => {
      const x = margen + (util / 3) * i;
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 103, 121).text(etiqueta, x, y);
      doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...color).text(valor, x, y + 7);
    });
    y += 16;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 103, 121);
    doc.text(`${r.cantidad} movimientos (${r.cantidadIngresos} ingresos, ${r.cantidadGastos} gastos)`, margen, y);
    y += 10;

    // Gráfico de barras: gastos por categoría
    titulo('Gastos por categoría');
    if (datos.gastosPorCategoria.length === 0) {
      doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(91, 103, 121).text('Sin gastos en este mes.', margen, y);
      y += 8;
    } else {
      const maximo = datos.gastosPorCategoria[0].total;
      for (const g of datos.gastosPorCategoria) {
        nuevaPaginaSiHaceFalta(8);
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(23, 35, 59).text(g.categoria, margen, y + 3.5);
        doc.setFillColor(238, 241, 245).rect(margen + 36, y, 90, 5, 'F');
        doc.setFillColor(180, 35, 74).rect(margen + 36, y, Math.max(0.5, (g.total / maximo) * 90), 5, 'F');
        doc.text(`${usd(g.total)} (${Math.round(g.porcentaje)}%)`, margen + 130, y + 3.5);
        y += 8;
      }
    }
    y += 4;

    // Presupuestos
    if (datos.presupuestos.length > 0) {
      titulo('Presupuestos');
      const estado = { ok: 'En orden', cerca: 'Cerca del limite', excedido: 'SUPERADO' } as const;
      for (const e of datos.presupuestos) {
        nuevaPaginaSiHaceFalta(7);
        const color: [number, number, number] = e.nivel === 'excedido' ? [180, 35, 74] : e.nivel === 'cerca' ? [180, 110, 0] : [11, 122, 92];
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(23, 35, 59).text(e.presupuesto.categoria, margen, y);
        doc.text(`${usd(e.gastado)} de ${usd(e.presupuesto.limite)}`, margen + 50, y);
        doc.setFont('helvetica', 'bold').setTextColor(...color).text(`${estado[e.nivel]} (${Math.round(e.porcentaje)}%)`, margen + 120, y);
        y += 6;
      }
      y += 4;
    }

    // Detalle de movimientos
    titulo('Detalle de movimientos');
    const encabezado = () => {
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(91, 103, 121);
      doc.text('Fecha', margen, y); doc.text('Categoria', margen + 28, y);
      doc.text('Descripcion', margen + 70, y); doc.text('Monto', margen + util, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(217, 223, 232).line(margen, y, margen + util, y);
      y += 5;
    };
    encabezado();
    if (datos.movimientos.length === 0) {
      doc.setFont('helvetica', 'normal').setFontSize(10).text('Sin movimientos en este mes.', margen, y);
    }
    for (const m of datos.movimientos) {
      if (y > 275) { doc.addPage(); y = 20; encabezado(); }
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(23, 35, 59);
      doc.text(formatoFecha(m.fecha).replace('.', ''), margen, y);
      doc.text(m.categoria, margen + 28, y);
      doc.text(doc.splitTextToSize(m.descripcion || '-', 70)[0] as string, margen + 70, y);
      const esIngreso = m.tipo === 'ingreso';
      if (esIngreso) doc.setTextColor(11, 122, 92); else doc.setTextColor(180, 35, 74);
      doc.text(`${esIngreso ? '+' : '-'}${usd(m.monto)}`, margen + util, y, { align: 'right' });
      y += 6;
    }

    // Pie de página
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130, 140, 155);
      doc.text(`Control de gastos - Pagina ${i} de ${paginas}`, ancho / 2, 290, { align: 'center' });
    }

    const archivo = `reporte-${r.mes}.pdf`;
    doc.save(archivo);
    return archivo;
  }
}
