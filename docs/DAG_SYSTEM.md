# Sistema de Fórmulas DAG (Directed Acyclic Graph)

## Visión General

El sistema de fórmulas DAG es el **motor de cálculo único** para simulación y creación de créditos. No existe fallback ni código legacy: el DAG es la única fuente de verdad.

Un admin puede editar visualmente el grafo de fórmulas en el workbench. Cada cambio afecta inmediatamente las simulaciones y la creación de nuevos créditos. No se requiere despliegue ni reinicio.

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Dashboard de │  │  Editor de   │  │  Simulador de        │  │
│  │ Fórmulas     │  │  Fórmulas    │  │  Créditos            │  │
│  │ (lista)      │  │  (visual)    │  │  (usa DAG activo)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                      │
│         └────────┬────────┘                                      │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │  dagService.ts  │  ← API client para workbench        │
│         └────────┬────────┘                                      │
└──────────────────┼──────────────────────────────────────────────┘
                   │ HTTP /api/loans/workbench/*
                   │ HTTP /api/loans/simulations
┌──────────────────┼──────────────────────────────────────────────┐
│                  │                         BACKEND               │
│         ┌────────▼────────┐                                      │
│         │  Credits Router │  ← /loans/* routes                  │
│         └────────┬────────┘                                      │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │ Use Cases       │  ← Orchestración pura               │
│         └────────┬────────┘                                      │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │ DagWorkbench    │  ← Validación, save, simulate       │
│         │ Service         │                                      │
│         └────────┬────────┘                                      │
│                  │                                               │
│    ┌─────────────┼─────────────┐                                 │
│    │             │             │                                 │
│ ┌──▼───┐   ┌────▼────┐   ┌───▼────┐                            │
│ │Graph │   │Simulation│   │  DAG   │                            │
│ │Repo  │   │Summary   │   │Executor│                            │
│ └──┬───┘   └────┬─────┘   └───┬────┘                            │
│    │            │             │                                  │
│ ┌──▼────────────▼─────────────▼──┐                              │
│ │       DagGraphVersion          │  ← Modelo en DB              │
│ │       (grafo + metadata)       │                              │
│ └────────────────────────────────┘                              │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │              CalculationEngine + BigNumberEngine              ││
│ │  (mathjs BigNumber + whitelist de funciones + helpers)      ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend

### Stack y Dependencias

- **Runtime**: Node.js, Express 5
- **ORM**: Sequelize (PostgreSQL)
- **Math**: mathjs en modo BigNumber
- **Auth**: JWT + middleware de roles

### Modelos

#### `DagGraphVersion`

Almacena versiones del grafo de fórmulas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | Identificador único |
| `scopeKey` | STRING | `'credit-simulation'` (único scope actual) |
| `name` | STRING | Nombre humano de la fórmula |
| `description` | STRING | Descripción opcional |
| `version` | INTEGER | Número de versión secuencial |
| `status` | ENUM | `'active'` \| `'inactive'` |
| `graph` | JSONB | `{ nodes: DagNode[], edges: DagEdge[] }` |
| `graphSummary` | JSONB | `{ nodeCount, edgeCount, outputCount, formulaNodeCount }` |
| `validation` | JSONB | Resultado de validación del grafo |
| `createdByUserId` | INTEGER FK | Quién creó la versión |
| `commitMessage` | STRING | Mensaje de commit (opcional) |
| `restoredFromVersionId` | INTEGER | Si se restauró de otra versión |

**Restricciones**: Solo una versión `active` por `scopeKey`.

#### `DagSimulationSummary`

Historial de simulaciones ejecutadas desde el workbench.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | Identificador |
| `scopeKey` | STRING | Scope de la simulación |
| `graphVersionId` | INTEGER FK | Versión del grafo usada |
| `createdByUserId` | INTEGER FK | Quién ejecutó |
| `selectedSource` | STRING | `'dag'` \| `'draft'` |
| `fallbackReason` | STRING | `null` siempre (no hay fallback) |
| `simulationInput` | JSONB | Inputs usados `{ amount, interestRate, termMonths }` |
| `summary` | JSONB | Resultado resumido |
| `schedulePreview` | JSONB | Primeras 5 filas del cronograma |

#### `Loan`

Referencia a la versión del grafo usada al crear el crédito.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `dagGraphVersionId` | INTEGER FK | Grafo activo al momento de crear el préstamo |

### Nodos del Grafo (`DagNode`)

```typescript
interface DagNode {
  id: string;           // Identificador único (ej: 'amount', 'schedule')
  kind: NodeKind;       // 'constant' | 'formula' | 'conditional' | 'output' | 'lookup'
  label: string;        // Etiqueta humana (ej: 'Monto del préstamo')
  outputVar?: string;   // Variable que exporta (ej: 'amount')
  formula?: string;     // Fórmula mathjs (solo kind !== 'constant')
  description?: string; // Documentación
  x?: number;           // Posición X en el canvas
  y?: number;           // Posición Y en el canvas
}
```

**Tipos de nodo**:

| Tipo | Color | Propósito |
|------|-------|-----------|
| `constant` | Azul | Valores de entrada (`amount`, `interestRate`, `termMonths`) |
| `formula` | Ámbar | Transformaciones (`buildAmortizationSchedule(...)`) |
| `conditional` | Violeta | Lógica condicional (`ifThenElse(...)`) |
| `output` | Esmeralda | Resultado final (`buildSimulationResult(...)`) |
| `lookup` | Rosa | Valores de lookup (no usado actualmente) |

#### `DagEdge`

```typescript
interface DagEdge {
  source: string;  // ID del nodo origen
  target: string;  // ID del nodo destino
}
```

### Contrato de Entrada/Salida

**Inputs requeridos** (viene del formulario de simulación/crédito):
- `amount` — monto del préstamo
- `interestRate` — tasa de interés (% anual)
- `termMonths` — plazo en meses

**Inputs opcionales**:
- `startDate` — fecha de inicio (default: hoy)
- `lateFeeMode` — modo de mora (default: `'SIMPLE'`)

**Outputs requeridos** (el grafo DEBE producir esto):
- `result` → objeto con:
  - `lateFeeMode`: string
  - `schedule`: array de amortización
  - `summary`: objeto con totales

### Helpers Inyectados en el Scope

El `scopeBuilder.js` inyecta estas funciones en el contexto de evaluación de mathjs:

```javascript
// Construcción de datos
buildAmortizationSchedule(amount, rate, term, startDate, lateFeeMode)
summarizeSchedule(schedule)
buildSimulationResult(lateFeeMode, schedule, summary)

// Utilidades
roundCurrency(value)
assertSupportedLateFeeMode(mode)
calculateLateFee(...)

// Lógica
ifThenElse(condition, thenValue, elseValue)
```

**Whitelist de funciones permitidas** en `BigNumberEngine.js`:
```
add, subtract, multiply, divide, mod, pow, abs, ceil, floor, round,
sqrt, log, exp, max, min, mean, median, format,
conj, re, im, fix, gamma,
calculateLateFee, buildAmortizationSchedule, summarizeSchedule,
roundCurrency, assertSupportedLateFeeMode, buildSimulationResult,
ifThenElse, and, or, not
```

### Flujo de Ejecución

#### 1. Simulación de Crédito (`/loans/simulations`)

```
POST /api/loans/simulations
Body: { amount, interestRate, termMonths, startDate?, lateFeeMode? }

1. calculationAdapter.calculate(input)
2. graphExecutor.execute({ scopeKey: 'credit-simulation', contractVars: input })
3. Carga la versión activa de DagGraphVersion desde DB
4. calculationEngine.execute(graph, contractVars)
5. Valida inputs contra scopeRegistry.simulationInput
6. Ejecuta nodos en orden topológico
7. Valida outputs contra scopeRegistry.simulationOutput
8. Devuelve { result, graphVersionId }
```

#### 2. Creación de Crédito (`POST /loans`)

```
1. loanCreationService.createLoan(data)
2. calculationAdapter.calculate({ amount, interestRate, termMonths, ... })
3. Toma el result.schedule y result.summary para construir el préstamo
4. Guarda loan.dagGraphVersionId = graphVersionId del cálculo
5. Persiste el préstamo con su cronograma
```

Esto garantiza **trazabilidad completa**: cada préstamo sabe exactamente qué versión de fórmulas se usó.

#### 3. Workbench Simulate (`POST /loans/workbench/graph/simulations`)

```
Body: { scopeKey, graph, simulationInput }

1. workbenchService.simulateGraph({ actor, scopeKey, graph, simulationInput })
2. graphExecutor.executeDraft({ graph, contractVars: simulationInput })
3. No guarda en DB, ejecuta el grafo tal cual viene del frontend
4. Devuelve { simulation: result, summary }
```

### API Endpoints (Workbench)

Todos requieren rol `admin`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/loans/workbench/scopes` | Lista scopes disponibles |
| `GET` | `/api/loans/workbench/graph?scope={key}` | Carga grafo activo del scope |
| `POST` | `/api/loans/workbench/graph` | Guarda nueva versión del grafo |
| `POST` | `/api/loans/workbench/graph/validate` | Valida un grafo sin guardar |
| `POST` | `/api/loans/workbench/graph/simulations` | Simula un grafo (draft) |
| `GET` | `/api/loans/workbench/graph/summary` | Resumen del scope |
| `GET` | `/api/loans/workbench/graphs?scope={key}` | Lista todas las versiones |
| `GET` | `/api/loans/workbench/graphs/:id` | Detalle de una versión |
| `PATCH` | `/api/loans/workbench/graphs/:id/status` | Activa/desactiva versión |
| `DELETE` | `/api/loans/workbench/graphs/:id` | Elimina versión (solo si no usada) |
| `GET` | `/api/loans/workbench/graphs/:id/history` | Historial de cambios |
| `GET` | `/api/loans/workbench/graphs/:id/diff` | Diff entre versiones |
| `POST` | `/api/loans/workbench/graphs/:id/restore` | Restaura versión anterior |

### Seguridad de Fórmulas

El sistema valida fórmulas antes de ejecutarlas:

1. **Patrones bloqueados** (regex): `import(`, `evaluate(`, `parse(`, `createUnit(`, `simplify(`, `derivative(`, `chain(`, `typed(`, `config(`, `importFrom(`
2. **Whitelist de funciones**: Solo funciones explícitamente permitidas en `BigNumberEngine.ALLOWED_FUNCTIONS`
3. **Sin object literals**: mathjs no parsea `{ key: value }`. Todos los datos se pasan como argumentos posicionales a helpers.
4. **Validación de ciclos**: El grafo debe ser un DAG (sin ciclos).
5. **Validación de contrato**: Todos los inputs requeridos deben estar presentes; todos los outputs requeridos deben producirse.

### Seeding Inicial

En el primer boot (`bootstrap/schema.js`), si no existe ninguna versión para el scope `credit-simulation`, se crea automáticamente la **v1 por defecto** desde `scopeRegistry.defaultGraph`:

```
nodes:
  amount (constant) → schedule (formula: buildAmortizationSchedule(...))
  interestRate (constant) → schedule
  termMonths (constant) → schedule
  startDate (constant) → schedule
  lateFeeMode (constant) → result
  schedule → summary (formula: summarizeSchedule(...))
  schedule → result
  summary → result
  result (output: buildSimulationResult(...))
```

---

## Frontend

### Stack

- **Framework**: React 19 + TypeScript 6
- **Build**: Vite 8
- **Styling**: Tailwind CSS
- **State**: Zustand (editor local), TanStack Query (server state)
- **Routing**: React Router v7
- **Icons**: Lucide React

### Componentes Principales

#### `DashboardPage.tsx` (`/formulas`)

Página de listado de fórmulas. Muestra:
- Fórmula activa actual (scope `credit-simulation`)
- Historial de versiones con badge de estado
- Botón "Nueva fórmula" → navega a `/formulas/new`
- Acciones por versión: activar, ver diff, eliminar

#### `FormulaEditorPage.tsx` (`/formulas/new` y `/formulas/:id`)

Editor visual del grafo. Es la pieza central del sistema.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [← Volver]  Nombre de fórmula  [Guardar] [Simular]        │
├──────────┬──────────────────────────────────────┬───────────┤
│ Toolbox  │           Canvas (SVG)               │  Panel    │
│          │                                      │  de       │
│  [+]     │    ┌─────┐      ┌─────┐             │  Propie-  │
│Constante │    │Monto│─────→│Tabla│────────┐    │  dades    │
│  [+]     │    └─────┘      └─────┘        │    │           │
│Fórmula   │         ┌─────┐               ▼    │  (cuando  │
│  [+]     │         │Tasa │─────────→  ┌────┐  │  se       │
│Output    │         └─────┘            │Res │  │  selecc.  │
│          │                            └────┘  │  nodo)    │
├──────────┤                            ▲       │           │
│ Live Test│    ┌─────┐                  │       │  O        │
│          │    │Plazo│──────────────────┘       │  (cuando  │
│ Inputs   │    └─────┘                          │  no hay   │
│  amount  │                                      │  selección│
│  rate    │                                      │           │
│  term    │                                      │           │
│          │                                      │           │
│ [Evaluar]│                                      │           │
│          │                                      │           │
│ Result   │                                      │           │
└──────────┴──────────────────────────────────────┴───────────┘
```

**Funcionalidades**:

| Feature | Descripción |
|---------|-------------|
| **Crear nodo** | Toolbox lateral con botones para cada tipo de nodo |
| **Eliminar nodo** | Botón 🗑 en la tarjeta del nodo; limpia edges automáticamente |
| **Crear edge** | Dropdowns de "desde" → "hasta" en cada nodo |
| **Eliminar edge** | Botón X junto a cada edge listado |
| **Renombrar nodo** | Editable en el panel derecho; actualiza edges automáticamente |
| **Editar fórmula** | Campo de texto con validación visual de chips amigables |
| **Mover nodos** | Drag & drop en el canvas con posiciones persistidas |
| **Zoom** | +/- con botones o scroll |
| **Undo/Redo** | Historial de cambios en el store |
| **Simular** | Panel "Live Test" con inputs editables y resultado en tiempo real |
| **Guardar** | Persiste como nueva versión en el backend |

**Visualización de fórmulas**:

Las fórmulas se muestran como **chips amigables**, no como código crudo:

```
// Fórmula real:
buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)

// Visualización:
[🟡 Generar tabla de amortización]
```

Los parámetros se ocultan; el usuario ve solo la acción. Para expresiones condicionales:

```
// Fórmula real:
ifThenElse(amount > 5000, 'A', 'B')

// Visualización:
[IF] [amount] [>] [5000] [THEN] [A] [ELSE] [B]
```

#### `CreditSimulator.tsx` (`/simulator`)

Formulario simple que usa el DAG activo para simular. El usuario no sabe que hay fórmulas detrás; solo ve inputs y un cronograma de amortización.

#### `NewCredit.tsx` (`/credits-new`)

Formulario de creación de crédito que internamente:
1. Llena los inputs del usuario
2. Llama `POST /loans/simulations` para previsualizar
3. Al confirmar, llama `POST /loans` que usa el mismo DAG para generar el cronograma real

### Store Local (`blockEditorStore.ts`)

Zustand store para estado del editor antes de guardar:

```typescript
interface GraphEditorState {
  graph: DagGraph | null;           // Nodos y edges actuales
  selectedNodeId: string | null;    // Nodo seleccionado
  zoom: number;                     // 0.5 - 2.0
  formulaName: string;
  formulaDescription: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  scopeKey: string;
  undoStack: DagGraph[];
  redoStack: DagGraph[];
}
```

**Acciones clave**:
- `setGraph` / `addNode` / `removeNode` / `addEdge` / `removeEdge`
- `updateNodeField(id, field, value)` — edita cualquier propiedad del nodo
- `updateNodePosition(id, x, y)` — para drag & drop
- `generateNodeId(prefix)` — genera IDs únicos
- `undo()` / `redo()` — navega el historial

### Servicios (`dagService.ts`)

Cliente HTTP para todas las APIs del workbench:

```typescript
export const dagService = {
  listScopes(): Promise<DagWorkbenchScopesResponse>
  loadGraph(scopeKey): Promise<LoadGraphResponse>
  saveGraph(payload): Promise<SaveGraphResponse>
  validateGraph(payload): Promise<ValidateGraphResponse>
  simulateGraph(payload): Promise<SimulateGraphResponse>
  simulate(input): Promise<SimulationResponse>           // /loans/simulations
  listGraphs(scopeKey): Promise<GraphListResponse>
  getGraphDetails(graphId): Promise<GraphDetailsResponse>
  updateGraphStatus(graphId, status): Promise<...>
  deleteGraph(graphId): Promise<...>
  getGraphHistory(graphId): Promise<...>
  getGraphDiff(graphId, compareToVersionId): Promise<...>
  restoreGraph(graphId, commitMessage?): Promise<...>
}
```

### Tipos (`types/dag.ts`)

```typescript
export interface DagGraph {
  nodes: DagNode[];
  edges: DagEdge[];
}

export type NodeKind = 'constant' | 'formula' | 'conditional' | 'output' | 'lookup';

export interface DagNode {
  id: string;
  kind: NodeKind;
  label: string;
  outputVar?: string;
  formula?: string;
  description?: string;
  x?: number;
  y?: number;
}

export interface DagEdge {
  source: string;
  target: string;
}

export interface DagSimulationSummary {
  id: number;
  scopeKey: string;
  graphVersionId: number | null;
  createdByUserId: number;
  selectedSource: 'dag' | 'draft';  // ← NO hay 'legacy'
  fallbackReason: string | null;
  simulationInput: SimulationInput;
  summary: SimulationSummary;
  schedulePreview: AmortizationRow[];
  createdAt: string;
}

// NO existe ParityResult — fue eliminado con el legacy
```

### Query Keys (`queryKeys.ts`)

```typescript
dag: {
  graphs: (scopeKey: string) => ['dag.graphs', scopeKey],
  history: (graphId: number) => ['dag.history', graphId],
  diff: (graphId: number, compareToVersionId: number) => ['dag.diff', graphId, compareToVersionId],
}
```

---

## Flujo Completo: Edición → Simulación → Crédito

### Paso 1: Admin edita la fórmula

1. Admin navega a `/formulas`
2. Clic en "Nueva fórmula" → `/formulas/new`
3. Editor carga con grafo por defecto (v1 activa)
4. Admin modifica nodos/edges (ej: cambia fórmula de `schedule`)
5. Clic "Simular" → llama `POST /workbench/graph/simulations` con el grafo en memoria
6. Ve resultado en tiempo real en panel "Live Test"
7. Clic "Guardar" → `POST /workbench/graph` crea nueva versión
8. Backend activa la nueva versión automáticamente (desactiva la anterior)

### Paso 2: Usuario simula un crédito

1. Usuario va a `/simulator`
2. Ingresa `amount`, `interestRate`, `termMonths`
3. Frontend llama `POST /loans/simulations`
4. Backend:
   - Carga la versión activa de `DagGraphVersion`
   - Ejecuta el grafo con los inputs
   - Devuelve `{ result, graphVersionId }`
5. Frontend muestra cronograma de amortización

### Paso 3: Admin crea un crédito

1. Admin va a `/credits-new`, selecciona cliente
2. Ingresa datos del préstamo (mismo input que simulación)
3. Frontend muestra preview llamando `POST /loans/simulations`
4. Admin confirma → `POST /loans`
5. Backend:
   - Ejecuta el DAG activo para generar `schedule` y `summary`
   - Guarda el préstamo con `loan.dagGraphVersionId = graphVersionId`
   - El préstamo ahora tiene trazabilidad completa de qué fórmula se usó

---

## Reglas de Oro

### Backend
1. **DAG es la única fuente de verdad**. No hay fallback, no hay legacy, no hay `simulateCredit()` alternativo.
2. **Toda fórmula es string mathjs validada**. No se acepta código arbitrario.
3. **Helpers usan argumentos posicionales**. `buildAmortizationSchedule(amount, rate, term)` — NUNCA `{ amount, rate }`.
4. **Cada préstamo guarda `dagGraphVersionId`**. Trazabilidad total.
5. **Solo un scope existe**: `credit-simulation`.
6. **Solo un grafo activo por scope**. Al guardar uno nuevo, el anterior se desactiva.

### Frontend
1. **El editor NUNCA muestra código crudo** al usuario. Solo chips amigables.
2. **El usuario no necesita saber que es un DAG**. Ve "bloques" conectados con flechas.
3. **Simulación y creación usan el mismo endpoint** de cálculo. Lo que se simula es exactamente lo que se crea.
4. **El grafo se edita en memoria** hasta que se guarda explícitamente.
5. **Undo/Redo funciona en el store local**, no en el servidor.

---

## Testing

### Backend (598 tests)

```bash
cd backend
NODE_ENV=test node --require module-alias/register --test
```

Capas cubiertas:
- Validación de fórmulas (patrones bloqueados, whitelist, sintaxis)
- Ejecución del engine (cálculos correctos, orden topológico, manejo de errores)
- Workbench service (save, simulate, activate, delete, history, restore)
- Router E2E (todos los endpoints con auth y validación)
- Integración con loan creation (DAG → préstamo real)
- Schema (verificación de tablas/columnas)

### Frontend (71 tests)

```bash
cd frontend
npm test -- --run
```

Capas cubiertas:
- Renderizado del editor (nodos, edges, panel de propiedades)
- Acciones del store (add/remove/undo/redo)
- Servicios (mock de API, formatos de request/response)
- Componentes behaviorales (simulación con inputs, guardar grafo)
- Navegación y rutas protegidas

---

## Variables de Entorno Relevantes

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `CREDITS_DAG_WORKBENCH_ENABLED` | `true` | Habilita el workbench |
| `CREDITS_DAG_WORKBENCH_SCOPES` | `credit-simulation` | Scopes permitidos |
| `DB_SCHEMA_MODE` | `verify` | Verifica schema sin alterar |

**NO existen más**:
- `DAG_ROLLOUT_MODE` ❌
- `CREDITS_DAG_MODE` ❌
- `CREDITS_DAG_TOLERANCE` ❌

---

## Futuras Extensiones (no implementado)

- **Múltiples scopes**: Aunque solo existe `credit-simulation`, la arquitectura soporta más.
- **Nodos de lookup**: Conectar a APIs externas (buro de crédito, etc.).
- **Variables parametrizables**: Aunque el registry fue removido, podría reintroducirse como metadatos del grafo.
- **Previews en tiempo real**: Ejecutar el grafo mientras se escribe (debounced).
- **Comparación visual de versiones**: Diff gráfico entre dos versiones del grafo.

---

## Contacto / Decisiones Arquitectónicas

- **¿Por qué no hay fallback?** El usuario pidió explícitamente eliminar todo legacy. Si una fórmula está rota, se ve en el workbench y se arregla antes de activarla.
- **¿Por qué mathjs y no un engine propio?** mathjs con BigNumber da precisión decimal, tiene parser robusto, y con whitelist + regex de patrones bloqueados es seguro.
- **¿Por qué no bloques visuales arrastrables tipo Scratch?** El equipo decidió que nodos conectados en un grafo es más expresivo para fórmulas financieras que bloques encajables. Un nodo de fórmula puede tener múltiples entradas y salidas.
- **¿Por qué cada cambio crea una nueva versión?** Inmutabilidad = trazabilidad. Si un préstamo se creó con v3, siempre sabemos qué fórmula se usó.

---

*Documento generado el 2026-04-22. Sistema DAG v1.0 — producción lista.*
