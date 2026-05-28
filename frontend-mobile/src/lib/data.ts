// ============================================================
// NEXUS — Mock data (Jerson / user_001, datos del brief)
// Port verbatim de app/data.js → módulo ES con export NX.
// ============================================================

// Tipos amplios para no sacrificar fidelidad. La forma de los datos manda.
type Any = any;

interface NXShape {
  [key: string]: Any;
  fmtCOP: (n: number) => string;
}

const NX = {} as NXShape;

NX.user = {
  name: 'Jerson Mendoza',
  first: 'Jerson',
  email: 'jersonmendoza@eyesa.com.co',
  plan: 'Pro',
  org: 'J4 Smart Solutions',
  locale: 'es-CO',
  tz: 'America/Bogotá',
};

NX.home = {
  greeting: 'Buenas tardes, Jerson.',
  summary: 'Tienes 3 borradores financieros y 2 tareas que vencen hoy.',
  suggestions: ['Revisar borradores', '¿Qué tengo hoy?', 'Resumen de la semana'],
};

// ---- Finanzas ----
NX.finance = {
  balanceMonth: 4862400,
  currency: 'COP',
  vsPrev: 12,
  income: 7340000,
  expense: 2477600,
  weekly: [
    { d: 'Lun', in: 0, out: 184000 },
    { d: 'Mar', in: 1200000, out: 420000 },
    { d: 'Mié', in: 0, out: 96500 },
    { d: 'Jue', in: 0, out: 612000 },
    { d: 'Vie', in: 4100000, out: 318000 },
    { d: 'Sáb', in: 0, out: 540100 },
    { d: 'Dom', in: 0, out: 207000 },
  ],
  topCategories: [
    { name: 'Alimentación', amount: 842000, pct: 34, icon: 'receipt', color: '#7C5CFF' },
    { name: 'Transporte', amount: 468000, pct: 19, icon: 'credit-card', color: '#3B82F6' },
    { name: 'Suscripciones', amount: 312000, pct: 13, icon: 'refresh-cw', color: '#34D399' },
    { name: 'Salud', amount: 240000, pct: 10, icon: 'shield', color: '#FBBF24' },
    { name: 'Otros', amount: 615600, pct: 24, icon: 'more-horizontal', color: '#6A6A7C' },
  ],
  upcoming: [
    { name: 'Netflix', amount: 44900, date: '2 jun', icon: 'play' },
    { name: 'Arriendo oficina', amount: 1850000, date: '5 jun', icon: 'folder' },
    { name: 'Plan celular Claro', amount: 89900, date: '8 jun', icon: 'credit-card' },
  ],
};

NX.drafts = [
  {
    id: 'tx_01', tipo: 'Egreso', comercio: 'Rappi', categoria: 'Alimentación',
    monto: 38500, fecha: 'Hoy, 13:42', confianza: 96, canal: 'Gmail', icon: 'receipt', color: '#7C5CFF',
    evidence: { tipo: 'Gmail', from: 'no-reply@rappi.com', subject: 'Tu pedido de Rappi fue confirmado',
      snippet: 'Total del pedido: $38.500 COP · Pago con tarjeta terminada en 4471 · 28 may 2026 13:42' },
  },
  {
    id: 'tx_02', tipo: 'Egreso', comercio: 'Davivienda — PSE', categoria: 'Servicios',
    monto: 184000, fecha: 'Hoy, 09:15', confianza: 88, canal: 'Gmail', icon: 'credit-card', color: '#3B82F6',
    evidence: { tipo: 'Gmail', from: 'alertas@davivienda.com', subject: 'Notificación de transacción',
      snippet: 'Pago PSE por $184.000 a EPM Energía. Fecha 28/05/2026 09:15. Saldo disponible actualizado.' },
  },
  {
    id: 'tx_03', tipo: 'Ingreso', comercio: 'Transferencia — Cliente Eyesa', categoria: 'Ingresos',
    monto: 4100000, fecha: 'Ayer, 16:30', confianza: 73, canal: 'OCR', icon: 'arrow-down-circle', color: '#22C55E',
    evidence: { tipo: 'OCR', from: 'Comprobante.pdf', subject: 'Comprobante de transferencia Bancolombia',
      snippet: 'Transferencia recibida $4.100.000 · Origen: EYESA S.A.S · Ref: factura 0294 · 27 may 2026' },
  },
];

NX.history = [
  { id: 'h1', tipo: 'Egreso', comercio: 'Éxito Express', categoria: 'Alimentación', monto: 96500, fecha: '27 may', canal: 'Gmail' },
  { id: 'h2', tipo: 'Egreso', comercio: 'Uber', categoria: 'Transporte', monto: 21400, fecha: '27 may', canal: 'Gmail' },
  { id: 'h3', tipo: 'Ingreso', comercio: 'Nómina J4', categoria: 'Ingresos', monto: 3200000, fecha: '25 may', canal: 'Manual' },
  { id: 'h4', tipo: 'Egreso', comercio: 'Spotify', categoria: 'Suscripciones', monto: 16900, fecha: '24 may', canal: 'Sync' },
  { id: 'h5', tipo: 'Egreso', comercio: 'Farmatodo', categoria: 'Salud', monto: 73200, fecha: '23 may', canal: 'OCR' },
  { id: 'h6', tipo: 'Egreso', comercio: 'Terpel', categoria: 'Transporte', monto: 180000, fecha: '22 may', canal: 'Gmail' },
];

// ---- Proyectos ----
NX.projects = [
  {
    id: 'p1', name: 'NEXUS V2.0 — Reforma SaaS', progress: 38, agent: 'Asistente Principal',
    nextTask: 'Cerrar schema multi-tenant', due: '30 may', status: 'Activos', tasksDone: 11, tasksTotal: 29, color: '#7C5CFF',
    tasks: [
      { id: 't1', title: 'Migrar Jerson → user_001', done: true },
      { id: 't2', title: 'Schema multi-tenant (0001–0010)', done: false, due: 'Hoy' },
      { id: 't3', title: 'Helper tenantScoped() + linter', done: false, due: '30 may' },
      { id: 't4', title: 'PWA /m/login + onboarding', done: false, due: '2 jun' },
      { id: 't5', title: 'Suite tests no-leak', done: false },
    ],
  },
  {
    id: 'p2', name: 'Motor Financiero — Gmail + OCR', progress: 12, agent: 'Curador Finanzas',
    nextTask: 'Clasificador IA de correos banco', due: '13 jun', status: 'Activos', tasksDone: 2, tasksTotal: 17, color: '#22C55E',
    tasks: [
      { id: 't1', title: 'GmailSync cron 15min', done: true },
      { id: 't2', title: 'Clasificador tipo/monto/comercio', done: false, due: '13 jun' },
      { id: 't3', title: 'Pipeline OCR tirillas', done: false },
    ],
  },
  {
    id: 'p3', name: 'Vault RAG + Embeddings', progress: 64, agent: 'Curador Vault',
    nextTask: 'HNSW index sobre vault_chunks', due: '8 jun', status: 'Activos', tasksDone: 9, tasksTotal: 14, color: '#3B82F6',
    tasks: [
      { id: 't1', title: 'VaultIndexer + worker /embed', done: true },
      { id: 't2', title: 'HNSW index pgvector', done: false, due: '8 jun' },
    ],
  },
  {
    id: 'p4', name: 'Comercialización MercadoPago', progress: 0, agent: 'Asistente Principal',
    nextTask: 'Checkout + webhook MP', due: '—', status: 'Backlog', tasksDone: 0, tasksTotal: 8, color: '#F59E0B', tasks: [],
  },
];

// ---- Vault ----
NX.vault = {
  rag: {
    query: '¿Qué decidimos sobre el sandboxing de usuarios?',
    answer: 'Se optó por aislamiento lógico: filesystem por usuario en data/users/ más columnas user_id/org_id en todas las tablas. Sin Docker por usuario; Bubblewrap queda como add-on enterprise futuro.',
    citations: [
      { note: 'Decisiones técnicas', folder: 'Conceptos' },
      { note: 'Arquitectura NEXUS V2', folder: 'Conceptos' },
    ],
  },
  notes: [
    { id: 'n1', title: 'Decisiones técnicas', excerpt: 'Sandboxing lógico, pgvector para RAG, routing IA por tier, autocure máx 3 reintentos…', tags: ['arquitectura', 'decisiones'], modified: 'Hoy', backlinks: 7, folder: 'Conceptos' },
    { id: 'n2', title: 'Diario · 28 may', excerpt: 'Cerré la migración de Jerson a user_001. Mañana toca el schema multi-tenant y la suite no-leak…', tags: ['diario'], modified: 'Hoy', backlinks: 2, folder: 'Diarios' },
    { id: 'n3', title: 'Preferencias', excerpt: 'Tono neutro-cercano, respuestas concisas, cero emojis en UI, lucide-react, español LATAM…', tags: ['perfil'], modified: 'Ayer', backlinks: 12, folder: 'Preferencias' },
    { id: 'n4', title: 'Arquitectura NEXUS V2', excerpt: 'Node 22 + Express 5 + Drizzle + PostgreSQL 16. Workers Python solo OCR/Playwright/NER/embeddings…', tags: ['arquitectura'], modified: '2 días', backlinks: 9, folder: 'Conceptos' },
    { id: 'n5', title: 'Aprendizajes repetitivos', excerpt: 'Siempre filtrar por user_id en queries. Validar path traversal. Cifrar tokens AES-256-GCM…', tags: ['aprendizajes'], modified: '3 días', backlinks: 4, folder: 'Preferencias' },
    { id: 'n6', title: 'Token Guard — pipeline', excerpt: 'Regex local → spaCy NER (Pro+, >500 chars) → caché semántico Redis (coseno ≥0.95)…', tags: ['seguridad', 'concepto'], modified: '4 días', backlinks: 3, folder: 'Conceptos' },
  ],
  folders: [
    { name: 'Diarios', count: 42, icon: 'calendar' },
    { name: 'Conceptos', count: 28, icon: 'hash' },
    { name: 'Preferencias', count: 5, icon: 'user' },
    { name: 'Proyectos', count: 11, icon: 'folder' },
  ],
};

// ---- Agentes ----
NX.agents = [
  { id: 'a1', name: 'Asistente Principal', desc: 'Tu agente central. Voz, agenda, tareas y orquestación.', state: 'Running', icon: 'sparkles', color: '#7C5CFF', skills: ['Agenda', 'Tareas', 'Web search', 'Vault read'], runs: 1284 },
  { id: 'a2', name: 'Curador Vault', desc: 'Indexa, conecta y resume tu segundo cerebro.', state: 'Idle', icon: 'book-open', color: '#3B82F6', skills: ['RAG query', 'Embeddings', 'Backlinks'], runs: 342 },
  { id: 'a3', name: 'Curador Finanzas', desc: 'Detecta movimientos en Gmail y arma borradores.', state: 'Running', icon: 'wallet', color: '#22C55E', skills: ['Gmail sync', 'OCR', 'Clasificador'], runs: 876 },
];

NX.skills = [
  { id: 's1', name: 'Gmail Sync', desc: 'Detecta transacciones bancarias cada 15 min.', icon: 'mail', installed: true, mcp: 'gmail-mcp' },
  { id: 's2', name: 'OCR Tirillas', desc: 'Lee facturas y tirillas con Tesseract.', icon: 'camera', installed: true, mcp: 'ocr-worker' },
  { id: 's3', name: 'Web Scraping', desc: 'Playwright headless para monitorear portales.', icon: 'globe', installed: false, pro: true, mcp: 'playwright-mcp' },
  { id: 's4', name: 'Google Calendar', desc: 'Crea y consulta eventos de tu agenda.', icon: 'calendar', installed: true, mcp: 'gcal-mcp' },
  { id: 's5', name: 'RAG Vault', desc: 'Búsqueda semántica sobre tus notas.', icon: 'brain', installed: true, mcp: 'pgvector' },
  { id: 's6', name: 'Token Guard', desc: 'Redacta PII antes de enviarla a la IA.', icon: 'shield-check', installed: true, pro: true, mcp: 'ner-worker' },
];

NX.connections = [
  { id: 'c1', name: 'Gmail', icon: 'mail', status: 'Conectado', detail: 'jersonmendoza@eyesa.com.co', tone: 'success' },
  { id: 'c2', name: 'Google Calendar', icon: 'calendar', status: 'Conectado', detail: '2 calendarios', tone: 'success' },
  { id: 'c3', name: 'Telegram', icon: 'send', status: 'Vinculado', detail: '@jersonm · @NexusJ4Bot', tone: 'success' },
  { id: 'c4', name: 'Meta / Instagram', icon: 'camera', status: 'Expira en 6 días', detail: 'Reautorizar pronto', tone: 'warning' },
  { id: 'c5', name: 'MercadoPago', icon: 'credit-card', status: 'Desconectado', detail: 'Para facturación', tone: 'tertiary' },
];

NX.usage = [
  { label: 'Mensajes IA', used: 4120, total: 5000, unit: '', icon: 'message-circle' },
  { label: 'Voz', used: 1860, total: 3600, unit: 's', icon: 'mic' },
  { label: 'Vault', used: 214, total: 500, unit: 'MB', icon: 'book-open' },
];

NX.redactions = [
  { id: 'r1', type: 'Email', value: 'jer•••@eyesa.com.co', when: 'Hoy 13:40' },
  { id: 'r2', type: 'Tarjeta', value: '•••• 4471', when: 'Hoy 13:42' },
  { id: 'r3', type: 'Teléfono', value: '+57 3•• ••• 22', when: 'Ayer' },
  { id: 'r4', type: 'Cédula', value: '10••••••89', when: '2 días' },
];

NX.notifications = [
  { day: 'Hoy', items: [
    { icon: 'wallet', tone: 'warning', title: '3 borradores esperan tu aprobación', sub: 'Rappi, Davivienda, Transferencia · hace 18 min' },
    { icon: 'check-circle', tone: 'success', title: 'Curador Vault terminó de indexar', sub: '6 notas nuevas · hace 1 h' },
  ]},
  { day: 'Ayer', items: [
    { icon: 'shield-check', tone: 'info', title: 'Token Guard ocultó 4 datos sensibles', sub: 'En 12 prompts a la IA' },
    { icon: 'clock', tone: 'accent', title: 'Rutina "Vigilar precio dólar" se ejecutó', sub: 'Sin cambios detectados' },
  ]},
];

NX.plans = [
  { id: 'free', name: 'Free', price: '$0', period: 'siempre', tagline: 'Para empezar', model: 'OpenCode API',
    features: ['1 agente personal', '500 mensajes IA / mes', 'Vault hasta 100 MB', 'Voz básica', 'Telegram'], cta: 'Plan actual', current: false },
  { id: 'pro', name: 'Pro', price: '$14', period: '/ mes', tagline: 'Trial 14 días', model: 'Claude API', popular: true,
    features: ['Agentes ilimitados', '5.000 mensajes IA / mes', 'Vault 500 MB + RAG', 'Voz ElevenLabs', 'Gmail + OCR finanzas', 'Token Guard PII', 'Scraping headless'], cta: 'Plan actual', current: true },
  { id: 'team', name: 'Team', price: '$39', period: '/ mes', tagline: 'Para equipos', model: 'Claude API + CLI',
    features: ['Todo de Pro', 'Hasta 5 miembros', 'Agentes compartidos', 'Reportes de equipo', 'Cupos combinados', 'Soporte prioritario'], cta: 'Cambiar a Team', current: false },
];

NX.fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

export { NX };
