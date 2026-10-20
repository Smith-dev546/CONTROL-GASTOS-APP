# Documento técnico — Control de Gastos (Actualización Parcial 2)

| | |
|---|---|
| **Proyecto** | Control de Gastos Simple — actualización del Laboratorio #2 |
| **Tecnologías** | TypeScript 5 (modo `strict`), HTML5, CSS3, Vite 5, jsPDF |
| **Arquitectura** | MVC con patrón Observer |
| **Persistencia** | `localStorage` |

---

## 1. Resumen

El Laboratorio #2 entregaba una aplicación que registraba movimientos, calculaba el balance y los filtraba por tipo y categoría. Esta actualización la extiende con **presupuestos mensuales por categoría, alertas, edición, filtro por fecha, resumen mensual, gráfico, comparación de dos meses y exportación a PDF**, manteniendo la arquitectura MVC y sin introducir frameworks.

Los cambios más importantes a nivel de diseño fueron tres:

1. **Aparece la capa de modelos de colección** (`MovimientoModel`, `PresupuestoModel`). En el laboratorio la lista de movimientos vivía en el controlador; ahora el modelo concentra datos, reglas de negocio, cálculos y persistencia, y el controlador solo coordina.
2. **Se añade una segunda entidad relacionada**, `Presupuesto`, que se vincula con `Movimiento` por la categoría.
3. **Se incorpora el patrón Observer**: los modelos avisan cuando cambian y la interfaz se redibuja sola, lo que permite tener tres vistas sincronizadas sin acoplarlas entre sí.

## 2. Trazabilidad de requerimientos

| Código | Requerimiento | Implementación |
|--------|---------------|----------------|
| RF-01 | Presupuesto mensual por categoría | `Presupuesto`, `PresupuestoModel`, `PresupuestoView`, `PresupuestoController` |
| RF-02 | Editar movimientos | `MovimientoModel.updateMovimiento()`, `MovimientoController.handleEdit()` / `handleUpdate()` |
| RF-03 | Eliminar con confirmación | `MovimientoModel.deleteMovimiento()`, `MovimientoController.handleDelete()`, `Confirmacion.pedir()` |
| RF-04 | Filtrar por tipo, categoría y fecha | `MovimientoModel.filtrar()`, `MovimientoController.handleFilter()` |
| RF-05 | Guardar en `localStorage` | `StorageService<T>` usado por ambos modelos |
| RF-06 | Alerta al superar presupuesto | `MovimientoModel.checkPresupuesto()`, `MovimientoView.renderAlertaPresupuesto()`, aviso en `MovimientoController.avisarPresupuesto()` |
| RF-07 | Resumen mensual | `MovimientoModel.getResumenMensual()`, `ResumenView.renderResumen()` |
| RF-08 | Gráfico de gastos por categoría | `MovimientoModel.getGastosPorCategoria()`, `ResumenView.renderGrafico()` |
| RF-09 | Comparar dos meses | `MovimientoModel.compararMeses()`, `ResumenView.renderComparacion()` |
| Reto | Exportar reporte mensual a PDF | `ReporteService.exportarPDF()` |

### Cambios en las clases (según el enunciado)

| Clase | Pedido | Estado |
|-------|--------|--------|
| `Movimiento` | añade `categoria`, `fecha` | ✅ Más `descripcion` opcional (necesaria para la búsqueda por texto) |
| `Presupuesto` | nueva clase | ✅ `id`, `categoria`, `limite` |
| `MovimientoModel` | `updateMovimiento()`, `deleteMovimiento()`, `getBalance()`, `getGastosPorCategoria()`, `checkPresupuesto()` | ✅ Los cinco, más `addMovimiento()`, `filtrar()`, `getResumenMensual()`, `compararMeses()`, `validar()` |
| `MovimientoView` | `renderBalance()`, `renderAlertaPresupuesto()`, `renderGrafico()` | ✅ `renderBalance()` y `renderAlertaPresupuesto()`. ⚠️ **`renderGrafico()` está en `ResumenView`** (ver decisión D-3) |
| `MovimientoController` | `handleUpdate()`, `handleDelete()`, `handleFilter()` | ✅ Los tres, más `handleCreate()` y `handleEdit()` |

### Comparativa con la evaluación (Laboratorio #2 vs Parcial 2)

| Aspecto | Requerido en Parcial 2 | Cómo se cumple |
|---------|------------------------|----------------|
| Entidades | 1–2 relacionadas | `Movimiento` y `Presupuesto`, relacionadas por categoría |
| CRUD | Completo | Movimientos y presupuestos: crear, listar, editar, eliminar |
| Búsqueda | Por criterio | Texto sobre descripción y categoría |
| Filtros | Por estado/categoría | Tipo, categoría y rango de fechas, combinables |
| Validaciones | Avanzadas (formato, duplicados, rangos) | Ver sección 6 |
| Persistencia | `localStorage` | Dos claves independientes, con manejo de errores |
| Interfaz | Múltiples vistas o pestañas | Tres pestañas accesibles: Movimientos, Presupuestos, Resumen mensual |
| Mensajes | Notificaciones con auto-cierre | `Notificador`: cierre automático a los 4–7 s y botón de cierre manual |
| Estadísticas | Resumen/contadores | Balance global, contador filtrado, tarjetas del mes, gráfico |

## 3. Arquitectura

### 3.1 Capas y responsabilidades

```
                   ┌────────────────────────── main.ts ──────────────────────────┐
                   │   crea los modelos, las vistas y los controladores y los     │
                   │   conecta (inyección de dependencias manual)                 │
                   └──────────────────────────────────────────────────────────────┘

   VISTA                          CONTROLADOR                         MODELO
 ┌───────────────────┐        ┌──────────────────────┐        ┌───────────────────────┐
 │ MovimientoView    │◄───────│ MovimientoController │───────►│ MovimientoModel       │
 │ PresupuestoView   │◄───────│ PresupuestoController│───────►│ PresupuestoModel      │──► StorageService
 │ ResumenView       │◄───────│ ResumenController    │───────►│ (+ Movimiento,        │       (localStorage)
 │ ComponentesUI     │        └──────────┬───────────┘        │    Presupuesto)       │
 └───────────────────┘                   │                    └──────────┬────────────┘
        ▲  callbacks (alEnviar,          ▼                               │ notificar()
        │  alAccionarFila, …)     ReporteService (PDF)                   ▼
        └────────────────────────── los controladores se suscriben ◄── Observable
```

| Capa | Responsabilidad | Lo que **no** hace |
|------|-----------------|--------------------|
| **Modelo** | Datos, validaciones, reglas de negocio, cálculos, persistencia | No conoce el DOM ni a la vista |
| **Vista** | Leer formularios, dibujar, mostrar errores | No valida ni calcula; no conoce al modelo |
| **Controlador** | Recibir eventos de la vista, invocar al modelo, ordenar el redibujado | No toca el DOM directamente |
| **Servicios** | `StorageService` (almacenamiento), `ReporteService` (PDF) | No contienen reglas de negocio |

### 3.2 Flujo de ejemplo: registrar un gasto que supera un presupuesto

1. El usuario envía el formulario → `MovimientoView` lee los campos y llama al callback registrado con `alEnviar()`.
2. `MovimientoController.handleCreate()` llama a `MovimientoModel.addMovimiento(datos)`.
3. El modelo valida (`validar()`); si hay errores devuelve `{ ok: false, errores }` y la vista los marca en cada campo.
4. Si es válido, crea el `Movimiento`, **guarda primero** en `localStorage` y solo entonces actualiza su estado y ejecuta `notificar()`.
5. Los suscriptores se redibujan: lista, balance, banner de alertas, tarjetas de presupuesto, resumen y gráfico.
6. El controlador consulta `checkPresupuesto()` para el mes del gasto y, si el nivel es `cerca` o `excedido`, muestra una notificación.

## 4. Modelo de datos

```ts
interface MovimientoDTO { id: string; tipo: 'ingreso' | 'gasto'; monto: number;
                          categoria: string; descripcion: string; fecha: string /* YYYY-MM-DD */ }
interface PresupuestoDTO { id: string; categoria: string; limite: number /* USD por mes */ }
```

- **Relación:** un `Presupuesto` se asocia con los `Movimiento` de tipo gasto que tengan su misma `categoria`. Existe como máximo un presupuesto por categoría.
- **Almacenamiento:** `control-gastos:movimientos` y `control-gastos:presupuestos`, ambos arreglos JSON.
- **Estado derivado:** el progreso de un presupuesto (`EstadoPresupuesto`: gastado, restante, porcentaje y nivel) **no se guarda**; se calcula cada vez a partir de los movimientos, lo que evita inconsistencias.
- **Niveles:** `ok` (< 80 % del límite), `cerca` (≥ 80 % y ≤ 100 %), `excedido` (> 100 %).

## 5. Decisiones técnicas

**D-1. Modelo de colección separado del controlador.**
*Problema:* en el laboratorio el controlador guardaba el arreglo y las reglas, lo que dificultaba reutilizarlas desde tres controladores distintos.
*Decisión:* `MovimientoModel` y `PresupuestoModel` encapsulan datos, reglas y persistencia.
*Consecuencia:* los cálculos (`getBalance`, `getGastosPorCategoria`, `checkPresupuesto`) tienen un único lugar y los controladores quedan delgados.

**D-2. Patrón Observer en lugar de que cada controlador llame a los demás.**
*Problema:* al guardar un movimiento deben actualizarse la lista, el balance, los presupuestos, el resumen y el gráfico. Que `MovimientoController` conociera a los otros dos controladores los acoplaría.
*Decisión:* `Observable` (≈ 10 líneas) con `suscribir()` y `notificar()`. Cada controlador se suscribe a los modelos que le interesan.
*Alternativas descartadas:* un bus de eventos global (más indirección sin necesidad) y un framework reactivo (fuera del alcance del curso).

**D-3. Tres vistas y ubicación de `renderGrafico()`.**
El enunciado lista `renderGrafico()` bajo `MovimientoView`. Al pasar a múltiples pestañas, el gráfico quedó en la pestaña *Resumen mensual*, que tiene su propia vista (`ResumenView`) y sus propios controles de mes. Se mantuvo el nombre del método y se colocó en la vista que dibuja esa pestaña, para que `MovimientoView` no manipulara elementos de otra sección. Es la única desviación respecto de la lista de métodos del enunciado.

**D-4. Dos niveles de validación.**
- *Entidad* (`Movimiento.validar()`, `Presupuesto.validar()`): reglas que dependen solo del propio dato (formato, rangos). Se ejecutan también en el constructor, de modo que **no puede existir una instancia inválida**.
- *Colección* (`MovimientoModel.validar()`, `PresupuestoModel.validar()`): reglas que requieren conocer los demás registros (duplicados) o relacionar campos (categoría coherente con el tipo).
Se separó así para no descartar datos antiguos al cargar: `desdeDTO()` solo aplica las reglas de la entidad, por lo que un registro del laboratorio anterior no se pierde por incumplir las reglas nuevas de colección (duplicados, coherencia tipo/categoría). Además, si lo único inválido es la descripción (las reglas de formato son más estrictas que en el laboratorio), el movimiento se conserva sin descripción en lugar de descartarse, porque el dato valioso es el monto.

**D-5. Un presupuesto por categoría, aplicable a todos los meses.**
RF-01 pide un presupuesto "mensual por categoría". Se interpretó como un límite mensual recurrente (ej. «Alimentación: $150 al mes») y no como un valor distinto para cada mes. Simplifica el uso y es lo habitual en finanzas personales. La pestaña *Presupuestos* y el resumen permiten revisar cualquier mes contra ese mismo límite.

**D-6. Alertas en dos momentos.**
- *Inmediata:* al guardar o editar un gasto se consulta el estado del mes **de ese gasto** (puede ser un mes pasado) y se muestra una notificación si queda cerca o por encima del límite.
- *Permanente:* un banner siempre visible muestra el estado del **mes actual**.
Así el usuario recibe retroalimentación en el momento de la acción y, además, no depende de haberla visto para enterarse.

**D-7. Guardar antes de modificar el estado.**
`aplicar()` escribe en `localStorage` y solo si tiene éxito reemplaza el arreglo en memoria. Si el almacenamiento está lleno o bloqueado se lanza un error que el controlador muestra al usuario; lo que se ve en pantalla nunca difiere de lo guardado.

**D-8. Gráfico en HTML/CSS y no con una librería.**
Para un gráfico de barras horizontales no se justifica una dependencia. Las barras son elementos `<li>` con ancho proporcional, lo que mantiene el bundle pequeño, hereda los estilos de la aplicación y es legible para lectores de pantalla (cada fila incluye categoría, monto y porcentaje como texto).

**D-9. jsPDF cargado bajo demanda.**
La librería pesa ~390 kB. Se importa con `import('jspdf')` solo al pulsar *Exportar*, por lo que el código inicial de la aplicación es de ~33 kB (≈ 10 kB comprimido). Alternativa descartada: `window.print()`, que depende del diálogo del navegador y da menos control sobre el contenido del reporte.

**D-10. Seguridad: nada de `innerHTML` con datos del usuario.**
Todo texto que escribe el usuario (descripciones) se inserta con `textContent`, lo que impide inyección de HTML/JS (XSS) aun si el `localStorage` fuese manipulado.

**D-11. Precisión monetaria.**
Los montos se validan a máximo 2 decimales y todas las sumas se redondean a centavos (`redondear2`) para evitar artefactos de coma flotante como `0.1 + 0.2 = 0.30000000000000004`.

**D-12. Delegación de eventos.**
La tabla y las tarjetas registran un solo listener en el contenedor y reconocen el botón por `data-accion` y `data-id`, en lugar de un listener por botón. Funciona con filas creadas dinámicamente y no se fugan oyentes al redibujar.

## 6. Validaciones

| Campo | Regla | Tipo | Dónde |
|-------|-------|------|-------|
| Tipo | Solo `ingreso` o `gasto` | Valor permitido | `Movimiento.validar` |
| Monto | Obligatorio, > 0 | Rango | `Movimiento.validar` |
| Monto | ≤ $1,000,000,000 | Rango | `Movimiento.validar` |
| Monto | Máximo 2 decimales | Formato | `Movimiento.validar` |
| Categoría | Debe existir en el catálogo | Valor permitido | `Movimiento.validar` |
| Categoría | Debe corresponder al tipo (ej. «Salario» no puede ser un gasto) | Coherencia entre campos | `MovimientoModel.validar` |
| Descripción | Vacía, o entre 3 y 80 caracteres | Rango | `Movimiento.validar` |
| Descripción | Solo letras, números y `. , # & ( ) - / '` | Formato | `Movimiento.validar` |
| Fecha | Formato `YYYY-MM-DD` válido | Formato | `Movimiento.validar` |
| Fecha | No futura ni anterior al año 2000 | Rango | `Movimiento.validar` |
| Movimiento | No duplicado (mismo tipo, monto, categoría, fecha y descripción) | Duplicado | `MovimientoModel.validar` |
| Presupuesto: categoría | Solo categorías de gasto | Valor permitido | `Presupuesto.validar` |
| Presupuesto: categoría | Una sola vez | Duplicado | `PresupuestoModel.validar` |
| Presupuesto: límite | > 0, ≤ $1,000,000,000, máximo 2 decimales | Rango/formato | `Presupuesto.validar` |
| Filtro de fechas | «Desde» no puede ser posterior a «Hasta» | Rango | `MovimientoController.handleFilter` |

La edición excluye al propio registro de la comprobación de duplicados (`ignorarId`), de modo que guardar sin cambios no se rechaza.
Los errores aparecen junto a cada campo, con `aria-invalid` y foco en el primer campo erróneo.

## 7. Interfaz y accesibilidad

- **Pestañas** con roles ARIA (`tablist`, `tab`, `tabpanel`) y navegación con las flechas del teclado.
- **Notificaciones** en una región `aria-live`; los errores y avisos usan `role="alert"`. Se cierran solas (4 s; 7 s las alertas de presupuesto) o con el botón ×. No se apilan mensajes idénticos.
- **Confirmación** con el elemento nativo `<dialog>`: gestiona el foco y se cierra con Esc.
- **Formularios** con `<label>` en todos los campos, foco visible y mensajes de error asociados.
- **Barras de progreso** con `role="progressbar"` y valores ARIA; el estado no depende solo del color (cada tarjeta lleva una etiqueta de texto: *En orden*, *Cerca del límite*, *Superado*).
- **Responsive:** rejilla que pasa a una columna bajo 880 px; las tablas anchas se desplazan dentro de su contenedor sin ensanchar la página.
- **Movimiento reducido:** la animación de las notificaciones se desactiva con `prefers-reduced-motion`.

## 8. Reporte PDF (reto adicional)

`ReporteService.exportarPDF()` genera `reporte-YYYY-MM.pdf` con: encabezado y mes, ingresos/gastos/balance, gráfico de barras por categoría, estado de cada presupuesto (con su porcentaje) y detalle cronológico de movimientos del mes. Soporta varias páginas, repite los encabezados de la tabla al saltar de página y numera las páginas. Mientras se genera, el botón se deshabilita y si falla se informa con una notificación.

## 9. Verificación realizada

- **Compilación:** `npm run build` ejecuta `tsc --noEmit` en modo `strict` (con `noUnusedLocals`, `noUnusedParameters` y `noImplicitReturns`) y el empaquetado, sin errores.
- **Prueba end-to-end** (`scripts/e2e_capturas.py`, Chromium real con datos de ejemplo): comprobó el alta, la edición y la eliminación (incluyendo cancelar la confirmación), cada validación de la sección 6, la coherencia tipo/categoría, el rechazo de duplicados, la alerta de presupuesto al guardar, filtros combinados y por rango de fechas, el botón *Limpiar filtros*, el cierre automático de notificaciones, los presupuestos (alta, duplicado rechazado, edición), el resumen, el gráfico, la comparación de meses, la descarga del PDF, la persistencia tras recargar y la ausencia de desbordamiento horizontal en un ancho de 390 px.
- **Defectos encontrados y corregidos durante la verificación:** (1) en móvil, el texto oculto de la columna «Acciones» ensanchaba la página; (2) el selector de categoría de los filtros quedaba recortado; (3) las notificaciones idénticas se apilaban.
- **Revisión visual:** capturas y PDF generado revisados manualmente.

## 10. Limitaciones y mejoras futuras

| Limitación | Posible mejora |
|------------|----------------|
| No hay pruebas unitarias automatizadas; la verificación es end-to-end | Añadir Vitest para `Movimiento`, `MovimientoModel` y `PresupuestoModel`, que son puras y fáciles de probar |
| El presupuesto es un límite recurrente, sin historial por mes | Guardar presupuestos con vigencia (`desde`/`hasta`) |
| `crypto.randomUUID()` solo está disponible en contextos seguros (HTTPS o `localhost`) | Usar un generador de identificadores de respaldo si se sirve por HTTP en red local |
| `localStorage` está limitado a ~5 MB y es local a un navegador | Exportar/importar datos en JSON o migrar a IndexedDB / un backend |
| El PDF usa la fuente estándar (sin caracteres fuera de Latin-1) | Incrustar una fuente TrueType si se requirieran otros alfabetos |
| Solo hay un catálogo fijo de categorías | Permitir categorías personalizadas |

## 11. Autoevaluación frente a la rúbrica

| Criterio | Evidencia |
|----------|-----------|
| **1. CRUD completo** | Crear, listar, editar y eliminar (con confirmación) en movimientos y en presupuestos; secciones 2 y 9 |
| **2. Persistencia** | `StorageService<T>` con dos claves, tolerancia a datos corruptos y a fallos de escritura; D-7 |
| **3. Búsqueda y filtros** | Texto + tipo + categoría + rango de fechas, todos combinables; `MovimientoModel.filtrar()` |
| **4. Validaciones y UI** | 15 reglas de validación (sección 6), notificaciones con auto-cierre, tres vistas, accesibilidad (sección 7) |
| **5. Documentación y defensa** | README con capturas, este documento y la guía de la sección 12 |

## 12. Guía para la defensa

Preguntas probables y dónde está la respuesta en el código:

- **¿Por qué el modelo no sabe nada del DOM?** Para poder reutilizarlo y probarlo de forma aislada; la única forma de salir del modelo es `notificar()`.
- **¿Cómo se entera la pantalla de que algo cambió?** Observer: `Observable.suscribir()` / `notificar()`; cada controlador se suscribe en `iniciar()`.
- **¿Cómo se calcula que un presupuesto se superó?** `MovimientoModel.checkPresupuesto()` suma los gastos de la categoría en el mes y compara con el límite (nivel `ok`, `cerca` o `excedido`).
- **¿Qué pasa si falla `localStorage`?** `StorageService.guardar()` devuelve `false`; `aplicar()` lanza un error antes de tocar la memoria y el controlador lo muestra.
- **¿Cómo evitan duplicados al editar?** `validar(datos, ignorarId)` excluye el propio registro de la comparación.
- **¿Por qué `textContent` y no `innerHTML`?** Evita XSS con texto escrito por el usuario.
- **¿Por qué dos niveles de validación?** Sección 5, D-4.
- **¿Qué tipos propios de TypeScript usaron?** Uniones (`TipoMovimiento`, `NivelPresupuesto`), uniones discriminadas (`Resultado`), `Omit`, `Partial<Record<…>>`, genéricos (`StorageService<T>`), `readonly` y modificadores de acceso.
