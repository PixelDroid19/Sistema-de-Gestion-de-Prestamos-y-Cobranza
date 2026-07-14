# Compact Report Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir los informes en una herramienta compacta donde los filtros se revelan bajo demanda, los filtros activos permanecen identificables y navegación, exportación, resumen y resultados tienen una jerarquía única.

**Architecture:** Reutilizar `ReportCollapsibleFilters` como única divulgación accesible de filtros y hacer que `ReportTabPanel` componga cabecera, activadores y etiquetas de filtros activos. Mantener el estado de cada consulta en su pestaña actual; los componentes compartidos solo reciben descriptores y callbacks, sin duplicar el estado financiero ni modificar contratos del backend.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, CSS y tokens existentes, lucide-react.

## Global Constraints

- Ningún informe con filtros los muestra permanentemente al cargar.
- Los valores activos se conservan al cerrar el panel y las exportaciones siguen usando esos valores.
- No se cambian endpoints, cálculos financieros, formatos Excel/PDF, permisos ni contratos de datos.
- Se reutilizan `ActionButton`, `AppInput`, `OperationalSelect`, `FormField` y los tokens actuales.
- La interacción debe ser accesible con teclado, `aria-expanded` y `aria-controls`.
- La vista objetivo es PC; se preserva una adaptación funcional para anchos menores.
- No se agregan dependencias ni una segunda implementación de filtros.

---

### Task 1: Divulgación accesible de filtros

**Files:**
- Modify: `frontend/src/components/reports/ReportCollapsibleFilters.tsx`
- Modify: `frontend/src/components/reports/__tests__/ReportCollapsibleFilters.test.tsx`
- Modify: `frontend/src/i18n/dictionaries/terms-es/reports.ts`
- Modify: `frontend/src/i18n/dictionaries/terms-en/reports.ts`

**Interfaces:**
- Consumes: `children: ReactNode`, `activeCount?: number`, `defaultOpen?: boolean`, `filterColumns?: 2 | 3 | 4 | 5`.
- Produces: un botón nativo rotulado `Filtros` o `Filtros (N)` que controla un panel en flujo y permanece cerrado hasta que el usuario lo abra.

- [ ] **Step 1: Cambiar las pruebas para expresar el comportamiento requerido**

```tsx
it('starts closed and reveals filters with an accessible toggle', () => {
  render(<ReportCollapsibleFilters><label htmlFor="client">Cliente<input id="client" /></label></ReportCollapsibleFilters>);
  const toggle = screen.getByRole('button', { name: 'Filtros' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByLabelText('Cliente')).toBeVisible();
});

it('keeps active filters collapsed and announces their count', () => {
  render(<ReportCollapsibleFilters activeCount={2}><label htmlFor="credit">Crédito<input id="credit" /></label></ReportCollapsibleFilters>);
  expect(screen.getByRole('button', { name: 'Filtros (2)' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByLabelText('Crédito')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla por el auto-open actual**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportCollapsibleFilters.test.tsx`

Expected: FAIL porque `activeCount > 0` abre el panel y el texto es `Ocultar filtros`.

- [ ] **Step 3: Implementar la divulgación controlada por el usuario**

```tsx
type FilterColumns = 2 | 3 | 4 | 5;

const [open, setOpen] = useState(defaultOpen);
const toggleLabel = activeCount > 0
  ? tTerm('reports.filters.labelWithCount', { count: activeCount })
  : tTerm('reports.filters.label');

<ActionButton
  type="button"
  variant="secondary"
  className="report-collapsible-filters__toggle"
  onClick={() => setOpen((value) => !value)}
  aria-expanded={open}
  aria-controls={panelId}
>
  {toggleLabel}
</ActionButton>
```

Eliminar el efecto que abre el panel al detectar filtros activos. Mantener el panel montado solo cuando `open` es verdadero y mantener `aria-controls` apuntando a su `id`.

- [ ] **Step 4: Ejecutar la prueba enfocada**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportCollapsibleFilters.test.tsx`

Expected: PASS, 2 tests.

---

### Task 2: Composición compacta y filtros activos

**Files:**
- Modify: `frontend/src/components/reports/ReportTabPanel.tsx`
- Modify: `frontend/src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`
- Modify: `frontend/src/i18n/dictionaries/terms-es/reports.ts`
- Modify: `frontend/src/i18n/dictionaries/terms-en/reports.ts`

**Interfaces:**
- Consumes: `filters`, `filterColumns`, `activeFilterCount` existentes y el nuevo `activeFilters?: ReportActiveFilter[]`.
- Produces: `export type ReportActiveFilter = { id: string; label: string; value: string; onRemove: () => void }` y una cabecera que envuelve filtros con `ReportCollapsibleFilters`.

- [ ] **Step 1: Escribir pruebas fallidas para ocultamiento y limpieza**

```tsx
const onRemove = vi.fn();
render(
  <ReportTabPanel
    title="Pago de cuotas"
    filters={<label htmlFor="payment-state">Estado<input id="payment-state" /></label>}
    activeFilterCount={1}
    activeFilters={[{ id: 'status', label: 'Estado', value: 'Completado', onRemove }]}
  />,
);

expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Filtros (1)' })).toHaveAttribute('aria-expanded', 'false');
expect(screen.getByText('Estado: Completado')).toBeVisible();
fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Estado' }));
expect(onRemove).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Ejecutar y confirmar la falla**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`

Expected: FAIL porque los filtros actuales están siempre visibles y `activeFilters` no existe.

- [ ] **Step 3: Añadir el límite compartido**

```tsx
export type ReportActiveFilter = {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
};

{hasFilters ? (
  <div className="report-tab-panel__filter-tools">
    <ReportCollapsibleFilters activeCount={activeFilterCount} filterColumns={filterColumns}>
      {filters}
      {secondaryFilters}
    </ReportCollapsibleFilters>
    {activeFilters?.length ? (
      <ul className="report-active-filters" aria-label={tTerm('reports.filters.active')}>
        {activeFilters.map((filter) => (
          <li key={filter.id}>
            <span>{filter.label}: {filter.value}</span>
            <button type="button" onClick={filter.onRemove} aria-label={tTerm('reports.filters.remove', { filter: filter.label })}>
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
) : null}
```

Agregar textos `reports.filters.active` y `reports.filters.remove` en español e inglés. No añadir un estado interno para los valores.

- [ ] **Step 4: Ejecutar pruebas compartidas**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx src/components/reports/__tests__/ReportCollapsibleFilters.test.tsx`

Expected: PASS, 4 tests.

---

### Task 3: Conectar descriptores reales en cada informe

**Files:**
- Modify: `frontend/src/components/reports/CashflowTab.tsx`
- Modify: `frontend/src/components/reports/CreditHistoryMonthlyTab.tsx`
- Modify: `frontend/src/components/reports/PayoutsTab.tsx`
- Modify: `frontend/src/components/reports/AssociateMovementsTab.tsx`
- Modify: `frontend/src/components/reports/OperatingExpensesTab.tsx`
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`

**Interfaces:**
- Consumes: `ReportActiveFilter[]` de `ReportTabPanel` y los setters actuales de cada pestaña.
- Produces: etiquetas derivadas del estado real, con callbacks que limpian un único campo y reinician paginación cuando corresponda.

- [ ] **Step 1: Actualizar la prueba integral para exigir filtros cerrados**

```tsx
openReportView('Movimientos de socios');
expect(screen.queryByLabelText('Buscar socio')).not.toBeInTheDocument();
const toggle = screen.getByRole('button', { name: 'Filtros' });
fireEvent.click(toggle);
expect(screen.getByLabelText('Buscar socio')).toBeVisible();
fireEvent.change(screen.getByLabelText('Buscar socio'), { target: { value: 'Socio Reporte' } });
fireEvent.click(toggle);
expect(screen.getByText('Buscar socio: Socio Reporte')).toBeVisible();
expect(screen.queryByLabelText('Buscar socio')).not.toBeInTheDocument();
```

Actualizar los casos que hoy exigen controles siempre visibles para que abran el panel antes de interactuar.

- [ ] **Step 2: Ejecutar la prueba y confirmar la falla**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx`

Expected: FAIL porque `ReportTabPanel` aún no recibe descriptores desde las pestañas.

- [ ] **Step 3: Derivar descriptores sin duplicar estado**

Ejemplo para socios:

```tsx
const activeFilters: ReportActiveFilter[] = [
  filters.search.trim() ? { id: 'search', label: tTerm('reports.associates.filter.search'), value: filters.search.trim(), onRemove: () => setFilters((current) => ({ ...current, search: '' })) } : null,
  filters.status !== 'all' ? { id: 'status', label: tTerm('reports.associates.filter.status'), value: filters.status === 'active' ? tTerm('common.status.active') : tTerm('common.status.inactive'), onRemove: () => setFilters((current) => ({ ...current, status: 'all' })) } : null,
  filters.fromDate ? { id: 'fromDate', label: tTerm('reports.associates.filter.from'), value: filters.fromDate, onRemove: () => setFilters((current) => ({ ...current, fromDate: '' })) } : null,
  filters.toDate ? { id: 'toDate', label: tTerm('reports.associates.filter.to'), value: filters.toDate, onRemove: () => setFilters((current) => ({ ...current, toDate: '' })) } : null,
].filter((filter): filter is ReportActiveFilter => filter !== null);
```

Pasar `activeFilters={activeFilters}` a cada `ReportTabPanel`. Para pagos y gastos, usar los setters existentes y reiniciar la página a 1. Para cierre, tratar el año como contexto base y crear etiquetas removibles únicamente para `fromDate` y `toDate`. Para créditos, limpiar también el texto de búsqueda de cliente al retirar `customerId`.

- [ ] **Step 4: Ejecutar la prueba integral**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx`

Expected: PASS sin cambios en expectativas de tablas, métricas o exportaciones.

---

### Task 4: Cohesionar navegación, cabecera y resumen

**Files:**
- Modify: `frontend/src/components/Reports.tsx`
- Modify: `frontend/src/components/reports/ReportsNavigation.tsx`
- Modify: `frontend/src/components/reports/ReportsTabContent.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`

**Interfaces:**
- Consumes: navegación y pestañas existentes sin cambiar `activeTab` ni `onChange`.
- Produces: `.reports-workspace`, una cabecera compacta y estilos de estados seleccionados/hover/foco coherentes con los tokens actuales.

- [ ] **Step 1: Añadir una aserción estructural fallida**

```tsx
const workspace = screen.getByTestId('reports-workspace');
expect(within(workspace).getByRole('radiogroup', { name: 'Categoría del reporte' })).toBeInTheDocument();
expect(within(workspace).getByRole('combobox', { name: 'Tipo de reporte' })).toBeInTheDocument();
expect(within(workspace).getByRole('heading', { name: 'Cierre contable' })).toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar y confirmar que la superficie no existe**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx`

Expected: FAIL porque no existe `data-testid="reports-workspace"`.

- [ ] **Step 3: Unir la estructura sin mover lógica de negocio**

```tsx
<div className="reports-workspace" data-testid="reports-workspace">
  <ReportsNavigation ... />
  <ReportsTabContent>{/* pestaña activa existente */}</ReportsTabContent>
</div>
```

En `ReportsNavigation`, eliminar `reports-module-nav__description`; el título y subtítulo de la pestaña ya aportan ese contexto. Mantener los radios nativos y diseñar sus `label` como control segmentado compacto con estados `:hover`, `:focus-within` y `:has(input:checked)`.

- [ ] **Step 4: Aplicar estilos de densidad y jerarquía**

```css
.reports-workspace {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.85rem;
  background: var(--bg-surface);
  padding: 1rem;
}

.reports-module-nav {
  display: grid;
  grid-template-columns: auto minmax(16rem, 22rem);
  align-items: end;
  gap: 0.75rem 1rem;
  border: 0;
  padding: 0 0 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}

.report-active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

Los filtros desplegados usarán columnas con anchos máximos útiles en escritorio, el resumen usará divisores internos y no se agregarán tarjetas ni sombras. Añadir reglas adaptables para 1024 px y 767 px sin priorizar móvil sobre PC.

- [ ] **Step 5: Ejecutar pruebas y build del frontend**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportCollapsibleFilters.test.tsx src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx src/components/__tests__/Reports.behavior.test.tsx && npm run build`

Expected: PASS y compilación Vite exitosa.

---

### Task 5: Validación completa y despliegue

**Files:**
- Review: todos los archivos modificados en Tasks 1–4.

**Interfaces:**
- Consumes: implementación terminada y entorno local/producción existente.
- Produces: evidencia automatizada, visual y operativa del flujo completo.

- [ ] **Step 1: Ejecutar controles estáticos y suites**

Run: `npm run lint && npm run test && cd frontend && npm run build`

Expected: lint, backend tests, frontend tests y build sin fallas.

- [ ] **Step 2: Revisar el diff y el alcance**

Run: `git diff --check && git status --short && git diff --stat && git diff`

Expected: solo cambios del módulo de informes y documentación; `tmp/` permanece sin seguimiento y no se incluye.

- [ ] **Step 3: Validar el flujo real en Chrome**

Abrir `/reports` con el usuario QA administrador y comprobar en escritorio estándar y ancho:

1. Los filtros están cerrados al entrar en cada informe.
2. El botón anuncia el conteo y conserva el valor al cerrar.
3. Cada etiqueta retira solo su filtro.
4. Categoría, tipo de informe, exportación, resumen y tabla no se desbordan.
5. Excel y PDF siguen descargando con los filtros activos.
6. Tab, Shift+Tab, Enter y Space operan radios, selector, botón y campos.
7. La consola no contiene errores ni advertencias nuevas y la red no contiene solicitudes fallidas inesperadas.

- [ ] **Step 4: Comparar visualmente referencia y resultado**

Capturar el mismo ancho y estado que la referencia, abrir ambas imágenes juntas y corregir espacios muertos, alineación, bordes, radios, pesos tipográficos o separadores que todavía fragmenten la interfaz.

- [ ] **Step 5: Publicar y comprobar producción**

```bash
git add frontend/src/components frontend/src/i18n frontend/src/index.css docs/superpowers
git commit -m "fix(reports): compact report query workspace"
git push origin master
railway redeploy --service backend --yes
railway redeploy --service frontend --yes
```

Verificar después `https://frontend-production-3058.up.railway.app/reports` con el mismo flujo y confirmar que el commit desplegado corresponde a `master`.
