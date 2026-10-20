/** Utilidades de formato y manejo de meses (formato de mes: "YYYY-MM"). */
const moneda = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const fechaCorta = new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
const mesLargo = new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' });

export const formatoMoneda = (n: number): string => moneda.format(n);
export const formatoFecha = (iso: string): string => fechaCorta.format(new Date(`${iso}T00:00:00`));
export const formatoPorcentaje = (n: number): string => `${Math.round(n)}%`;
export const redondear2 = (n: number): number => Math.round(n * 100) / 100;

export const mesDe = (fecha: string): string => fecha.slice(0, 7);
export const esMesValido = (mes: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);

const aMes = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function mesActual(): string {
  return aMes(new Date());
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return aMes(new Date(a, m - 2, 1));
}

export function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return mesLargo.format(new Date(a, m - 1, 1));
}
