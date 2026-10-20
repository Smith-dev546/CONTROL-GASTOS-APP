import { CATEGORIAS_GASTO } from '../models/Movimiento';
import type { EstadoPresupuesto } from '../models/MovimientoModel';
import type { ErroresPresupuesto, Presupuesto, PresupuestoDatos } from '../models/Presupuesto';
import { formatoMoneda, formatoPorcentaje } from '../utils/formato';
import { el } from './ComponentesUI';

const ETIQUETA_NIVEL = { ok: 'En orden', cerca: 'Cerca del límite', excedido: 'Superado' } as const;

export class PresupuestoView {
  private readonly form = el<HTMLFormElement>('form-presupuesto');
  private readonly categoria = el<HTMLSelectElement>('pres-categoria');
  private readonly limite = el<HTMLInputElement>('pres-limite');
  private readonly btnGuardar = el<HTMLButtonElement>('btn-pres-guardar');
  private readonly btnCancelar = el<HTMLButtonElement>('btn-pres-cancelar');
  private readonly titulo = el('pres-titulo');
  private readonly lista = el('pres-lista');
  private readonly vacio = el('pres-vacio');
  private readonly mes = el<HTMLInputElement>('pres-mes');

  constructor() {
    this.categoria.replaceChildren(new Option('Selecciona…', ''), ...CATEGORIAS_GASTO.map((c) => new Option(c, c)));
  }

  alEnviar(cb: (datos: PresupuestoDatos) => void): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      cb({ categoria: this.categoria.value, limite: this.limite.value === '' ? NaN : Number(this.limite.value) });
    });
  }

  alCancelarEdicion(cb: () => void): void { this.btnCancelar.addEventListener('click', cb); }
  alCambiarMes(cb: (mes: string) => void): void { this.mes.addEventListener('change', () => cb(this.mes.value)); }

  alAccionar(cb: (accion: 'editar' | 'eliminar', id: string) => void): void {
    this.lista.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-accion]');
      if (btn?.dataset.id) cb(btn.dataset.accion as 'editar' | 'eliminar', btn.dataset.id);
    });
  }

  fijarMes(mes: string): void { this.mes.value = mes; }

  mostrarErrores(errores: ErroresPresupuesto): void {
    this.form.querySelectorAll<HTMLElement>('[data-error]').forEach((s) => {
      const mensaje = errores[s.dataset.error as keyof ErroresPresupuesto] ?? '';
      s.textContent = mensaje;
      const input = s.previousElementSibling as HTMLElement | null;
      if (mensaje) input?.setAttribute('aria-invalid', 'true');
      else input?.removeAttribute('aria-invalid');
    });
    this.form.querySelector<HTMLElement>('[aria-invalid]')?.focus();
  }

  cargarEnFormulario(p: Presupuesto): void {
    this.mostrarErrores({});
    this.categoria.value = p.categoria;
    this.categoria.disabled = true; // la categoría identifica al presupuesto; solo se edita el límite
    this.limite.value = String(p.limite);
    this.titulo.textContent = `Editar presupuesto: ${p.categoria}`;
    this.btnGuardar.textContent = 'Guardar cambios';
    this.btnCancelar.hidden = false;
    this.limite.focus();
  }

  resetearFormulario(): void {
    this.form.reset();
    this.categoria.disabled = false;
    this.mostrarErrores({});
    this.titulo.textContent = 'Nuevo presupuesto';
    this.btnGuardar.textContent = 'Agregar presupuesto';
    this.btnCancelar.hidden = true;
  }

  renderizarLista(estados: EstadoPresupuesto[]): void {
    this.vacio.hidden = estados.length > 0;
    this.lista.replaceChildren(...estados.map((e) => this.crearTarjeta(e)));
  }

  private crearTarjeta(e: EstadoPresupuesto): HTMLElement {
    const p = e.presupuesto;
    const tarjeta = document.createElement('article');
    tarjeta.className = `pres pres--${e.nivel}`;

    const cab = document.createElement('div');
    cab.className = 'pres__cab';
    const nombre = document.createElement('h3');
    nombre.textContent = p.categoria;
    const estado = document.createElement('span');
    estado.className = `pres__estado pres__estado--${e.nivel}`;
    estado.textContent = ETIQUETA_NIVEL[e.nivel];
    cab.append(nombre, estado);

    const barra = document.createElement('div');
    barra.className = 'barra';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', `Uso del presupuesto de ${p.categoria}`);
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-valuenow', String(Math.min(100, Math.round(e.porcentaje))));
    const relleno = document.createElement('div');
    relleno.className = 'barra__relleno';
    relleno.style.width = `${Math.min(100, e.porcentaje)}%`;
    barra.append(relleno);

    const detalle = document.createElement('p');
    detalle.className = 'pres__detalle';
    detalle.textContent = `${formatoMoneda(e.gastado)} de ${formatoMoneda(p.limite)} (${formatoPorcentaje(e.porcentaje)}) · ${
      e.restante >= 0 ? `quedan ${formatoMoneda(e.restante)}` : `excedido por ${formatoMoneda(-e.restante)}`}`;

    const acciones = document.createElement('div');
    acciones.className = 'pres__acciones';
    for (const [accion, texto] of [['editar', 'Editar'], ['eliminar', 'Eliminar']] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn--mini${accion === 'eliminar' ? ' btn--mini-peligro' : ''}`;
      b.dataset.accion = accion;
      b.dataset.id = p.id;
      b.textContent = texto;
      b.setAttribute('aria-label', `${texto} presupuesto de ${p.categoria}`);
      acciones.append(b);
    }
    tarjeta.append(cab, barra, detalle, acciones);
    return tarjeta;
  }
}
