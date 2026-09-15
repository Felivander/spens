# Especificación de Diseño: Spens Desktop Dashboard

**Fecha:** 2026-09-15  
**Estado:** Validado  
**Enfoque:** Arquitectura adaptativa (Mobile Simple / Desktop Potente)

---

## 1. Visión y Objetivos

- **Experiencia Móvil (< 1024px):** Mantiene el 100% de su simpleza original. Rápida, conversacional, lista limpia de movimientos y registro ágil con lenguaje natural sin elementos que saturen la pantalla pequeña.
- **Experiencia de Escritorio (>= 1024px):** Se expande automáticamente en una pantalla de dos paneles:
  - **Panel Izquierdo (~380px fijo):** Flujo conversacional y diario (Balance general, navegación rápida de períodos, feed de movimientos y barra de chat fija en la base).
  - **Panel Derecho (Flexible):** Centro de analítica y control financiero con métricas clave, calendario mensual interactivo y una plantilla detallada de movimientos estilo hoja de cálculo con edición en línea.

---

## 2. Arquitectura de Componentes

### 2.1 Disposición de Pantalla (`App.tsx` & `app.css`)
- Contenedor principal con detección de ancho mediante media query `(min-width: 1024px)` o hook de viewport.
- **Modo Móvil (`< 1024px`):** Renderiza la columna única existente (`.app`), centrada, con `max-width: 34rem`.
- **Modo Escritorio (`>= 1024px`):**
  - Contenedor raíz `.desktop-root` con altura `100dvh` y disposición en flexbox/grid de 2 columnas:
    1. `.desktop-sidebar`: Ancho fijo de 380px, borde derecho sutil (`1px solid var(--rule-strong)`), fondo `var(--paper)`. Alberga los componentes actuales: `Header`, `BalanceCard`, `RangeNav`, `MovementList` y `ChatBar`.
    2. `.desktop-main`: Ancho flexible, scroll vertical independiente, fondo `var(--paper-raised)` o `var(--paper)`, conteniendo el nuevo componente `DesktopDashboard`.

### 2.2 Componente `DesktopDashboard`
Ubicado en el panel derecho, estructurado en tres secciones verticales:

```
+-----------------------------------------------------------------------------------+
|  Header del Dashboard: Mes activo (ej: Agosto 2026) | Acciones rápidas (Exportar)  |
+-----------------------------------------------------------------------------------+
|  Fila de Métricas (4 tarjetas):                                                   |
|  [ Total Gastos ]   [ Total Ingresos ]   [ Balance Neto ]   [ Categoría Top ]     |
+-----------------------------------------+-----------------------------------------+
|  Calendario Mensual Interactivo         |  Plantilla Detallada de Movimientos     |
|  (Grilla Lun-Dom con badges de $ por    |  (Tabla con buscador, filtros, edición  |
|   día; clic para filtrar la tabla)      |   en línea de descripción, categoría y  |
|                                         |   monto, y borrado rápido)              |
+-----------------------------------------+-----------------------------------------+
```

---

## 3. Detalle de Componentes

### 3.1 Tarjetas de Métricas (`MetricCard`)
Cálculo en tiempo real sobre los movimientos del mes activo (`anchor`):
- **Total Gastos:** Suma de montos donde `kind === 'gasto'`. Formateado con `$`.
- **Total Ingresos:** Suma de montos donde `kind === 'ingreso'`. Formateado con `+$` en color de acento/ingreso.
- **Balance Neto:** `Total Ingresos - Total Gastos`. Color según signo.
- **Categoría Principal:** Categoría con mayor gasto acumulado en el mes, indicando nombre, ícono y monto acumulado.

### 3.2 Calendario Mensual Interactivo (`MonthCalendar`)
- Grilla de 7 columnas (Lunes a Domingo).
- Días del mes actual con su número de día.
- Días de meses anterior/posterior en tono atenuado para completar la grilla.
- Para cada día:
  - Si existen movimientos: píldora/badge con el monto neto del día (ej: `−$14.200` o `+$120.000`).
  - Indicador visual si es el día de hoy (`todayISO()`).
- **Estado de Selección (`selectedDay`):**
  - Al hacer clic en un día del calendario, se guarda `selectedDay: string | null` (formato `yyyy-mm-dd`).
  - La celda se resalta con borde de acento.
  - La plantilla de movimientos contigua filtra inmediatamente los movimientos de ese día.
  - Al hacer clic nuevamente en el día seleccionado, o en un botón "Quitar filtro", `selectedDay` vuelve a `null` y se muestran todos los movimientos del mes.

### 3.3 Plantilla Detallada de Movimientos (`SpreadsheetTable`)
Tabla completa estilo hoja de cálculo diseñada para escritorio:
- **Barra de Herramientas:**
  - Buscador de texto en tiempo real (filtra por descripción).
  - Filtro por categoría (selector rápido).
  - Chip de filtro de fecha activa cuando se selecciona un día en el calendario con botón `×` para limpiar.
  - Contador de registros visibles (ej: `"Mostrando 18 movimientos"`).
- **Columnas:**
  1. **Fecha:** Día de la semana, día del mes y hora (`Lun 05 · 14:30`).
  2. **Tipo:** Badge clickable `Gasto` / `Ingreso` para alternar el tipo en caso de corrección.
  3. **Descripción:** Celda con texto editable directamente en línea (`contentEditable` o input al hacer foco/doble clic).
  4. **Categoría:** Chip con categoría actual; al hacer clic despliega el selector rápido de categorías para reasignarla con un toque.
  5. **Monto:** Valor con formato monetario. Al hacer clic permite editar el valor numérico.
  6. **Acciones:** Botón de eliminar con confirmación rápida o botón discreto.

---

## 4. Flujo de Datos y Sincronización

- **Única Fuente de Verdad:** Todo el estado de movimientos reside en `App.tsx` (`movements`, `anchor`, `settings`, `user`).
- **Sincronización Bidireccional:**
  - Agregar un gasto mediante el chat izquierdo (`hamburguesa 9000`) crea el movimiento y actualiza instantáneamente el balance, el calendario mensual y la plantilla de escritorio.
  - Modificar una fila (categoría, monto o descripción) en la plantilla actualiza el estado en `App.tsx`, disparando la sincronización en la nube (Supabase) si el usuario tiene sesión iniciada.
  - Borrar un movimiento desde la plantilla o desde la lista izquierda actualiza todas las vistas de inmediato.

---

## 5. Diseño Visual y Estética Spens

- Respeto total a la identidad visual de Spens: tipografía limpia basada en Helvetica/sans-serif, paleta OKLCH cálida neutra, bordes estructurales de 1px (`var(--rule)` / `var(--rule-strong)`), acentos en naranja (`var(--accent)` / `var(--accent-text)`) y ausencia de sombras artificiales.
- El panel de escritorio aprovecha el espacio horizontal sin verse saturado, organizando la información en bloques modulares con esquinas redondeadas (`--r-card: 20px`) y encabezados claros.

---

## 6. Plan de Verificación

1. **Responsive / Breakpoints:**
   - Probar en viewport `< 1024px`: verificar que la interfaz móvil permanezca idéntica, limpia y funcional sin cambios no deseados.
   - Probar en viewport `>= 1024px`: verificar que se despliegue el panel doble (sidebar + dashboard).
2. **Interactividad del Calendario:**
   - Seleccionar diferentes meses y verificar que el calendario refleje los días correctos.
   - Tocar días con movimientos y verificar el filtrado inmediato de la plantilla.
   - Limpiar el filtro y verificar la restauración del mes completo.
3. **Edición en Línea de la Plantilla:**
   - Editar descripción, monto y categoría de un movimiento en la tabla.
   - Verificar que el cambio se refleje en el saldo de la barra lateral izquierda y en el almacenamiento local / Supabase.
4. **Ingreso Conversacional:**
   - Ingresar un gasto por el chat lateral y confirmar que aparezca en el día correspondiente del calendario y en la plantilla derecha al instante.
