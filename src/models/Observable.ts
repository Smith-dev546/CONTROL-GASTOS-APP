/** Patrón Observer mínimo: los modelos avisan cuando cambian y las vistas/controladores se redibujan. */
export class Observable {
  private readonly oyentes = new Set<() => void>();

  suscribir(oyente: () => void): () => void {
    this.oyentes.add(oyente);
    return () => { this.oyentes.delete(oyente); };
  }

  protected notificar(): void {
    this.oyentes.forEach((oyente) => oyente());
  }
}
