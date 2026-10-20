import {
  CATEGORIAS, FILTROS_VACIOS, Movimiento, categoriasDe,
  type ErroresValidacion, type Filtros, type MovimientoDatos, type TipoMovimiento,
} from '../models/Movimiento';
import type { EstadoPresupuesto, Resumen } from '../models/MovimientoModel';
import { formatoFecha, formatoMoneda, nombreMes } from '../utils/formato';
import { el } from './ComponentesUI';

export type AccionFila = 'editar' | 'eliminar';

/** Vista de movimientos: formulario, lista, filtros, balance y alerta de presupuesto. */
export class MovimientoView {
  private readonly form = el<HTMLFormElement>('form-movimiento');
  private readonly monto = el<HTMLInputElement>('monto');
  private readonly categoria = el<HTMLSelectElement>('categoria');
  private readonly descripcion = el<HTMLInputElement>('descripcion');
  private readonly fecha = el<HTMLInputElement>('fecha');
  private readonly btnGuardar = el<HTMLButtonElement>('btn-guardar');
  private readonly btnCancelar = el<HTMLButtonElement>('btn-cancelar');
  private readonly formTitulo = el('form-titulo');
  private readonly tbody = el<HTMLTableSectionElement>('lista-movimientos');
  private readonly vacio = el('vacio');
  private readonly contador = el('contador');
  private readonly fBusqueda = el<HTMLInputElement>('filtro-busqueda');
  private readonly fTipo = el<HTMLSelectElement>('filtro-tipo');
  private readonly fCategoria = el<HTMLSelectElement>('filtro-categoria');
  private readonly fDesde = el<HTMLInputElement>('filtro-desde');
  private readonly fHasta = el<HTMLInputElement>('filtro-hasta');
  private readonly alerta = el('alerta-presupuesto');

  constructor() {
    this.fCategoria.replaceChildren(
      new Option('Todas las categorías', ''),
      ...CATEGORIAS.map((c) => new Option(c, c)),
    );
    // Las categorías del formulario dependen del tipo elegido.
    this.form.querySelectorAll('input[name="tipo"]').forEach((r) =>
      r.addEventListener('change', () => this.poblarCategorias()));
    this.resetearFormulario();
  }

  // ---------- Eventos (los atiende el controlador) ----------

  alEnviar(cb: (datos: MovimientoDatos) => void): void {
    this.form.addEventListener('submit', (e) => { e.preventDefault(); cb(this.leerFormulario()); });
  }

  alCancelarEdicion(cb: () => void): void {
    this.btnCancelar.addEventListener('click', cb);
  }

  alCambiarFiltros(cb: (f: Filtros) => void): void {
    const emitir = () => cb(this.leerFiltros());
    for (const campo of [this.fBusqueda, this.fTipo, this.fCategoria, this.fDesde, this.fHasta]) {
      campo.addEventListener(campo === this.fBusqueda ? 'input' : 'change', emitir);
    }
    el('btn-limpiar').addEventListener('click', () => {
      this.fBusqueda.value = ''; this.fTipo.value = FILTROS_VACIOS.tipo; this.fCategoria.value = '';
      this.fDesde.value = ''; this.fHasta.value = '';
      emitir();
    });
  }

  /** Delegación de eventos: un solo listener para editar/eliminar en toda la tabla. */
  alAccionarFila(cb: (accion: AccionFila, id: string) => void): void {
    this.tbody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-accion]');
      if (btn?.dataset.id) cb(btn.dataset.accion as AccionFila, btn.dataset.id);
    });
  }

  // ---------- Formulario ----------

  private leerFormulario(): MovimientoDatos {
    const tipo = this.form.querySelector<HTMLInputElement>('input[name="tipo"]:checked')?.value;
    return {
      tipo: tipo as TipoMovimiento,
      monto: this.monto.value === '' ? NaN : Number(this.monto.value),
      categoria: this.categoria.value,
      descripcion: this.descripcion.value.trim(),
      fecha: this.fecha.value,
    };
  }

  private tipoActual(): TipoMovimiento {
    return (this.form.querySelector<HTMLInputElement>('input[name="tipo"]:checked')?.value ?? 'gasto') as TipoMovimiento;
  }

  private poblarCategorias(seleccion = ''): void {
    this.categoria.replaceChildren(
      new Option('Selecciona…', ''),
      ...categoriasDe(this.tipoActual()).map((c) => new Option(c, c)),
    );
    this.categoria.value = seleccion;
  }

  mostrarErrores(errores: ErroresValidacion): void {
    this.form.querySelectorAll<HTMLElement>('[data-error]').forEach((s) => {
      const campo = s.dataset.error as keyof ErroresValidacion;
      const mensaje = errores[campo] ?? '';
      s.textContent = mensaje;
      if (campo === 'general') return;
      const input = s.previousElementSibling as HTMLElement | null;
      if (mensaje) input?.setAttribute('aria-invalid', 'true');
      else input?.removeAttribute('aria-invalid');
    });
    this.form.querySelector<HTMLElement>('[aria-invalid]')?.focus();
  }

  cargarEnFormulario(m: Movimiento): void {
    this.mostrarErrores({});
    this.form.querySelector<HTMLInputElement>(`input[name="tipo"][value="${m.tipo}"]`)!.checked = true;
    this.poblarCategorias(m.categoria);
    this.monto.value = String(m.monto);
    this.descripcion.value = m.descripcion;
    this.fecha.value = m.fecha;
    this.formTitulo.textContent = 'Editar movimiento';
    this.btnGuardar.textContent = 'Guardar cambios';
    this.btnCancelar.hidden = false;
    this.monto.focus();
    this.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  resetearFormulario(): void {
    this.form.reset();
    this.poblarCategorias();
    this.fecha.value = Movimiento.hoy();
    this.fecha.max = Movimiento.hoy();
    this.fecha.min = Movimiento.FECHA_MINIMA;
    this.mostrarErrores({});
    this.formTitulo.textContent = 'Nuevo movimiento';
    this.btnGuardar.textContent = 'Agregar movimiento';
    this.btnCancelar.hidden = true;
  }

  // ---------- Filtros ----------

  private leerFiltros(): Filtros {
    return {
      tipo: this.fTipo.value as Filtros['tipo'],
      categoria: this.fCategoria.value,
      busqueda: this.fBusqueda.value.trim(),
      desde: this.fDesde.value,
      hasta: this.fHasta.value,
    };
  }

  // ---------- Renderizado ----------

  renderBalance(r: Resumen): void {
    el('resumen-ingresos').textContent = formatoMoneda(r.ingresos);
    el('resumen-gastos').textContent = formatoMoneda(r.gastos);
    const balance = el('resumen-balance');
    balance.textContent = formatoMoneda(r.balance);
    balance.classList.toggle('es-gasto', r.balance < 0);
  }

  /** Muestra un banner con los presupuestos superados (o cercanos al límite) del mes indicado. */
  renderAlertaPresupuesto(estados: EstadoPresupuesto[], mes: string): void {
    const excedidos = estados.filter((e) => e.nivel === 'excedido');
    const cercanos = estados.filter((e) => e.nivel === 'cerca');
    this.alerta.replaceChildren();
    this.alerta.hidden = excedidos.length + cercanos.length === 0;
    this.alerta.classList.toggle('banner--aviso', excedidos.length === 0);
    if (this.alerta.hidden) return;

    const titulo = document.createElement('strong');
    titulo.textContent = excedidos.length
      ? `Superaste ${excedidos.length === 1 ? 'un presupuesto' : `${excedidos.length} presupuestos`} en ${nombreMes(mes)}`
      : `Estás cerca del límite en ${nombreMes(mes)}`;
    const lista = document.createElement('ul');
    for (const e of [...excedidos, ...cercanos]) {
      const li = document.createElement('li');
      li.textContent = e.nivel === 'excedido'
        ? `${e.presupuesto.categoria}: ${formatoMoneda(e.gastado)} de ${formatoMoneda(e.presupuesto.limite)} (excedido por ${formatoMoneda(-e.restante)})`
        : `${e.presupuesto.categoria}: ${formatoMoneda(e.gastado)} de ${formatoMoneda(e.presupuesto.limite)} (${Math.round(e.porcentaje)}%)`;
      lista.append(li);
    }
    this.alerta.append(titulo, lista);
  }

  renderizarLista(movimientos: Movimiento[], total: number, hayFiltros: boolean): void {
    this.tbody.replaceChildren(...movimientos.map((m) => this.crearFila(m)));
    this.contador.textContent = total ? `(${movimientos.length} de ${total})` : '';
    this.vacio.hidden = movimientos.length > 0;
    this.vacio.textContent = total === 0
      ? 'Aún no hay movimientos. Registra el primero en el formulario.'
      : hayFiltros ? 'Ningún movimiento coincide con los filtros.' : '';
  }

  private crearFila(m: Movimiento): HTMLTableRowElement {
    const tr = document.createElement('tr');
    const celda = (texto: string, clase?: string) => {
      const td = document.createElement('td');
      td.textContent = texto;
      if (clase) td.className = clase;
      tr.append(td);
      return td;
    };
    celda(formatoFecha(m.fecha), 'fecha');
    celda(m.descripcion || '—', 'detalle');
    const chip = document.createElement('span');
    chip.className = `chip chip--${m.tipo}`;
    chip.textContent = m.categoria;
    celda('', 'categoria').append(chip);
    celda(`${m.tipo === 'ingreso' ? '+' : '−'}${formatoMoneda(m.monto)}`, `num es-${m.tipo}`);

    const acciones = document.createElement('td');
    acciones.className = 'fila-acciones';
    for (const [accion, texto] of [['editar', 'Editar'], ['eliminar', 'Eliminar']] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn--mini${accion === 'eliminar' ? ' btn--mini-peligro' : ''}`;
      b.dataset.accion = accion;
      b.dataset.id = m.id;
      b.textContent = texto;
      b.setAttribute('aria-label', `${texto} movimiento: ${m.descripcion || m.categoria}`);
      acciones.append(b);
    }
    tr.append(acciones);
    return tr;
  }
}
