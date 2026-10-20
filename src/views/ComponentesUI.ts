/** Utilidad compartida para obtener elementos del DOM con error claro si faltan. */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const nodo = document.getElementById(id);
  if (!nodo) throw new Error(`No se encontró el elemento #${id}`);
  return nodo as T;
}

export type TipoNotificacion = 'exito' | 'error' | 'aviso' | 'info';

/** Notificaciones tipo "toast" con cierre automático (y botón para cerrar antes). */
export class Notificador {
  constructor(private readonly contenedor: HTMLElement) {}

  mostrar(mensaje: string, tipo: TipoNotificacion = 'info', duracionMs = 4000): void {
    // Evita apilar avisos idénticos mientras el primero sigue visible.
    if ([...this.contenedor.children].some((t) => (t as HTMLElement).dataset.mensaje === mensaje)) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.dataset.mensaje = mensaje;
    toast.setAttribute('role', tipo === 'error' || tipo === 'aviso' ? 'alert' : 'status');

    const texto = document.createElement('span');
    texto.textContent = mensaje;

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'toast__cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar notificación');
    cerrar.textContent = '×';

    const quitar = () => {
      toast.classList.add('toast--saliendo');
      setTimeout(() => toast.remove(), 200);
    };
    cerrar.addEventListener('click', quitar);
    toast.append(texto, cerrar);
    this.contenedor.append(toast);
    setTimeout(quitar, duracionMs);
  }
}

/** Diálogo de confirmación basado en <dialog> nativo. */
export class Confirmacion {
  private readonly dialogo = el<HTMLDialogElement>('dlg-confirmar');

  pedir(titulo: string, mensaje: string, textoAccion = 'Eliminar'): Promise<boolean> {
    el('dlg-titulo').textContent = titulo;
    el('dlg-mensaje').textContent = mensaje;
    el('dlg-ok').textContent = textoAccion;
    return new Promise((resolver) => {
      this.dialogo.addEventListener('close', () => resolver(this.dialogo.returnValue === 'ok'), { once: true });
      this.dialogo.showModal();
    });
  }
}

/** Pestañas accesibles (clic y flechas del teclado). */
export class Pestanas {
  private readonly tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

  constructor() {
    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.activar(tab));
      tab.addEventListener('keydown', (e) => {
        const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!salto) return;
        const siguiente = this.tabs[(i + salto + this.tabs.length) % this.tabs.length];
        this.activar(siguiente);
        siguiente.focus();
      });
    });
  }

  private activar(activa: HTMLButtonElement): void {
    for (const tab of this.tabs) {
      const seleccionada = tab === activa;
      tab.setAttribute('aria-selected', String(seleccionada));
      tab.tabIndex = seleccionada ? 0 : -1;
      el(tab.getAttribute('aria-controls')!).hidden = !seleccionada;
    }
  }
}
