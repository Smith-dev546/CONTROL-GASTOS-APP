import './styles/styles.css';
import { MovimientoController } from './controllers/MovimientoController';
import { PresupuestoController } from './controllers/PresupuestoController';
import { ResumenController } from './controllers/ResumenController';
import type { MovimientoDTO } from './models/Movimiento';
import { MovimientoModel } from './models/MovimientoModel';
import type { PresupuestoDTO } from './models/Presupuesto';
import { PresupuestoModel } from './models/PresupuestoModel';
import { ReporteService } from './services/ReporteService';
import { StorageService } from './services/StorageService';
import { Confirmacion, Notificador, Pestanas, el } from './views/ComponentesUI';
import { MovimientoView } from './views/MovimientoView';
import { PresupuestoView } from './views/PresupuestoView';
import { ResumenView } from './views/ResumenView';

// Modelos (con su persistencia)
const movimientos = new MovimientoModel(new StorageService<MovimientoDTO>('control-gastos:movimientos'));
const presupuestos = new PresupuestoModel(new StorageService<PresupuestoDTO>('control-gastos:presupuestos'));

// Componentes de interfaz compartidos
const notificador = new Notificador(el('toasts'));
const confirmacion = new Confirmacion();
new Pestanas();

// Controladores (cada uno recibe su vista y los modelos que necesita)
new MovimientoController(movimientos, presupuestos, new MovimientoView(), notificador, confirmacion).iniciar();
new PresupuestoController(presupuestos, movimientos, new PresupuestoView(), notificador, confirmacion).iniciar();
new ResumenController(movimientos, presupuestos, new ResumenView(), notificador, new ReporteService()).iniciar();
