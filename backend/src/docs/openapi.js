const buildEndpoints = (moduleRegistry = []) => Object.fromEntries(
  moduleRegistry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]),
);

/**
 * Build the OpenAPI document for production-critical backend surfaces.
 * The spec intentionally covers stable public contracts only; module tests
 * keep the implementation routes aligned with this document.
 *
 * @param {{ moduleRegistry?: Array<{ name: string, basePath: string }> }} [options]
 * @returns {object}
 */
const buildOpenApiDocument = ({ moduleRegistry = [] } = {}) => ({
  openapi: '3.0.3',
  info: {
    title: 'CrediCobranza API',
    version: '1.0.0',
    description: 'API operacional para créditos, pagos, perfiles de cálculo, configuración y auditoría.',
  },
  servers: [
    { url: '/api' },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Credits' },
    { name: 'Calculation profiles' },
    { name: 'Config' },
    { name: 'Payments' },
    { name: 'Associates' },
    { name: 'Reports' },
    { name: 'Notifications' },
    { name: 'Audits' },
  ],
  'x-module-endpoints': buildEndpoints(moduleRegistry),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      IdempotencyKeyHeader: {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', maxLength: 160 },
        description: 'Clave obligatoria por intento de mutación financiera para evitar doble aplicación ante reintentos o concurrencia.',
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              statusCode: { type: 'integer' },
            },
          },
        },
      },
      CreditCalculationInput: {
        type: 'object',
        required: ['amount', 'termMonths'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          interestRate: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Opcional para simulaciones manuales. La creación real de créditos debe usar rateSource=policy y la tasa se resuelve desde /config/rate-policies.',
          },
          termMonths: { type: 'integer', minimum: 1, maximum: 360 },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Fecha operativa de vencimiento de la primera cuota. El backend conserva el día seleccionado como fecha UTC pura para evitar corrimientos por zona horaria.',
          },
          calculationMethod: { type: 'string', enum: ['FRENCH', 'SIMPLE', 'COMPOUND'], description: 'Método de cálculo operativo. Si se omite, el backend usa FRENCH.' },
          lateFeeMode: {
            type: 'string',
            enum: ['NONE', 'SIMPLE', 'COMPOUND'],
            description: 'Modos operativos admitidos por la simulación y por las políticas de mora configurables.',
          },
          annualLateFeeRate: { type: 'number', minimum: 0, maximum: 100 },
          rateSource: { type: 'string', enum: ['policy', 'manual'], description: 'Para POST /loans debe ser policy; no se aceptan tasas manuales en créditos reales.' },
          lateFeeSource: { type: 'string', enum: ['policy', 'manual'], description: 'Para POST /loans debe ser policy; la mora de créditos reales se resuelve desde /config/late-fee-policies.' },
        },
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          description: { type: 'string' },
          requiresReference: { type: 'boolean' },
        },
      },
      PaymentApplicationInput: {
        type: 'object',
        required: ['loanId', 'amount'],
        properties: {
          loanId: { type: 'integer', minimum: 1 },
          amount: { type: 'number', minimum: 0.01 },
          paymentDate: { type: 'string', format: 'date-time', description: 'Fecha operativa elegida para aplicar el pago. Puede enviarse como fecha o fecha-hora; si se omite, el backend usa la fecha actual.' },
          paymentMethod: { type: 'string', description: 'Clave canónica configurada en /config/payment-methods.' },
        },
      },
      CapitalPaymentInput: {
        allOf: [
          { $ref: '#/components/schemas/PaymentApplicationInput' },
          {
            type: 'object',
            properties: {
              strategy: {
                type: 'string',
                enum: ['reduce_term', 'reduce_payment', 'REDUCE_TIME', 'REDUCE_QUOTA'],
                description: 'Estrategia de abono: reduce_term mantiene cuota aproximada y reduce plazo; reduce_payment difiere el capital vivo nuevo en newTermMonths.',
              },
              newTermMonths: {
                type: 'integer',
                minimum: 1,
                maximum: 360,
                description: 'Cantidad de cuotas definida por el operador para redistribuir el saldo restante cuando strategy=reduce_payment.',
              },
            },
          },
        ],
      },
      RatePolicy: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          minAmount: { type: 'number', nullable: true },
          maxAmount: { type: 'number', nullable: true },
          annualEffectiveRate: { type: 'number', minimum: 0, maximum: 100 },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
      LateFeePolicy: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          annualEffectiveRate: { type: 'number', minimum: 0, maximum: 100 },
          lateFeeMode: {
            type: 'string',
            enum: ['NONE', 'SIMPLE', 'COMPOUND'],
            description: 'Las políticas de mora configurables usan únicamente NONE, SIMPLE o COMPOUND.',
          },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
      AssociateInput: {
        type: 'object',
        required: ['name', 'email', 'phone'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive'] },
          participationPercentage: { type: 'number', minimum: 0, maximum: 100, nullable: true },
          initialCapital: {
            type: 'number',
            minimum: 0.01,
            description: 'Capital inicial opcional. Si se envía, el backend registra aporte inicial y agenda el primer pago de interés.',
          },
          interestType: { type: 'string', enum: ['monthly', 'annual'], description: 'Periodicidad de interés reconocido al socio.' },
          interestRate: { type: 'number', minimum: 0, maximum: 100, description: 'Tasa pactada por periodo: mensual si interestType=monthly, anual si interestType=annual.' },
          interestPaymentDay: { type: 'integer', minimum: 1, maximum: 28 },
          interestPaymentMonth: { type: 'integer', minimum: 1, maximum: 12, description: 'Mes de pago cuando el interés es anual.' },
          interestStartDate: { type: 'string', format: 'date', description: 'Fecha desde la que se calcula el primer vencimiento de interés.' },
        },
      },
      AssociateInstallmentPaymentInput: {
        type: 'object',
        properties: {
          paymentDate: { type: 'string', format: 'date-time' },
          paymentMethod: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        security: [],
        responses: {
          200: { description: 'Sesión creada' },
          401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/loans/calculations': {
      post: {
        tags: ['Credits'],
        summary: 'Calcular un crédito con el perfil de cálculo activo',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreditCalculationInput' } },
          },
        },
        responses: {
          200: { description: 'Cálculo generado con versión de perfil y política aplicada' },
          400: { description: 'Parámetros inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/loans': {
      get: { tags: ['Credits'], summary: 'Listar créditos', responses: { 200: { description: 'Créditos visibles para el rol' } } },
      post: {
        tags: ['Credits'],
        summary: 'Crear crédito real congelando perfil de cálculo y políticas aplicadas',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
        responses: { 201: { description: 'Crédito creado' } },
      },
    },
    '/loans/{loanId}/installments/{installmentNumber}/quote': {
      get: {
        tags: ['Credits'],
        summary: 'Cotizar una cuota antes de pagar',
        parameters: [
          { name: 'loanId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'installmentNumber', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'asOfDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Cotización de cuota' } },
      },
    },
    '/config/payment-methods': {
      get: { tags: ['Config'], summary: 'Listar métodos de pago canónicos', responses: { 200: { description: 'Métodos de pago' } } },
      post: { tags: ['Config'], summary: 'Crear método de pago', responses: { 201: { description: 'Método creado' } } },
    },
    '/config/rate-policies': {
      get: { tags: ['Config'], summary: 'Listar políticas de tasa', responses: { 200: { description: 'Políticas de tasa' } } },
      post: { tags: ['Config'], summary: 'Crear política de tasa', responses: { 201: { description: 'Política creada' } } },
    },
    '/config/late-fee-policies': {
      get: { tags: ['Config'], summary: 'Listar políticas de mora', responses: { 200: { description: 'Políticas de mora' } } },
      post: { tags: ['Config'], summary: 'Crear política de mora', responses: { 201: { description: 'Política creada' } } },
    },
    '/payments/capital': {
      post: {
        tags: ['Payments'],
        summary: 'Registrar abono a capital',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CapitalPaymentInput' } },
          },
        },
        responses: { 201: { description: 'Abono aplicado' } },
      },
    },
    '/payments/partial': {
      post: {
        tags: ['Payments'],
        summary: 'Registrar pago parcial',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentApplicationInput' } },
          },
        },
        responses: { 201: { description: 'Pago parcial aplicado' } },
      },
    },
    '/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Registrar pago de cuota por operador interno',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentApplicationInput' } },
          },
        },
        responses: { 201: { description: 'Pago aplicado' } },
      },
    },
    '/payments/pay-total-debt': {
      post: {
        tags: ['Payments'],
        summary: 'Pagar la deuda total de un crédito',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
        responses: {
          201: { description: 'Crédito liquidado' },
          400: { description: 'Cotización vencida o bloqueo financiero', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/payments/{paymentId}/voucher/pdf': {
      get: {
        tags: ['Payments'],
        summary: 'Descargar comprobante PDF de un pago',
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Comprobante PDF' } },
      },
    },
    '/associates': {
      get: {
        tags: ['Associates'],
        summary: 'Listar socios',
        description: 'Lista personas que aportan capital, con términos de interés pactados y participación operativa.',
        responses: { 200: { description: 'Socios visibles para el rol' } },
      },
      post: {
        tags: ['Associates'],
        summary: 'Registrar socio con capital e interés pactado',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssociateInput' } } },
        },
        responses: { 201: { description: 'Socio registrado con trazabilidad de capital inicial e interés cuando aplica' } },
      },
    },
    '/associates/{associateId}/financial-details': {
      get: {
        tags: ['Associates'],
        summary: 'Consultar detalle financiero del socio',
        parameters: [{ name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Resumen de capital aportado, interés pagado, deuda, movimientos y cuotas del socio' } },
      },
    },
    '/associates/{associateId}/contributions': {
      post: {
        tags: ['Associates'],
        summary: 'Registrar aporte de capital del socio',
        parameters: [{ name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 201: { description: 'Aporte registrado y siguiente interés agendado cuando no hay cuota pendiente' } },
      },
    },
    '/associates/{associateId}/installments': {
      get: {
        tags: ['Associates'],
        summary: 'Listar intereses programados del socio',
        parameters: [{ name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Cuotas de interés con totales pagados, pendientes y vencidos' } },
      },
    },
    '/associates/{associateId}/installments/{installmentNumber}/pay': {
      post: {
        tags: ['Associates'],
        summary: 'Registrar pago de interés al socio',
        parameters: [
          { name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'installmentNumber', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssociateInstallmentPaymentInput' } } },
        },
        responses: { 200: { description: 'Pago registrado y siguiente vencimiento de interés generado' } },
      },
    },
    '/associates/{associateId}/profitability': {
      get: {
        tags: ['Associates'],
        summary: 'Consultar rentabilidad y movimientos del socio',
        parameters: [{ name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Resumen de aportes, intereses/retiros y capital devuelto del socio' } },
      },
    },
    '/associates/{associateId}/export': {
      get: {
        tags: ['Associates'],
        summary: 'Exportar el historial detallado de un socio',
        parameters: [
          { name: 'associateId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'csv'], default: 'xlsx' } },
        ],
        responses: { 200: { description: 'Archivo detallado del socio con aportes, devoluciones y rentabilidad' } },
      },
    },
    '/associates/export': {
      get: {
        tags: ['Associates'],
        summary: 'Exportar socios a Excel o PDF operativo',
        description: 'Genera el reporte administrativo de socios desde su propio módulo, sin mezclarlo con reportes de créditos.',
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'pdf'], default: 'xlsx' } },
          { name: 'associateId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filtra el reporte por socio inversionista.' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] }, description: 'Filtra socios activos o inactivos.' },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Archivo de socios en el formato solicitado' } },
      },
    },
    '/loans/{loanId}/payoff-executions': {
      post: {
        tags: ['Payments'],
        summary: 'Ejecutar pago total desde detalle de crédito',
        parameters: [
          { name: 'loanId', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/IdempotencyKeyHeader' },
        ],
        responses: {
          201: { description: 'Pago total aplicado' },
          400: { description: 'Cotización vencida o bloqueo financiero', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/reports/credits/excel': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar créditos a Excel consolidado',
        description: [
          'Genera el reporte operativo de créditos con la estructura aprobada para auditoría financiera:',
          'hoja Resumen General, hoja Detalle de Créditos y una hoja por crédito con amortización e historial de pagos.',
          'Incluye campos financieros clave como capital pagado, interés pagado, interés generado, mora, saldo pendiente y próxima fecha de pago.',
          'No expone campos técnicos internos como ids historicos, ids de politicas o nombres de propiedades.',
        ].join(' '),
        parameters: [
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
          { name: 'loanId', in: 'query', schema: { type: 'integer' } },
          { name: 'creditId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Archivo Excel de créditos' } },
      },
    },
    '/reports/dashboard/excel': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar dashboard ejecutivo a Excel',
        description: 'Genera hojas operativas en español para resumen, evolución y actividad reciente del dashboard.',
        responses: { 200: { description: 'Archivo Excel del dashboard' } },
      },
    },
    '/reports/cash-flow/monthly': {
      get: {
        tags: ['Reports'],
        summary: 'Consultar control financiero mensual',
        description: 'Devuelve el cuadre mensual de caja: entradas por cuotas completadas, salidas por préstamos desembolsados, caja disponible acumulada, ganancia cobrada y pérdidas en riesgo.',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Resumen financiero mensual e historial por mes' } },
      },
    },
    '/reports/cash-flow/daily': {
      get: {
        tags: ['Reports'],
        summary: 'Consultar control financiero diario',
        description: 'Devuelve el cuadre diario de caja para una fecha o rango: entradas por cuotas, salidas por préstamos, pagos a socios, gastos operativos, caja disponible y pérdidas en riesgo.',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Resumen financiero diario e historial por día' } },
      },
    },
    '/reports/cash-flow/monthly/excel': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar flujo de caja mensual a Excel',
        description: 'Genera un Excel con hojas Resumen Financiero e Historial Mensual. Los totales coinciden con préstamos y pagos completados registrados en base de datos.',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Archivo Excel de flujo de caja mensual' } },
      },
    },
    '/reports/cash-flow/monthly/pdf': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar flujo de caja mensual a PDF',
        description: 'Genera un PDF ejecutivo con entradas, salidas, caja disponible, ganancia cobrada, pérdidas en riesgo y resultado neto del año seleccionado.',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Archivo PDF de flujo de caja mensual' } },
      },
    },
    '/reports/credit-history/monthly': {
      get: {
        tags: ['Reports'],
        summary: 'Consultar historial mensual avanzado de créditos',
        description: [
          'Devuelve un reporte mensual de auditoría financiera con créditos creados, cuotas recibidas, capital recuperado, intereses cobrados, créditos vencidos, pérdidas/riesgo, ganancias y caja disponible.',
          'Los datos salen de préstamos y pagos completados registrados en base de datos.',
        ].join(' '),
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}$' }, description: 'Mes exacto en formato YYYY-MM.' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Estado de crédito o recuperación. Acepta varios valores separados por coma.' },
          { name: 'customerId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filtra por cliente administrativo.' },
          { name: 'loanId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filtra por crédito específico.' },
        ],
        responses: { 200: { description: 'Historial mensual avanzado de créditos' } },
      },
    },
    '/reports/credit-history/monthly/export': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar historial mensual avanzado de créditos',
        description: [
          'Exporta el historial mensual avanzado en Excel o PDF para auditoría financiera real.',
          'El Excel incluye Resumen Auditoría, Historial Mensual, Detalle Créditos y Detalle Pagos.',
          'CSV no forma parte de este contrato.',
        ].join(' '),
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'pdf'], default: 'xlsx' } },
          { name: 'month', in: 'query', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}$' }, description: 'Mes exacto en formato YYYY-MM.' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Estado de crédito o recuperación. Acepta varios valores separados por coma.' },
          { name: 'customerId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filtra por cliente administrativo.' },
          { name: 'loanId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filtra por crédito específico.' },
        ],
        responses: { 200: { description: 'Archivo Excel o PDF de historial mensual de créditos' } },
      },
    },
    '/reports/payouts/excel': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar pagos a Excel desde backend',
        description: 'Genera un reporte operativo de pagos con columnas en español, formatos monetarios y filtros canónicos.',
        parameters: [
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
          { name: 'loanId', in: 'query', schema: { type: 'integer' } },
          { name: 'creditId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'paymentType', in: 'query', schema: { type: 'string', enum: ['installment', 'partial', 'capital', 'payoff'] } },
        ],
        responses: { 200: { description: 'Archivo Excel de pagos' } },
      },
    },
    '/reports/payouts/export': {
      get: {
        tags: ['Reports'],
        summary: 'Exportar pagos a Excel o PDF desde backend',
        description: 'Genera un reporte operativo de pagos y movimientos en Excel o PDF usando los mismos filtros canonicos.',
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'pdf'], default: 'xlsx' } },
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
          { name: 'loanId', in: 'query', schema: { type: 'integer' } },
          { name: 'creditId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'paymentType', in: 'query', schema: { type: 'string', enum: ['installment', 'partial', 'capital', 'payoff'] } },
        ],
        responses: { 200: { description: 'Archivo de pagos en el formato solicitado' } },
      },
    },
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'Listar notificaciones', responses: { 200: { description: 'Notificaciones visibles' } } },
    },
    '/audits': {
      get: {
        tags: ['Audits'],
        summary: 'Listar auditoría operacional',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'integer' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'module', in: 'query', schema: { type: 'string' } },
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'ip', in: 'query', schema: { type: 'string' }, description: 'Filtra eventos originados desde una IP completa o parcial.' },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: { 200: { description: 'Eventos auditables con servicio HTTP consumido en metadata.http cuando aplica' } },
      },
    },
  },
});

module.exports = {
  buildOpenApiDocument,
};
