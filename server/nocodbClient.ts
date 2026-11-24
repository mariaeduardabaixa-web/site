export type NocoTableKey =
  | 'clientes'
  | 'enderecos'
  | 'produtos'
  | 'pedidos'
  | 'personalizacoes'
  | 'pagamentos';

export interface NocoColumnMeta {
  id: string;
  title: string;
  column_name: string | null;
  uidt: string;
  pk?: boolean;
  rq?: boolean;
  system?: boolean | number;
  colOptions?: {
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
    type?: string;
    options?: Array<{ title?: string }>;
  };
}

export interface NocoTableMeta {
  id: string;
  title: string;
  table_name: string;
  columns: NocoColumnMeta[];
  pkField: string;
  fetchedAt: number;
}

export interface NocoConfigStatus {
  configured: boolean;
  missingVars: string[];
  baseIdPresent: boolean;
}

const ENV_TABLE_MAP: Record<NocoTableKey, string> = {
  clientes: 'NOCODB_TABLE_CLIENTES',
  enderecos: 'NOCODB_TABLE_ENDERECOS',
  produtos: 'NOCODB_TABLE_PRODUTOS',
  pedidos: 'NOCODB_TABLE_PEDIDOS',
  personalizacoes: 'NOCODB_TABLE_PERSONALIZACOES',
  pagamentos: 'NOCODB_TABLE_PAGAMENTOS',
};

const REQUIRED_ENV_VARS = [
  'NOCODB_BASE_URL',
  'NOCODB_BASE_ID',
  'NOCODB_API_TOKEN',
  ...Object.values(ENV_TABLE_MAP),
];

const READONLY_UIDTS = new Set([
  'ID',
  'AutoNumber',
  'Formula',
  'Rollup',
  'Lookup',
  'Count',
  'CreatedTime',
  'LastModifiedTime',
  'CreatedBy',
  'LastModifiedBy',
  'QrCode',
  'Barcode',
  'Button',
  'LinkToAnotherRecord',
  'Links',
]);

const NUMERIC_UIDTS = new Set([
  'Number',
  'Decimal',
  'Currency',
  'Float',
  'Percent',
  'Rating',
  'Year',
  'Duration',
]);

const META_TTL_MS = 600_000; // 10 minutes for schema/table metadata
const MIN_REQUEST_GAP_MS = 180; // ~5.5 req/sec ceiling
const MAX_RETRY_ATTEMPTS = 4;

const metaCache = new Map<string, NocoTableMeta>();
const metaInFlight = new Map<string, Promise<NocoTableMeta>>();
const resolvedTableIdCache = new Map<NocoTableKey, string>();
let baseTablesCache: {
  fetchedAt: number;
  tables: Array<{ id: string; title: string; table_name: string }>;
} | null = null;
let baseTablesInFlight: Promise<
  Array<{ id: string; title: string; table_name: string }>
> | null = null;
let viewIndexPromise: Promise<Map<string, string>> | null = null;

// Global FIFO request queue (maxConcurrency = 1) + shared cooldown window
let queueTail: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;
let globalCooldownUntil = 0;

export interface NocoAttachmentItem {
  url?: string;
  signedUrl?: string;
  signedPath?: string;
  path?: string;
  title?: string;
  mimetype?: string;
  size?: number;
  [key: string]: unknown;
}

const ATTACHMENT_CACHE_TTL_MS = 600_000;
const attachmentJsonCache = new Map<
  string,
  { fetchedAt: number; data: unknown }
>();

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueueNocoTask<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const now = Date.now();
    const waitUntil = Math.max(
      lastRequestStartedAt + MIN_REQUEST_GAP_MS,
      globalCooldownUntil
    );
    if (waitUntil > now) {
      await sleep(waitUntil - now);
    }
    lastRequestStartedAt = Date.now();
    return task();
  };

  const resultPromise = queueTail.then(run, run);
  queueTail = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return 0;
  const trimmed = headerValue.trim();
  if (!trimmed) return 0;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(30_000, Math.max(500, Math.round(seconds * 1000)));
    }
  }

  const targetMs = Date.parse(trimmed);
  if (!Number.isNaN(targetMs)) {
    const delta = targetMs - Date.now();
    if (delta > 0) {
      return Math.min(30_000, Math.max(500, delta));
    }
  }

  return 0;
}

async function listBaseTables(): Promise<
  Array<{ id: string; title: string; table_name: string }>
> {
  if (baseTablesCache && Date.now() - baseTablesCache.fetchedAt < META_TTL_MS) {
    return baseTablesCache.tables;
  }
  if (baseTablesInFlight) {
    return baseTablesInFlight;
  }

  baseTablesInFlight = (async () => {
    try {
      const { baseId } = getValidatedBaseConfig();
      const res = await nocoRequest<{
        list?: Array<{ id: string; title: string; table_name: string }>;
      }>(`/api/v2/meta/bases/${encodeURIComponent(baseId)}/tables`);
      const tables = Array.isArray(res?.list) ? res.list : [];
      baseTablesCache = { fetchedAt: Date.now(), tables };
      return tables;
    } finally {
      baseTablesInFlight = null;
    }
  })();

  return baseTablesInFlight;
}

async function getViewToTableMap(): Promise<Map<string, string>> {
  if (viewIndexPromise) return viewIndexPromise;

  viewIndexPromise = (async () => {
    const map = new Map<string, string>();
    const tables = await listBaseTables();
    for (const tbl of tables) {
      try {
        const metaRes = await nocoRequest<{
          id: string;
          title: string;
          table_name: string;
          columns?: NocoColumnMeta[];
          views?: Array<{ id: string }>;
        }>(`/api/v2/meta/tables/${encodeURIComponent(tbl.id)}`);

        if (Array.isArray(metaRes?.columns)) {
          const pkCol =
            metaRes.columns.find((c) => Boolean(c.pk)) ??
            metaRes.columns.find(
              (c) => c.title === 'Id' || c.column_name === 'id'
            );
          metaCache.set(tbl.id, {
            id: metaRes.id || tbl.id,
            title: metaRes.title || tbl.title,
            table_name: metaRes.table_name || tbl.table_name,
            columns: metaRes.columns,
            pkField: pkCol?.title || pkCol?.column_name || 'Id',
            fetchedAt: Date.now(),
          });
        }

        if (Array.isArray(metaRes?.views) && metaRes.views.length > 0) {
          for (const v of metaRes.views) {
            if (v?.id) map.set(v.id, tbl.id);
          }
        } else {
          const viewsRes = await nocoRequest<{
            list?: Array<{ id: string }>;
          }>(`/api/v2/meta/tables/${encodeURIComponent(tbl.id)}/views`);
          if (Array.isArray(viewsRes?.list)) {
            for (const v of viewsRes.list) {
              if (v?.id) map.set(v.id, tbl.id);
            }
          }
        }
        await sleep(60);
      } catch {
        // Continue resolving other tables
      }
    }
    return map;
  })().catch((err) => {
    viewIndexPromise = null;
    throw err;
  });

  return viewIndexPromise;
}

const SEMANTIC_TABLE_NAME_FALLBACKS: Record<NocoTableKey, string[]> = {
  clientes: ['clientes', 'cliente'],
  enderecos: ['enderecos', 'endereco'],
  produtos: ['produtos', 'produto'],
  pedidos: ['pedidosclientes', 'pedidos', 'pedido'],
  personalizacoes: ['personalizacoes', 'personalizacao'],
  pagamentos: ['pagamentos', 'pagamento'],
};

export async function resolveTableId(tableKey: NocoTableKey): Promise<string> {
  const status = getNocoConfigStatus();
  if (!status.configured) {
    throw new NocoNotConfiguredError(status.missingVars);
  }
  const cached = resolvedTableIdCache.get(tableKey);
  if (cached) return cached;

  const envName = ENV_TABLE_MAP[tableKey];
  const rawValue = String(process.env[envName]).trim();

  // Standard NocoDB table ID starts with m...
  if (/^m[a-z0-9]{6,}$/i.test(rawValue)) {
    resolvedTableIdCache.set(tableKey, rawValue);
    return rawValue;
  }

  try {
    const tables = await listBaseTables();

    // 1. Direct table ID or title match
    const normRaw = normalizeColKey(rawValue);
    const directTableMatch = tables.find(
      (t) =>
        t.id === rawValue ||
        normalizeColKey(t.title) === normRaw ||
        normalizeColKey(t.table_name) === normRaw
    );
    if (directTableMatch) {
      resolvedTableIdCache.set(tableKey, directTableMatch.id);
      return directTableMatch.id;
    }

    // 2. Semantic table-title match BEFORE iterating views (zero extra requests when matched!)
    const semanticNames = SEMANTIC_TABLE_NAME_FALLBACKS[tableKey];
    const semanticMatch = tables.find((t) => {
      const nt = normalizeColKey(t.title);
      const ntn = normalizeColKey(t.table_name);
      return semanticNames.some((s) => nt === s || ntn === s);
    });

    // 3. If a View ID (vw...) was supplied, verify via shared single-flight view map
    if (/^vw[a-z0-9]{6,}$/i.test(rawValue)) {
      const viewMap = await getViewToTableMap();
      const ownerTableId = viewMap.get(rawValue);
      if (ownerTableId) {
        resolvedTableIdCache.set(tableKey, ownerTableId);
        return ownerTableId;
      }
    }

    if (semanticMatch) {
      resolvedTableIdCache.set(tableKey, semanticMatch.id);
      return semanticMatch.id;
    }
  } catch {
    // Fallback to rawValue if base metadata listing fails
  }

  return rawValue;
}

export class NocoNotConfiguredError extends Error {
  public readonly missingVars: string[];
  constructor(missingVars: string[]) {
    super(
      `Integração NocoDB não configurada neste ambiente. Variáveis ausentes: ${missingVars.join(', ')}`
    );
    this.name = 'NocoNotConfiguredError';
    this.missingVars = missingVars;
  }
}

export class NocoApiError extends Error {
  public readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'NocoApiError';
    this.status = status;
  }
}

export function getNocoConfigStatus(): NocoConfigStatus {
  const missingVars = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name] || !String(process.env[name]).trim()
  );
  return {
    configured: missingVars.length === 0,
    missingVars,
    baseIdPresent: Boolean(process.env.NOCODB_BASE_ID?.trim()),
  };
}

function getValidatedBaseConfig(): {
  baseUrl: string;
  baseId: string;
  token: string;
} {
  const status = getNocoConfigStatus();
  if (!status.configured) {
    throw new NocoNotConfiguredError(status.missingVars);
  }

  const rawUrl = String(process.env.NOCODB_BASE_URL).trim();
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new NocoApiError('NOCODB_BASE_URL inválida.', 500);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new NocoApiError(
      'NOCODB_BASE_URL deve utilizar protocolo http ou https.',
      500
    );
  }

  return {
    baseUrl: parsed.toString().replace(/\/+$/, ''),
    baseId: String(process.env.NOCODB_BASE_ID).trim(),
    token: String(process.env.NOCODB_API_TOKEN).trim(),
  };
}

async function nocoRequest<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0,
  allowRetryOverride?: boolean
): Promise<T> {
  const { baseUrl, token } = getValidatedBaseConfig();
  const targetUrl = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (init.method ?? 'GET').toUpperCase();
  // Never auto-retry POST creations to prevent duplicate records in NocoDB
  const allowRetry = allowRetryOverride ?? method === 'GET';

  const response = await enqueueNocoTask(async () => {
    const headers = new Headers(init.headers);
    headers.set('xc-token', token);
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(targetUrl, {
      ...init,
      headers,
    });
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const expBackoffMs =
      600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
    const waitMs = Math.max(retryAfterMs, expBackoffMs);
    globalCooldownUntil = Math.max(globalCooldownUntil, Date.now() + waitMs);

    if (allowRetry && attempt < MAX_RETRY_ATTEMPTS) {
      await sleep(waitMs);
      return nocoRequest<T>(path, init, attempt + 1, allowRetryOverride);
    }

    throw new NocoApiError(
      'O servidor NocoDB atingiu o limite temporário de requisições (HTTP 429). Aguarde alguns instantes e tente novamente.',
      429
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'msg' in data
        ? String((data as { msg: unknown }).msg)
        : typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Erro HTTP ${response.status} ao comunicar com NocoDB`;
    throw new NocoApiError(detail, response.status >= 500 ? 502 : response.status);
  }

  return data as T;
}

export function normalizeColKey(value?: string | null): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function getTableMeta(
  tableKey: NocoTableKey,
  forceRefresh = false
): Promise<NocoTableMeta> {
  const tableId = await resolveTableId(tableKey);
  const cached = metaCache.get(tableId);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < META_TTL_MS) {
    return cached;
  }

  if (!forceRefresh) {
    const inFlight = metaInFlight.get(tableId);
    if (inFlight) return inFlight;
  }

  const fetchPromise = (async () => {
    try {
      const raw = await nocoRequest<{
        id: string;
        title: string;
        table_name: string;
        columns?: NocoColumnMeta[];
      }>(`/api/v2/meta/tables/${encodeURIComponent(tableId)}`);

      const columns = Array.isArray(raw?.columns) ? raw.columns : [];
      const pkCol =
        columns.find((c) => Boolean(c.pk)) ??
        columns.find((c) => c.title === 'Id' || c.column_name === 'id');

      const meta: NocoTableMeta = {
        id: raw.id || tableId,
        title: raw.title || tableKey,
        table_name: raw.table_name || raw.title || tableKey,
        columns,
        pkField: pkCol?.title || pkCol?.column_name || 'Id',
        fetchedAt: Date.now(),
      };

      metaCache.set(tableId, meta);
      return meta;
    } finally {
      metaInFlight.delete(tableId);
    }
  })();

  metaInFlight.set(tableId, fetchPromise);
  return fetchPromise;
}

export function findColumnByAliases(
  meta: NocoTableMeta,
  aliases: string[],
  writableOnly = false
): NocoColumnMeta | null {
  const normalizedAliases = aliases.map(normalizeColKey).filter(Boolean);
  const candidates = writableOnly
    ? meta.columns.filter(
        (c) => !c.pk && !c.system && !READONLY_UIDTS.has(c.uidt)
      )
    : meta.columns;

  for (const alias of normalizedAliases) {
    const exact = candidates.find(
      (c) =>
        normalizeColKey(c.title) === alias ||
        normalizeColKey(c.column_name) === alias
    );
    if (exact) return exact;
  }

  // Partial contains fallback only for longer aliases (>= 5 chars)
  for (const alias of normalizedAliases) {
    if (alias.length < 5) continue;
    const partial = candidates.find((c) => {
      const t = normalizeColKey(c.title);
      const cn = normalizeColKey(c.column_name);
      return (Boolean(t) && t.includes(alias)) || (Boolean(cn) && cn.includes(alias));
    });
    if (partial) return partial;
  }

  return null;
}

export function findLinkColumn(
  meta: NocoTableMeta,
  relatedTableId: string,
  aliasHints: string[] = []
): NocoColumnMeta | null {
  const linkCols = meta.columns.filter(
    (c) => c.uidt === 'LinkToAnotherRecord' || c.uidt === 'Links'
  );
  const byTarget = linkCols.find(
    (c) => c.colOptions?.fk_related_model_id === relatedTableId
  );
  if (byTarget) return byTarget;

  if (aliasHints.length > 0) {
    const normalized = aliasHints.map(normalizeColKey).filter(Boolean);
    const byName = linkCols.find((c) => {
      const t = normalizeColKey(c.title);
      const cn = normalizeColKey(c.column_name);
      return normalized.some(
        (a) => (Boolean(t) && t.includes(a)) || (Boolean(cn) && cn.includes(a))
      );
    });
    if (byName) return byName;
  }

  return null;
}

export function coerceValueForColumn(
  col: NocoColumnMeta,
  value: unknown
): unknown {
  if (value === undefined || value === null) return undefined;

  if (col.uidt === 'Attachment') {
    if (Array.isArray(value)) {
      const valid = value.filter(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          ('url' in item ||
            'path' in item ||
            'signedUrl' in item ||
            'signedPath' in item ||
            'title' in item)
      );
      return valid.length > 0 ? valid : undefined;
    }
    return undefined;
  }

  if (NUMERIC_UIDTS.has(col.uidt)) {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  if (col.uidt === 'Checkbox') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'sim';
    }
    return Boolean(value);
  }

  if (col.uidt === 'Date') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }

  if (col.uidt === 'DateTime') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  if (col.uidt === 'JSON') {
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return { value: String(value) };
    }
  }

  const strVal =
    typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (col.uidt === 'SingleLineText' || col.uidt === 'SingleSelect') {
    // Avoid exceeding VARCHAR(255) on SingleLineText columns
    if (col.uidt === 'SingleLineText' && strVal.length > 250) {
      return strVal.slice(0, 250);
    }
    if (
      col.uidt === 'SingleSelect' &&
      Array.isArray(col.colOptions?.options) &&
      col.colOptions.options.length > 0
    ) {
      const targetNorm = normalizeColKey(strVal);
      const matchedOpt = col.colOptions.options.find(
        (opt) => opt.title && normalizeColKey(opt.title) === targetNorm
      );
      if (!matchedOpt) return undefined;
      return matchedOpt.title;
    }
    return strVal;
  }

  return strVal;
}

export interface FieldMappingSpec {
  aliases: string[];
  value: unknown;
}

export function mapSpecToRecordPayload(
  meta: NocoTableMeta,
  specs: FieldMappingSpec[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const spec of specs) {
    if (spec.value === undefined || spec.value === null) continue;
    const col = findColumnByAliases(meta, spec.aliases, true);
    if (!col) continue;
    const coerced = coerceValueForColumn(col, spec.value);
    if (coerced !== undefined) {
      payload[col.title] = coerced;
    }
  }
  return payload;
}

export function readField(
  record: Record<string, unknown>,
  meta: NocoTableMeta,
  aliases: string[]
): unknown {
  if (!record || typeof record !== 'object') return undefined;
  const col = findColumnByAliases(meta, aliases, false);
  if (col) {
    if (col.title && col.title in record && record[col.title] !== undefined) {
      return record[col.title];
    }
    if (
      col.column_name &&
      col.column_name in record &&
      record[col.column_name] !== undefined
    ) {
      return record[col.column_name];
    }
  }

  const normalizedAliases = aliases.map(normalizeColKey).filter(Boolean);
  for (const [k, v] of Object.entries(record)) {
    if (normalizedAliases.includes(normalizeColKey(k))) {
      return v;
    }
  }
  return undefined;
}

export function getRecordPk(
  record: Record<string, unknown>,
  meta: NocoTableMeta
): string {
  if (!record || typeof record !== 'object') return '';
  const val = record[meta.pkField] ?? record.Id ?? record.id;
  return val !== undefined && val !== null ? String(val) : '';
}

export function escapeNocoFilterValue(raw: string): string {
  // Neutralize NocoDB where-syntax delimiters `(`, `)`, `,`, `~`
  return raw.replace(/[~(),]/g, '').trim();
}

export async function listRecords(
  tableKey: NocoTableKey,
  options: { limit?: number; offset?: number; where?: string; sort?: string } = {}
): Promise<{ meta: NocoTableMeta; list: Array<Record<string, unknown>> }> {
  const meta = await getTableMeta(tableKey);
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 100));
  if (options.offset !== undefined) {
    params.set('offset', String(options.offset));
  }
  if (options.where) {
    params.set('where', options.where);
  }
  if (options.sort) {
    params.set('sort', options.sort);
  }

  const res = await nocoRequest<{
    list?: Array<Record<string, unknown>>;
  }>(`/api/v2/tables/${encodeURIComponent(meta.id)}/records?${params.toString()}`);

  return {
    meta,
    list: Array.isArray(res?.list) ? res.list : [],
  };
}

export async function findRecordByAliases(
  tableKey: NocoTableKey,
  columnAliases: string[],
  value: string,
  caseInsensitive = true
): Promise<{
  meta: NocoTableMeta;
  record: Record<string, unknown> | null;
}> {
  const meta = await getTableMeta(tableKey);
  const col = findColumnByAliases(meta, columnAliases, false);
  const target = caseInsensitive ? value.trim().toLowerCase() : value.trim();

  if (col) {
    const safeVal = escapeNocoFilterValue(value);
    if (safeVal) {
      try {
        const { list } = await listRecords(tableKey, {
          limit: 25,
          where: `(${col.title},eq,${safeVal})`,
        });
        const exact =
          list.find((row) => {
            const cell =
              row[col.title] ??
              (col.column_name ? row[col.column_name] : undefined);
            if (cell === null || cell === undefined) return false;
            const str = String(cell).trim();
            return caseInsensitive
              ? str.toLowerCase() === target
              : str === target;
          }) ?? null;

        // If filter value wasn't altered by escaping and the filter succeeded,
        // trust the filtered result instead of doing a redundant 200-row table scan.
        if (exact || safeVal === value.trim()) {
          return { meta, record: exact };
        }
      } catch {
        // Fallback below if filter column does not support eq directly
      }
    }
  }

  // Fallback paginated scan up to 200 rows with exact JS check
  const { list } = await listRecords(tableKey, { limit: 200 });
  const match =
    list.find((row) => {
      const val = readField(row, meta, columnAliases);
      if (val === null || val === undefined) return false;
      const str = String(val).trim();
      return caseInsensitive ? str.toLowerCase() === target : str === target;
    }) ?? null;

  return { meta, record: match };
}

export async function createRecord(
  tableKey: NocoTableKey,
  specs: FieldMappingSpec[],
  rawFallback?: Record<string, unknown>
): Promise<{ meta: NocoTableMeta; record: Record<string, unknown> }> {
  const meta = await getTableMeta(tableKey);
  const payload = mapSpecToRecordPayload(meta, specs);

  if (Object.keys(payload).length === 0 && rawFallback) {
    // Only pick keys that actually exist in table meta
    for (const [k, v] of Object.entries(rawFallback)) {
      const col = findColumnByAliases(meta, [k], true);
      if (col) {
        const coerced = coerceValueForColumn(col, v);
        if (coerced !== undefined) payload[col.title] = coerced;
      }
    }
  }

  const created = await nocoRequest<Record<string, unknown>>(
    `/api/v2/tables/${encodeURIComponent(meta.id)}/records`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    0,
    false // Never auto-retry POST record creations
  );

  return { meta, record: { ...payload, ...created } };
}

export async function updateRecord(
  tableKey: NocoTableKey,
  recordId: string,
  specs: FieldMappingSpec[]
): Promise<{ meta: NocoTableMeta; record: Record<string, unknown> }> {
  const meta = await getTableMeta(tableKey);
  const payload = mapSpecToRecordPayload(meta, specs);
  if (Object.keys(payload).length === 0) {
    return {
      meta,
      record: {
        [meta.pkField]: /^\d+$/.test(recordId) ? Number(recordId) : recordId,
      },
    };
  }

  const pkTyped = /^\d+$/.test(recordId) ? Number(recordId) : recordId;
  const body = {
    [meta.pkField]: pkTyped,
    ...payload,
  };

  await nocoRequest<unknown>(
    `/api/v2/tables/${encodeURIComponent(meta.id)}/records`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    0,
    false
  );

  return { meta, record: { [meta.pkField]: pkTyped, ...payload } };
}

export async function deleteRecord(
  tableKey: NocoTableKey,
  recordId: string
): Promise<void> {
  const meta = await getTableMeta(tableKey);
  const pkVal = /^\d+$/.test(recordId) ? Number(recordId) : recordId;
  await nocoRequest<unknown>(
    `/api/v2/tables/${encodeURIComponent(meta.id)}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ [meta.pkField]: pkVal }),
    }
  );
}

export async function tryLinkRecords(params: {
  sourceTable: NocoTableKey;
  sourceRecordId: string;
  targetTable: NocoTableKey;
  targetRecordId: string;
  linkAliasHints?: string[];
}): Promise<boolean> {
  try {
    const [srcMeta, tgtMeta] = await Promise.all([
      getTableMeta(params.sourceTable),
      getTableMeta(params.targetTable),
    ]);
    const linkCol = findLinkColumn(
      srcMeta,
      tgtMeta.id,
      params.linkAliasHints ?? []
    );
    if (!linkCol) return false;

    const targetPk = /^\d+$/.test(params.targetRecordId)
      ? Number(params.targetRecordId)
      : params.targetRecordId;

    await nocoRequest<unknown>(
      `/api/v2/tables/${encodeURIComponent(srcMeta.id)}/links/${encodeURIComponent(linkCol.id)}/records/${encodeURIComponent(params.sourceRecordId)}`,
      {
        method: 'POST',
        body: JSON.stringify([{ [tgtMeta.pkField]: targetPk }]),
      }
    );
    return true;
  } catch {
    return false;
  }
}

export async function listLinkedRecords(params: {
  sourceTable: NocoTableKey;
  sourceRecordId: string;
  targetTable: NocoTableKey;
  linkAliasHints?: string[];
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  try {
    const [srcMeta, tgtMeta] = await Promise.all([
      getTableMeta(params.sourceTable),
      getTableMeta(params.targetTable),
    ]);
    const linkCol = findLinkColumn(
      srcMeta,
      tgtMeta.id,
      params.linkAliasHints ?? []
    );
    if (!linkCol) return [];

    const limit = params.limit ?? 100;
    const res = await nocoRequest<{
      list?: Array<Record<string, unknown>>;
    }>(
      `/api/v2/tables/${encodeURIComponent(srcMeta.id)}/links/${encodeURIComponent(linkCol.id)}/records/${encodeURIComponent(params.sourceRecordId)}?limit=${limit}`
    );
    return Array.isArray(res?.list) ? res.list : [];
  } catch (err) {
    if (
      err instanceof NocoNotConfiguredError ||
      (err instanceof NocoApiError && err.status === 429)
    ) {
      throw err;
    }
    return [];
  }
}

export async function getRecordByPk(
  tableKey: NocoTableKey,
  recordId: string
): Promise<{ meta: NocoTableMeta; record: Record<string, unknown> | null }> {
  const meta = await getTableMeta(tableKey);
  const safeId = escapeNocoFilterValue(recordId);
  if (!safeId) return { meta, record: null };

  try {
    const record = await nocoRequest<Record<string, unknown>>(
      `/api/v2/tables/${encodeURIComponent(meta.id)}/records/${encodeURIComponent(safeId)}`
    );
    if (record && typeof record === 'object' && getRecordPk(record, meta)) {
      return { meta, record };
    }
  } catch (err) {
    if (
      err instanceof NocoNotConfiguredError ||
      (err instanceof NocoApiError && err.status === 429)
    ) {
      throw err;
    }
  }

  const { list } = await listRecords(tableKey, {
    limit: 5,
    where: `(${meta.pkField},eq,${safeId})`,
  });
  return { meta, record: list[0] ?? null };
}

export async function fetchFullLinkedRecords(params: {
  sourceTable: NocoTableKey;
  sourceRecordId: string;
  targetTable: NocoTableKey;
  linkAliasHints?: string[];
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  const stubs = await listLinkedRecords(params);
  if (stubs.length === 0) return [];

  const tgtMeta = await getTableMeta(params.targetTable);
  const pks = Array.from(
    new Set(
      stubs
        .map((row) => escapeNocoFilterValue(getRecordPk(row, tgtMeta)))
        .filter(Boolean)
    )
  );
  if (pks.length === 0) return stubs;

  if (pks.length === 1) {
    const full = await getRecordByPk(params.targetTable, pks[0]);
    return full.record ? [full.record] : stubs;
  }

  try {
    const { list } = await listRecords(params.targetTable, {
      limit: Math.max(pks.length, params.limit ?? 100),
      where: `(${tgtMeta.pkField},in,${pks.join(',')})`,
    });
    if (list.length > 0) {
      return list;
    }
  } catch (err) {
    if (
      err instanceof NocoNotConfiguredError ||
      (err instanceof NocoApiError && err.status === 429)
    ) {
      throw err;
    }
  }

  // Fallback sequentially if `in` filter is unsupported on a view/pk
  const results: Array<Record<string, unknown>> = [];
  for (const pk of pks) {
    const full = await getRecordByPk(params.targetTable, pk);
    if (full.record) results.push(full.record);
  }
  return results.length > 0 ? results : stubs;
}

export async function uploadJsonAttachment(
  fileName: string,
  jsonContent: string,
  folderPath = 'inside-ecobag/personalizacoes'
): Promise<NocoAttachmentItem[]> {
  const safeName =
    fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) ||
    'personalizacao-3d.json';

  const form = new FormData();
  const blob = new Blob([jsonContent], { type: 'application/json' });
  form.append('file', blob, safeName);

  const res = await nocoRequest<NocoAttachmentItem[] | NocoAttachmentItem>(
    `/api/v2/storage/upload?path=${encodeURIComponent(folderPath)}`,
    {
      method: 'POST',
      body: form,
    },
    0,
    false // Never auto-retry POST upload
  );

  const items = Array.isArray(res)
    ? res
    : res && typeof res === 'object'
      ? [res]
      : [];

  if (items.length === 0) {
    throw new NocoApiError(
      'O NocoDB não retornou metadados do arquivo JSON enviado.',
      502
    );
  }

  return items;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h === '169.254.169.254' ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function extractFirstAttachment(input: unknown): NocoAttachmentItem | null {
  let candidate = input;
  if (typeof candidate === 'string' && candidate.trim()) {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (Array.isArray(candidate)) {
    candidate = candidate[0];
  }
  if (candidate && typeof candidate === 'object') {
    return candidate as NocoAttachmentItem;
  }
  return null;
}

export async function downloadAttachmentJson<T = unknown>(
  attachmentInput: unknown
): Promise<T | null> {
  const item = extractFirstAttachment(attachmentInput);
  if (!item) return null;

  const { baseUrl, token } = getValidatedBaseConfig();
  const nocoParsed = new URL(baseUrl);

  const cacheKey = String(
    item.path ?? item.url ?? item.signedPath ?? item.title ?? ''
  );
  if (cacheKey) {
    const cached = attachmentJsonCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < ATTACHMENT_CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const rawCandidates = [
    item.signedUrl,
    item.url,
    item.signedPath,
    item.path ? `download/${String(item.path).replace(/^\/+/, '')}` : undefined,
    item.path,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const uniqueUrls: string[] = [];
  for (const raw of rawCandidates) {
    const trimmed = raw.trim();
    const resolved = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;
    if (!uniqueUrls.includes(resolved)) {
      uniqueUrls.push(resolved);
    }
  }

  for (const target of uniqueUrls) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;

    const isSameNocoOrigin = parsed.origin === nocoParsed.origin;
    if (!isSameNocoOrigin && isPrivateOrLocalHostname(parsed.hostname)) {
      continue;
    }

    try {
      const response = await enqueueNocoTask(async () => {
        const headers: Record<string, string> = {};
        if (isSameNocoOrigin) {
          headers['xc-token'] = token;
        }
        return fetch(parsed.toString(), { method: 'GET', headers });
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(
            response.headers.get('retry-after')
          );
          globalCooldownUntil = Math.max(
            globalCooldownUntil,
            Date.now() + Math.max(retryAfterMs, 1000)
          );
        }
        continue;
      }

      const text = await response.text();
      if (!text) continue;
      const json = JSON.parse(text) as T;
      if (cacheKey) {
        attachmentJsonCache.set(cacheKey, { fetchedAt: Date.now(), data: json });
      }
      return json;
    } catch {
      // Try next candidate URL
    }
  }

  return null;
}

export async function inspectAllTables(): Promise<{
  configured: boolean;
  missingVars: string[];
  tables: Record<
    NocoTableKey,
    {
      ok: boolean;
      tableId?: string;
      title?: string;
      columnsCount?: number;
      columns?: Array<{ title: string; columnName: string | null; type: string; pk: boolean }>;
      error?: string;
    }
  >;
}> {
  const status = getNocoConfigStatus();
  const keys: NocoTableKey[] = [
    'clientes',
    'enderecos',
    'produtos',
    'pedidos',
    'personalizacoes',
    'pagamentos',
  ];

  const tables = {} as Record<
    NocoTableKey,
    {
      ok: boolean;
      tableId?: string;
      title?: string;
      columnsCount?: number;
      columns?: Array<{ title: string; columnName: string | null; type: string; pk: boolean }>;
      error?: string;
    }
  >;

  if (!status.configured) {
    for (const k of keys) {
      tables[k] = {
        ok: false,
        error: `Variável ${ENV_TABLE_MAP[k]} ou credenciais NocoDB não configuradas.`,
      };
    }
    return {
      configured: false,
      missingVars: status.missingVars,
      tables,
    };
  }

  for (const key of keys) {
    try {
      const meta = await getTableMeta(key, false);
      tables[key] = {
        ok: true,
        tableId: meta.id,
        title: meta.title,
        columnsCount: meta.columns.length,
        columns: meta.columns.map((c) => ({
          title: c.title,
          columnName: c.column_name,
          type: c.uidt,
          pk: Boolean(c.pk),
          ...(Array.isArray(c.colOptions?.options) && c.colOptions.options.length > 0
            ? {
                options: c.colOptions.options
                  .map((o) => o.title)
                  .filter((t): t is string => Boolean(t)),
              }
            : {}),
        })),
      };
    } catch (err) {
      tables[key] = {
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao ler tabela',
      };
    }
    await sleep(120);
  }

  return {
    configured: true,
    missingVars: [],
    tables,
  };
}
