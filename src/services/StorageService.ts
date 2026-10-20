/** Persistencia genérica sobre localStorage, tolerante a errores. */
export class StorageService<T> {
  constructor(private readonly clave: string) {}

  cargar(): T[] {
    try {
      const crudo = localStorage.getItem(this.clave);
      if (!crudo) return [];
      const datos: unknown = JSON.parse(crudo);
      return Array.isArray(datos) ? (datos as T[]) : [];
    } catch {
      return [];
    }
  }

  guardar(datos: T[]): boolean {
    try {
      localStorage.setItem(this.clave, JSON.stringify(datos));
      return true;
    } catch {
      return false; // almacenamiento lleno o bloqueado
    }
  }
}
