import type { ComparacionMeses, GastoCategoria, ResumenMensual } from '../models/MovimientoModel';
import { formatoMoneda, formatoPorcentaje, nombreMes } from '../utils/formato';
import { el } from './ComponentesUI';

/** Vista del resumen mensual: estadísticas, gráfico de gastos y comparación de dos meses. */
export class ResumenView {
  private readonly mesA = el<HTMLInputElement>('mes-a');
  private readonly mesB = el<HTMLInputElement>('mes-b');
  private readonly btnPdf = el<HTMLButtonElement>('btn-pdf');

  fijarMeses(a: string, b: string): void { this.mesA.value = a; this.mesB.value = b; }
  leerMeses(): { a: string; b: string } { return { a: this.mesA.value, b: this.mesB.value }; }

  alCambiarMeses(cb: () => void): void {
    this.mesA.addEventListener('change', cb);
    this.mesB.addEventListener('change', cb);
  }

  alExportar(cb: () => void): void { this.btnPdf.addEventListener('click', cb); }

  setExportando(activo: boolean): void {
    this.btnPdf.disabled = activo;
    this.btnPdf.textContent = activo ? 'Generando PDF…' : 'Exportar reporte PDF';
  }

  // ---------- Estadísticas del mes ----------

  renderResumen(r: ResumenMensual): void {
    const datos: [string, string, string?][] = [
      ['Ingresos', formatoMoneda(r.ingresos), 'es-ingreso'],
      ['Gastos', formatoMoneda(r.gastos), 'es-gasto'],
      ['Balance', formatoMoneda(r.balance), r.balance < 0 ? 'es-gasto' : undefined],
      ['Movimientos', `${r.cantidad}`],
      ['Mayor gasto en', r.categoriaTop ?? '—'],
    ];
    el('stats').replaceChildren(...datos.map(([etiqueta, valor, clase]) => {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'stat';
      const e = document.createElement('span');
      e.className = 'stat__etiqueta';
      e.textContent = etiqueta;
      const v = document.createElement('strong');
      v.className = `stat__valor ${clase ?? ''}`;
      v.textContent = valor;
      tarjeta.append(e, v);
      return tarjeta;
    }));
  }

  // ---------- Gráfico de barras horizontales (HTML/CSS accesible) ----------

  renderGrafico(datos: GastoCategoria[], mes: string): void {
    const cont = el('grafico');
    if (datos.length === 0) {
      const p = document.createElement('p');
      p.className = 'vacio';
      p.textContent = `No hay gastos registrados en ${nombreMes(mes)}.`;
      cont.replaceChildren(p);
      return;
    }
    const maximo = datos[0].total;
    const lista = document.createElement('ul');
    lista.className = 'grafico';
    lista.setAttribute('aria-label', `Gastos por categoría en ${nombreMes(mes)}`);
    for (const d of datos) {
      const li = document.createElement('li');
      li.className = 'grafico__fila';
      const etiqueta = document.createElement('span');
      etiqueta.className = 'grafico__etiqueta';
      etiqueta.textContent = d.categoria;
      const pista = document.createElement('div');
      pista.className = 'grafico__pista';
      const barra = document.createElement('div');
      barra.className = 'grafico__barra';
      barra.style.width = `${(d.total / maximo) * 100}%`;
      pista.append(barra);
      const valor = document.createElement('span');
      valor.className = 'grafico__valor';
      valor.textContent = `${formatoMoneda(d.total)} · ${formatoPorcentaje(d.porcentaje)}`;
      li.append(etiqueta, pista, valor);
      lista.append(li);
    }
    cont.replaceChildren(lista);
  }

  // ---------- Comparación de dos meses ----------

  renderComparacion(c: ComparacionMeses): void {
    const nA = nombreMes(c.a.mes);
    const nB = nombreMes(c.b.mes);
    el('comp-titulo').textContent = `Comparación: ${nA} vs ${nB}`;

    const tabla = document.createElement('table');
    tabla.className = 'comparacion';
    const cab = tabla.createTHead().insertRow();
    for (const [i, texto] of ['Concepto', nA, nB, 'Diferencia'].entries()) {
      const th = document.createElement('th');
      th.textContent = texto;
      th.scope = 'col';
      if (i > 0) th.className = 'num';
      cab.append(th);
    }
    const cuerpo = tabla.createTBody();

    const fila = (concepto: string, a: number, b: number, sube: 'bueno' | 'malo', destacada = false) => {
      const tr = cuerpo.insertRow();
      if (destacada) tr.className = 'comparacion__seccion';
      const celdas: [string, string][] = [[concepto, ''], [formatoMoneda(a), 'num'], [formatoMoneda(b), 'num'], ['', 'num']];
      celdas.forEach(([t, clase]) => { const td = tr.insertCell(); td.textContent = t; td.className = clase; });
      const dif = Math.round((a - b) * 100) / 100;
      const td = tr.cells[3];
      const pct = b !== 0 ? ` (${dif > 0 ? '+' : ''}${Math.round((dif / b) * 100)}%)` : '';
      td.textContent = dif === 0 ? 'Sin cambio' : `${dif > 0 ? '+' : '−'}${formatoMoneda(Math.abs(dif))}${pct}`;
      if (dif !== 0) td.classList.add((dif > 0) === (sube === 'bueno') ? 'es-ingreso' : 'es-gasto');
    };

    fila('Ingresos', c.a.ingresos, c.b.ingresos, 'bueno');
    fila('Gastos', c.a.gastos, c.b.gastos, 'malo');
    fila('Balance', c.a.balance, c.b.balance, 'bueno');

    if (c.categorias.length > 0) {
      const sep = cuerpo.insertRow();
      sep.className = 'comparacion__subtitulo';
      const td = sep.insertCell();
      td.colSpan = 4;
      td.textContent = 'Gastos por categoría';
      c.categorias.forEach((k) => fila(k.categoria, k.a, k.b, 'malo'));
    }
    el('comparacion').replaceChildren(tabla);
  }
}
