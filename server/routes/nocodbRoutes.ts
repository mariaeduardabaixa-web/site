import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import {
  createRecord,
  deleteRecord,
  downloadAttachmentJson,
  fetchFullLinkedRecords,
  findLinkColumn,
  findRecordByAliases,
  getNocoConfigStatus,
  getRecordByPk,
  getRecordPk,
  getTableMeta,
  inspectAllTables,
  listLinkedRecords,
  listRecords,
  NocoApiError,
  NocoAttachmentItem,
  NocoNotConfiguredError,
  NocoTableMeta,
  readField,
  tryLinkRecords,
  updateRecord,
  uploadJsonAttachment,
} from '../nocodbClient';

export const nocodbRouter = Router();

const CATALOG_CACHE_TTL_MS = 120_000;
const LOGIN_CACHE_TTL_MS = 15_000;
const ORDERS_CACHE_TTL_MS = 15_000;

interface CatalogPayload {
  sizes: Record<BagSizeId, BagSizeSpec>;
  productIds: Partial<Record<BagSizeId, string>>;
}

let catalogCache: { fetchedAt: number; data: CatalogPayload } | null = null;
let catalogInFlight: Promise<CatalogPayload> | null = null;

type LoginResponsePayload = {
  customer: ReturnType<typeof mapCustomerRow>;
  orders: Awaited<ReturnType<typeof fetchCustomerFullOrders>>;
};

const loginCache = new Map<
  string,
  { fetchedAt: number; payload: LoginResponsePayload }
>();
const loginInFlight = new Map<string, Promise<LoginResponsePayload | null>>();

const ordersCache = new Map<
  string,
  { fetchedAt: number; orders: Awaited<ReturnType<typeof fetchCustomerFullOrders>> }
>();
const ordersInFlight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof fetchCustomerFullOrders>>>
>();

function invalidateCustomerCaches(email?: string, customerId?: string) {
  const normEmail = email ? email.trim().toLowerCase() : '';
  if (normEmail) {
    loginCache.delete(normEmail);
  }
  if (customerId) {
    ordersCache.delete(customerId);
    for (const [k, v] of loginCache.entries()) {
      if (v.payload.customer.id === customerId) {
        loginCache.delete(k);
      }
    }
    for (const k of ordersCache.keys()) {
      if (k.startsWith(`${customerId}:`) || k === customerId) {
        ordersCache.delete(k);
      }
    }
  }
  if (!normEmail && !customerId) {
    loginCache.clear();
    ordersCache.clear();
  }
}

type BagSizeId = 'P' | 'M' | 'G';
type PaymentMethod = 'credit_card_demo' | 'pix_demo' | 'boleto_demo';

interface BagSizeSpec {
  id: BagSizeId;
  name: string;
  label: string;
  price: number;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  handleDropCm: number;
  capacityDesc: string;
  summary: string;
}

const DEFAULT_BAG_SIZES: Record<BagSizeId, BagSizeSpec> = {
  P: {
    id: 'P',
    name: 'Pequena (P)',
    label: 'Pequena',
    price: 40.88,
    widthCm: 28,
    heightCm: 32,
    depthCm: 8,
    handleDropCm: 21,
    capacityDesc: 'Ideal para livros, caderno e itens essenciais do dia.',
    summary: '28 × 32 × 8 cm · Algodão cru 280g',
  },
  M: {
    id: 'M',
    name: 'Média (M)',
    label: 'Média',
    price: 50.0,
    widthCm: 35,
    heightCm: 40,
    depthCm: 10,
    handleDropCm: 25,
    capacityDesc:
      'Proporção versátil para notebook de até 15", trabalho e compras.',
    summary: '35 × 40 × 10 cm · Algodão cru 280g',
  },
  G: {
    id: 'G',
    name: 'Grande (G)',
    label: 'Grande',
    price: 59.0,
    widthCm: 42,
    heightCm: 46,
    depthCm: 12,
    handleDropCm: 28,
    capacityDesc:
      'Capacidade ampla com fole lateral reforçado para viagens e feira.',
    summary: '42 × 46 × 12 cm · Algodão cru 280g',
  },
};

const ORDER_TIMELINE_STEPS = [
  'Pedido confirmado',
  'Pagamento aprovado',
  'Em produção',
  'Pronto para envio',
  'Pedido enviado',
  'Em trânsito',
  'Saiu para entrega',
  'Entregue',
] as const;

const PROMO_MARKER = '[IE_PROMO_1A_COMPRA_USADA]';
const DEFAULT_ADDR_MARKER = '[PADRAO]';

function sanitizeString(value: unknown, maxLen = 240): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '').slice(0, 8);
}

function formatCepDisplay(digits: string): string {
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

function simulateShippingFee(cepDigits: string): number {
  if (cepDigits.length < 2) return 18.9;
  const firstDigit = Number(cepDigits[0]);
  if (firstDigit <= 1) return 14.9;
  if (firstDigit <= 3) return 18.9;
  if (firstDigit <= 5) return 21.5;
  if (firstDigit <= 7) return 23.9;
  return 19.9;
}

function parseBooleanCell(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'sim' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'nao' || v === 'não' || v === 'no') {
      return false;
    }
  }
  return fallback;
}

function parseNumberCell(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const normalized = val.replace(/[R$\s]/g, '').replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val && typeof val === 'object') return val as T;
  if (typeof val === 'string' && val.trim()) {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapStepToNocoPedidoStatus(stepIndex: number): string {
  if (stepIndex <= 0) return 'Aguardando Pagamento';
  if (stepIndex === 1) return 'Aguardando Arte';
  if (stepIndex === 2) return 'Em Producao';
  if (stepIndex === 3) return 'Em Separacao';
  if (stepIndex >= 4 && stepIndex <= 6) return 'Enviado';
  return 'Entregue';
}

function mapStepToNocoEntregaStatus(stepIndex: number): string {
  if (stepIndex <= 2) return 'Nao Expedida';
  if (stepIndex === 3) return 'Aguardando Coleta';
  if (stepIndex === 4 || stepIndex === 5) return 'Em Transito';
  if (stepIndex === 6) return 'Saiu para Entrega';
  return 'Entregue';
}

function buildTimeline(activeStepIndex: number, createdAtIso: string) {
  const safeIdx = Math.max(
    0,
    Math.min(ORDER_TIMELINE_STEPS.length - 1, activeStepIndex)
  );
  const baseMs = Number.isNaN(new Date(createdAtIso).getTime())
    ? Date.now()
    : new Date(createdAtIso).getTime();

  return ORDER_TIMELINE_STEPS.map((status, idx) => ({
    step: idx + 1,
    status,
    completed: idx <= safeIdx,
    timestamp:
      idx <= safeIdx
        ? new Date(baseMs + idx * 3600 * 1000).toISOString()
        : undefined,
    note:
      idx === safeIdx
        ? 'Etapa atual (atualização demonstrativa)'
        : undefined,
  }));
}

function mapAddressRow(
  row: Record<string, unknown>,
  meta: NocoTableMeta
) {
  const referencia = String(
    readField(row, meta, ['referencia', 'observacoes']) ?? ''
  );
  const isDefaultByMarker = referencia.includes(DEFAULT_ADDR_MARKER);
  return {
    id: getRecordPk(row, meta) || `addr-${Date.now()}`,
    label:
      sanitizeString(
        String(
          readField(row, meta, [
            'identificacao',
            'apelido',
            'label',
            'tipo',
            'titulo',
          ]) ?? 'Endereço'
        ),
        60
      ) || 'Endereço',
    cep: sanitizeString(
      String(readField(row, meta, ['cep', 'codigopostal', 'zipcode']) ?? ''),
      20
    ),
    street: sanitizeString(
      String(
        readField(row, meta, ['rua', 'logradouro', 'endereco', 'street']) ?? ''
      ),
      180
    ),
    number: sanitizeString(
      String(readField(row, meta, ['numero', 'number', 'nro']) ?? ''),
      30
    ),
    complement: sanitizeString(
      String(readField(row, meta, ['complemento', 'complement']) ?? ''),
      120
    ),
    neighborhood: sanitizeString(
      String(readField(row, meta, ['bairro', 'neighborhood']) ?? ''),
      120
    ),
    city: sanitizeString(
      String(readField(row, meta, ['cidade', 'city', 'municipio']) ?? ''),
      120
    ),
    state: sanitizeString(
      String(readField(row, meta, ['estado', 'uf', 'state']) ?? ''),
      4
    ).toUpperCase(),
    isDefault:
      isDefaultByMarker ||
      parseBooleanCell(
        readField(row, meta, ['padrao', 'principal', 'isdefault', 'default']),
        false
      ),
  };
}

function mapCustomerRow(
  row: Record<string, unknown>,
  meta: NocoTableMeta,
  addresses: ReturnType<typeof mapAddressRow>[],
  hasPriorOrders: boolean
) {
  const id = getRecordPk(row, meta);
  const obs = String(readField(row, meta, ['observacoes', 'obs']) ?? '');
  const promoByMarker = obs.includes(PROMO_MARKER);
  const promoByBool = parseBooleanCell(
    readField(row, meta, [
      'primeiracomprausada',
      'usouprimeiracompra',
      'promousada',
      'hasusedfirstpurchasepromo',
    ]),
    false
  );

  return {
    id,
    name:
      sanitizeString(
        String(
          readField(row, meta, ['nome', 'nomefantasia', 'nomecompleto', 'name']) ??
            ''
        ),
        140
      ) || 'Cliente Inside Ecobag',
    email: sanitizeString(
      String(readField(row, meta, ['email', 'emailcliente', 'mail']) ?? ''),
      160
    ),
    phone: sanitizeString(
      String(
        readField(row, meta, ['telefone', 'whatsapp', 'celular', 'phone']) ?? ''
      ),
      40
    ),
    savedForFuture: true,
    hasUsedFirstPurchasePromo: promoByMarker || promoByBool || hasPriorOrders,
    addresses,
    createdAt:
      sanitizeString(
        String(
          readField(row, meta, ['CreatedAt', 'created_at', 'createdat']) ??
            new Date().toISOString()
        ),
        60
      ) || new Date().toISOString(),
  };
}

async function fetchCustomerAddresses(customerId: string) {
  const addrMeta = await getTableMeta('enderecos');
  const linked = await fetchFullLinkedRecords({
    sourceTable: 'clientes',
    sourceRecordId: customerId,
    targetTable: 'enderecos',
    linkAliasHints: ['enderecos', 'endereco'],
  });

  return linked
    .filter((row) =>
      parseBooleanCell(readField(row, addrMeta, ['ativo']), true)
    )
    .map((row) => mapAddressRow(row, addrMeta));
}

async function fetchCatalogFromNocoDB(): Promise<CatalogPayload> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache.data;
  }
  if (catalogInFlight) {
    return catalogInFlight;
  }

  catalogInFlight = (async () => {
    const sizes: Record<BagSizeId, BagSizeSpec> = {
      P: { ...DEFAULT_BAG_SIZES.P },
      M: { ...DEFAULT_BAG_SIZES.M },
      G: { ...DEFAULT_BAG_SIZES.G },
    };
    const productIds: Partial<Record<BagSizeId, string>> = {};

    try {
      const { meta, list } = await listRecords('produtos', { limit: 100 });
      for (const row of list) {
        const ativo = parseBooleanCell(readField(row, meta, ['ativo']), true);
        if (!ativo) continue;

        const codigo = String(
          readField(row, meta, ['codigo', 'idexterno', 'tamanho', 'sku']) ?? ''
        )
          .trim()
          .toUpperCase();
        const nome = String(
          readField(row, meta, ['nome', 'produto', 'titulo']) ?? ''
        )
          .trim()
          .toUpperCase();
        const combined = `${codigo} ${nome}`;

        let sizeId: BagSizeId | null = null;
        if (
          codigo === 'P' ||
          codigo.endsWith('-P') ||
          codigo.endsWith('_P') ||
          combined.includes('PEQUENA') ||
          combined.includes('(P)')
        ) {
          sizeId = 'P';
        } else if (
          codigo === 'M' ||
          codigo.endsWith('-M') ||
          codigo.endsWith('_M') ||
          combined.includes('MEDIA') ||
          combined.includes('MÉDIA') ||
          combined.includes('(M)')
        ) {
          sizeId = 'M';
        } else if (
          codigo === 'G' ||
          codigo.endsWith('-G') ||
          codigo.endsWith('_G') ||
          combined.includes('GRANDE') ||
          combined.includes('(G)')
        ) {
          sizeId = 'G';
        }

        if (!sizeId) continue;

        productIds[sizeId] = getRecordPk(row, meta);
        const base = sizes[sizeId];
        const priceVal = parseNumberCell(
          readField(row, meta, [
            'precovendabase',
            'preco',
            'valor',
            'price',
            'valorunitario',
          ]),
          base.price
        );
        const widthVal = parseNumberCell(
          readField(row, meta, ['larguracm', 'largura', 'widthcm']),
          base.widthCm
        );
        const heightVal = parseNumberCell(
          readField(row, meta, ['alturacm', 'altura', 'heightcm']),
          base.heightCm
        );
        const depthVal = parseNumberCell(
          readField(row, meta, ['profundidadecm', 'profundidade', 'depthcm']),
          base.depthCm
        );
        const nameVal = sanitizeString(
          String(readField(row, meta, ['nome', 'produto', 'titulo']) ?? ''),
          80
        );
        const descVal = sanitizeString(
          String(readField(row, meta, ['descricao', 'capacidade']) ?? ''),
          220
        );

        sizes[sizeId] = {
          ...base,
          name: nameVal || base.name,
          price: priceVal > 0 ? Math.round(priceVal * 100) / 100 : base.price,
          widthCm: widthVal > 0 ? widthVal : base.widthCm,
          heightCm: heightVal > 0 ? heightVal : base.heightCm,
          depthCm: depthVal > 0 ? depthVal : base.depthCm,
          capacityDesc: descVal || base.capacityDesc,
        };
      }

      const data = { sizes, productIds };
      catalogCache = { fetchedAt: Date.now(), data };
      return data;
    } catch {
      // Se já houver catálogo válido em cache, preserva-o em vez de sobrescrever
      if (catalogCache) {
        return catalogCache.data;
      }
      // Preserva catálogo padrão caso NocoDB ainda esteja vazio ou sem credenciais
      return { sizes, productIds };
    } finally {
      catalogInFlight = null;
    }
  })();

  return catalogInFlight;
}

async function hasCustomerPriorOrders(customerId: string): Promise<boolean> {
  if (!customerId) return false;
  const linked = await listLinkedRecords({
    sourceTable: 'clientes',
    sourceRecordId: customerId,
    targetTable: 'pedidos',
    linkAliasHints: ['pedidosclientes', 'pedidos'],
    limit: 1,
  });
  return linked.length > 0;
}

interface StoredPersonalizationSummary {
  schemaVersion?: string;
  storage?: string;
  attachmentColumn?: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  sha256?: string;
  orderCode?: string;
  projectId?: string;
  quantity?: number;
  unitPrice?: number;
  summary?: Record<string, unknown>;
  attachment?: NocoAttachmentItem | null;
  configuration?: Record<string, unknown>;
  previewDataUrl?: string;
}

interface StoredPersonalizationFile {
  schemaVersion?: string;
  source?: string;
  orderCode?: string;
  projectId?: string;
  createdAt?: string;
  quantity?: number;
  unitPrice?: number;
  configuration?: Record<string, unknown>;
  previewDataUrl?: string;
}

async function hydratePersonalizationRecord(
  pRow: Record<string, unknown>,
  persMeta: NocoTableMeta | null,
  fallbackCreatedAt: string,
  idx: number,
  orderPk: string
) {
  const persId = persMeta
    ? getRecordPk(pRow, persMeta)
    : `item-${orderPk}-${idx}`;
  const rawConfigCell = persMeta
    ? readField(pRow, persMeta, ['configuracao3d', 'configuracao'])
    : null;
  const attachmentCell = persMeta
    ? readField(pRow, persMeta, ['arquivo3d', 'arquivo_3d_'])
    : null;

  const parsedBlob = parseJsonSafe<StoredPersonalizationSummary | null>(
    rawConfigCell,
    null
  );

  // Download complete JSON file from NocoDB Attachment column ("arquivo 3d")
  let downloadedFile: StoredPersonalizationFile | null = null;
  const attachmentSource = attachmentCell ?? parsedBlob?.attachment ?? null;
  if (attachmentSource) {
    downloadedFile = await downloadAttachmentJson<StoredPersonalizationFile>(
      attachmentSource
    );
  }

  const rawSizeText = persMeta
    ? String(readField(pRow, persMeta, ['tamanhodabolsa', 'tamanho']) ?? 'M')
        .trim()
        .toUpperCase()
    : 'M';
  const size: BagSizeId = rawSizeText.startsWith('P')
    ? 'P'
    : rawSizeText.startsWith('G')
      ? 'G'
      : 'M';

  const bodyColor =
    (persMeta &&
      sanitizeString(
        String(readField(pRow, persMeta, ['cordabolsa']) ?? '#DBD6BE'),
        32
      )) ||
    '#DBD6BE';
  const handleColor =
    (persMeta &&
      sanitizeString(
        String(readField(pRow, persMeta, ['cordaalca']) ?? bodyColor),
        32
      )) ||
    bodyColor;

  const cfg =
    downloadedFile?.configuration ??
    parsedBlob?.configuration ?? {
      id:
        (persMeta &&
          sanitizeString(
            String(readField(pRow, persMeta, ['idprojeto3d']) ?? ''),
            64
          )) ||
        parsedBlob?.projectId ||
        `bag-${persId}`,
      size,
      bodyColor,
      handleColor,
      unifiedColor: bodyColor === handleColor,
      elements: [],
      drawingStrokes: [],
      drawingVisible: true,
      modelProvider: 'procedural-v1',
      updatedAt: fallbackCreatedAt,
    };

  const item = {
    id: persId,
    configuration: cfg,
    quantity: Math.max(
      1,
      Number(downloadedFile?.quantity ?? parsedBlob?.quantity ?? 1)
    ),
    unitPrice: Number(
      downloadedFile?.unitPrice ??
        parsedBlob?.unitPrice ??
        DEFAULT_BAG_SIZES[size].price
    ),
    previewDataUrl:
      downloadedFile?.previewDataUrl ?? parsedBlob?.previewDataUrl ?? '',
    createdAt: downloadedFile?.createdAt ?? fallbackCreatedAt,
  };

  return {
    item,
    fileName: parsedBlob?.fileName || `personalizacao-${persId}.json`,
    attachment: attachmentSource,
    summary: parsedBlob ?? null,
    fullFile: downloadedFile,
  };
}

function buildErpItemsFromHydrated(
  hydratedItems: Array<{
    item: {
      id: string;
      configuration: Record<string, unknown>;
      quantity: number;
      unitPrice: number;
      previewDataUrl: string;
    };
    fileName?: string;
    attachment?: unknown;
  }>
) {
  return hydratedItems.map(({ item, fileName, attachment }) => {
    const rawSize = String(item.configuration.size ?? 'M').toUpperCase();
    const size: BagSizeId =
      rawSize === 'P' || rawSize === 'G' ? rawSize : 'M';
    const spec = DEFAULT_BAG_SIZES[size];
    const elements = Array.isArray(item.configuration.elements)
      ? (item.configuration.elements as Array<Record<string, unknown>>)
      : [];

    const uploadedFiles: Array<{
      elementId: string;
      type: 'print' | 'botton';
      dataUrl: string;
    }> = [];

    for (const el of elements) {
      if (
        el?.type === 'print' &&
        el?.isCustomUpload &&
        typeof el?.imageUrl === 'string'
      ) {
        uploadedFiles.push({
          elementId: String(el.id ?? ''),
          type: 'print',
          dataUrl: el.imageUrl,
        });
      } else if (
        el?.type === 'botton' &&
        el?.isCustomPhoto &&
        typeof el?.imageUrl === 'string'
      ) {
        uploadedFiles.push({
          elementId: String(el.id ?? ''),
          type: 'botton',
          dataUrl: el.imageUrl,
        });
      }
    }

    return {
      itemId: item.id,
      personalizacaoId: item.id,
      sku: `IE-ECO-${size}`,
      size,
      dimensionsCm: {
        width: spec.widthCm,
        height: spec.heightCm,
        depth: spec.depthCm,
      },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemSubtotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
      previewImageDataUrl: item.previewDataUrl,
      uploadedFiles,
      configurationFileUrl: `/api/personalizacoes/${encodeURIComponent(item.id)}/configuracao-3d`,
      configurationDownloadUrl: `/api/personalizacoes/${encodeURIComponent(item.id)}/configuracao-3d?download=1`,
      configurationFileName: fileName,
      attachment: attachment ?? undefined,
      bag3DConfiguration: item.configuration,
    };
  });
}

function slimErpPayloadForPedidoRow(erpPayload: {
  items: Array<Record<string, unknown>>;
  [key: string]: unknown;
}) {
  return {
    ...erpPayload,
    items: erpPayload.items.map((it) => {
      const cfg = (it.bag3DConfiguration ?? {}) as Record<string, unknown>;
      const rawEls = Array.isArray(cfg.elements)
        ? (cfg.elements as Array<Record<string, unknown>>)
        : [];
      return {
        ...it,
        previewImageDataUrl: '',
        uploadedFiles: [],
        bag3DConfiguration: {
          ...cfg,
          elements: rawEls.map((el) => ({
            ...el,
            imageUrl:
              typeof el.imageUrl === 'string' && el.imageUrl.startsWith('data:')
                ? '[stored_in_personalizacao_arquivo_3d]'
                : el.imageUrl,
          })),
        },
      };
    }),
  };
}

async function hydrateOrderRow(
  row: Record<string, unknown>,
  pedidosMeta: NocoTableMeta,
  persMeta: NocoTableMeta | null,
  pagMeta: NocoTableMeta | null,
  customerId: string,
  customerEmail: string
) {
  const orderPk = getRecordPk(row, pedidosMeta);
  const code =
    sanitizeString(
      String(
        readField(row, pedidosMeta, [
          'numeropedido',
          'idpedidoexterno',
          'chaveidempotencia',
          'codigo',
        ]) ?? `IE-${orderPk}`
      ),
      40
    ) || `IE-${orderPk}`;

  const createdAt =
    sanitizeString(
      String(
        readField(row, pedidosMeta, ['datapedido', 'CreatedAt', 'created_at']) ??
          new Date().toISOString()
      ),
      60
    ) || new Date().toISOString();

  const eventosJson = parseJsonSafe<{
    currentStepIndex?: number;
    customerSnapshot?: { name?: string; email?: string; phone?: string };
    shippingAddress?: Record<string, unknown>;
    pricing?: {
      subtotal?: number;
      discountAmount?: number;
      shippingFee?: number;
      total?: number;
      firstPurchasePromoApplied?: boolean;
    };
    payment?: {
      method?: PaymentMethod;
      label?: string;
      last4?: string;
      installments?: number;
      status?: 'Aprovado (Demonstrativo)';
      paidAt?: string;
    };
    erpPayload?: Record<string, unknown>;
  } | null>(readField(row, pedidosMeta, ['eventosrastreio', 'observacoes']), null);

  const statusText = String(
    readField(row, pedidosMeta, ['status']) ?? ''
  ).trim();

  let currentStepIndex =
    typeof eventosJson?.currentStepIndex === 'number'
      ? eventosJson.currentStepIndex
      : 1;
  if (eventosJson?.currentStepIndex === undefined) {
    if (statusText.toLowerCase().includes('entregue')) currentStepIndex = 7;
    else if (statusText.toLowerCase().includes('enviado')) currentStepIndex = 4;
    else if (statusText.toLowerCase().includes('separacao')) currentStepIndex = 3;
    else if (statusText.toLowerCase().includes('producao')) currentStepIndex = 2;
  }
  currentStepIndex = Math.max(
    0,
    Math.min(ORDER_TIMELINE_STEPS.length - 1, currentStepIndex)
  );

  // Linked Personalizacoes (hydrating complete JSON attachments sequentially)
  const linkedPers = persMeta
    ? await fetchFullLinkedRecords({
        sourceTable: 'pedidos',
        sourceRecordId: orderPk,
        targetTable: 'personalizacoes',
        linkAliasHints: ['personalizacaos', 'personalizacoes', 'personalizacao'],
      })
    : [];

  const hydratedEntries = [];
  for (let idx = 0; idx < linkedPers.length; idx++) {
    const entry = await hydratePersonalizationRecord(
      linkedPers[idx],
      persMeta,
      createdAt,
      idx,
      orderPk
    );
    hydratedEntries.push(entry);
  }
  const items = hydratedEntries.map((e) => e.item);

  // Linked Pagamento
  const linkedPays = pagMeta
    ? await fetchFullLinkedRecords({
        sourceTable: 'pedidos',
        sourceRecordId: orderPk,
        targetTable: 'pagamentos',
        linkAliasHints: ['pagamentos', 'pagamento'],
      })
    : [];
  const firstPay = linkedPays[0];
  const payObs =
    firstPay && pagMeta
      ? parseJsonSafe<{
          method?: PaymentMethod;
          label?: string;
          last4?: string;
          installments?: number;
          status?: 'Aprovado (Demonstrativo)';
          paidAt?: string;
        } | null>(
          readField(firstPay, pagMeta, ['obsrvacoes', 'observacoes']),
          null
        )
      : null;

  const discountAmount = parseNumberCell(
    readField(row, pedidosMeta, ['descontogeral']),
    eventosJson?.pricing?.discountAmount ?? 0
  );
  const shippingFee = parseNumberCell(
    readField(row, pedidosMeta, ['fretecobrado']),
    eventosJson?.pricing?.shippingFee ?? 0
  );
  const subtotalFromItems =
    Math.round(
      items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0) * 100
    ) / 100;
  const subtotal =
    eventosJson?.pricing?.subtotal ??
    parseNumberCell(
      readField(row, pedidosMeta, ['subtotalitens']),
      subtotalFromItems
    );
  const total =
    eventosJson?.pricing?.total ??
    Math.max(0, Math.round((subtotal - discountAmount + shippingFee) * 100) / 100);

  const payment = eventosJson?.payment ?? {
    method: payObs?.method ?? ('credit_card_demo' as const),
    label: payObs?.label ?? 'Pagamento Demonstrativo',
    last4: payObs?.last4,
    installments: payObs?.installments,
    status: 'Aprovado (Demonstrativo)' as const,
    paidAt: payObs?.paidAt ?? createdAt,
  };

  const shippingAddress = eventosJson?.shippingAddress ?? {
    id: `addr-${orderPk}`,
    label: 'Endereço de entrega',
    cep: '',
    street: 'Endereço cadastrado',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    isDefault: true,
  };

  const customerSnapshot = {
    name: eventosJson?.customerSnapshot?.name || 'Cliente',
    email: eventosJson?.customerSnapshot?.email || customerEmail,
    phone: eventosJson?.customerSnapshot?.phone || '',
  };

  const reconstructedErpItems =
    hydratedEntries.length > 0
      ? buildErpItemsFromHydrated(hydratedEntries)
      : Array.isArray(eventosJson?.erpPayload?.items)
        ? (eventosJson.erpPayload.items as Array<Record<string, unknown>>)
        : [];

  const erpPayload = {
    schemaVersion: '1.0',
    targetModule: 'Pedidos de Clientes',
    integrationStatus: 'pending_erp_connection',
    ...(eventosJson?.erpPayload ?? {}),
    orderReference: code,
    createdAt,
    customer: {
      id: customerId,
      ...customerSnapshot,
    },
    deliveryAddress: shippingAddress,
    items: reconstructedErpItems,
    financials: {
      productsSubtotal: subtotal,
      discountAmount,
      shippingFee,
      finalTotal: total,
      firstPurchasePromoUsed: discountAmount > 0,
    },
    payment,
  };

  return {
    id: orderPk,
    code,
    customerId,
    customerSnapshot,
    shippingAddress,
    items,
    pricing: {
      subtotal,
      discountAmount,
      shippingFee,
      total,
      firstPurchasePromoApplied:
        eventosJson?.pricing?.firstPurchasePromoApplied ?? discountAmount > 0,
    },
    payment,
    currentStepIndex,
    timeline: buildTimeline(currentStepIndex, createdAt),
    isDemonstrativeTracking: true as const,
    erpPayload,
    createdAt,
  };
}

async function fetchCustomerFullOrders(customerId: string, customerEmail: string) {
  const clientesMeta = await getTableMeta('clientes');
  const pedidosMeta = await getTableMeta('pedidos');
  const persMeta = await getTableMeta('personalizacoes').catch(() => null);
  const pagMeta = await getTableMeta('pagamentos').catch(() => null);

  // Prefer linked records via Clientes -> PedidosClientes; only scan direct list if no link column exists
  const linkedOrders = await fetchFullLinkedRecords({
    sourceTable: 'clientes',
    sourceRecordId: customerId,
    targetTable: 'pedidos',
    linkAliasHints: ['pedidosclientes', 'pedidos'],
  });

  let orderRows = linkedOrders;
  const hasOrderLinkCol = Boolean(
    findLinkColumn(clientesMeta, pedidosMeta.id, ['pedidosclientes', 'pedidos'])
  );
  if (orderRows.length === 0 && !hasOrderLinkCol) {
    const { list } = await listRecords('pedidos', { limit: 100 });
    orderRows = list.filter((row) => {
      const clienteCell = readField(row, pedidosMeta, ['cliente', 'clientes']);
      if (clienteCell && typeof clienteCell === 'object') {
        const obj = clienteCell as Record<string, unknown>;
        if (String(obj.Id ?? obj.id ?? '') === customerId) return true;
      }
      return false;
    });
  }

  const orders = [];
  for (const row of orderRows) {
    const mappedOrder = await hydrateOrderRow(
      row,
      pedidosMeta,
      persMeta,
      pagMeta,
      customerId,
      customerEmail
    );
    orders.push(mappedOrder);
  }

  orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return orders;
}

// --- Health & Diagnostics ---
nocodbRouter.get('/health', (_req: Request, res: Response) => {
  const status = getNocoConfigStatus();
  res.json({
    ok: true,
    service: 'inside-ecobag-api',
    nocodbConfigured: status.configured,
    missingVars: status.missingVars,
  });
});

nocodbRouter.get(
  '/nocodb/status',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const inspection = await inspectAllTables();
      res.status(inspection.configured ? 200 : 503).json(inspection);
    } catch (err) {
      next(err);
    }
  }
);

// --- Produtos ---
nocodbRouter.get(
  '/produtos',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const configStatus = getNocoConfigStatus();
      const { sizes } = await fetchCatalogFromNocoDB();
      res.json({
        source: configStatus.configured ? 'nocodb' : 'fallback',
        sizes,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- Clientes: Login / Lookup ---
nocodbRouter.post(
  '/clientes/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = sanitizeString(req.body?.email, 160).toLowerCase();
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
      }

      const cachedLogin = loginCache.get(email);
      if (
        cachedLogin &&
        Date.now() - cachedLogin.fetchedAt < LOGIN_CACHE_TTL_MS
      ) {
        res.json(cachedLogin.payload);
        return;
      }

      let pending = loginInFlight.get(email);
      if (!pending) {
        pending = (async () => {
          const { meta: custMeta, record: custRow } = await findRecordByAliases(
            'clientes',
            ['email', 'emailcliente', 'mail'],
            email,
            true
          );

          if (!custRow) {
            return null;
          }

          const customerId = getRecordPk(custRow, custMeta);
          const addresses = await fetchCustomerAddresses(customerId);
          const orders = await fetchCustomerFullOrders(customerId, email);

          const profile = mapCustomerRow(
            custRow,
            custMeta,
            addresses,
            orders.length > 0
          );

          const payload: LoginResponsePayload = { customer: profile, orders };
          loginCache.set(email, { fetchedAt: Date.now(), payload });
          ordersCache.set(`${customerId}:${email}`, {
            fetchedAt: Date.now(),
            orders,
          });
          return payload;
        })().finally(() => {
          loginInFlight.delete(email);
        });
        loginInFlight.set(email, pending);
      }

      const payload = await pending;
      if (!payload) {
        res.status(404).json({
          error: 'Nenhuma conta encontrada com este e-mail no NocoDB.',
        });
        return;
      }

      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

// --- Clientes: Register / Upsert (Non-destructive) ---
nocodbRouter.post(
  '/clientes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = sanitizeString(req.body?.name, 140);
      const email = sanitizeString(req.body?.email, 160).toLowerCase();
      const phone = sanitizeString(req.body?.phone, 40);

      if (!name || !isValidEmail(email) || !phone) {
        res.status(400).json({
          error: 'Nome, e-mail válido e telefone são obrigatórios.',
        });
        return;
      }

      const existing = await findRecordByAliases(
        'clientes',
        ['email', 'emailcliente', 'mail'],
        email,
        true
      );

      let savedMeta: NocoTableMeta;
      let savedRow: Record<string, unknown>;
      let addresses: ReturnType<typeof mapAddressRow>[] = [];
      let hasOrders = false;

      if (existing.record) {
        const pk = getRecordPk(existing.record, existing.meta);
        const existingName = sanitizeString(
          String(
            readField(existing.record, existing.meta, [
              'nome',
              'nomecompleto',
              'name',
            ]) ?? ''
          ),
          140
        );
        const existingPhone = sanitizeString(
          String(
            readField(existing.record, existing.meta, [
              'telefone',
              'whatsapp',
              'phone',
            ]) ?? ''
          ),
          40
        );

        if (existingName === name && existingPhone === phone) {
          savedMeta = existing.meta;
          savedRow = existing.record;
        } else {
          const updated = await updateRecord('clientes', pk, [
            { aliases: ['nome', 'nomecompleto', 'name'], value: name },
            { aliases: ['telefone', 'whatsapp', 'phone'], value: phone },
          ]);
          savedMeta = updated.meta;
          savedRow = { ...existing.record, ...updated.record };
        }

        addresses = await fetchCustomerAddresses(pk);
        const existingObs = String(
          readField(savedRow, savedMeta, ['observacoes', 'obs']) ?? ''
        );
        hasOrders = existingObs.includes(PROMO_MARKER)
          ? true
          : await hasCustomerPriorOrders(pk);
        invalidateCustomerCaches(email, pk);
      } else {
        const created = await createRecord('clientes', [
          { aliases: ['nome', 'nomecompleto', 'name'], value: name },
          { aliases: ['tipopessoa'], value: 'Fisica' },
          { aliases: ['email', 'emailcliente', 'mail'], value: email },
          { aliases: ['telefone', 'whatsapp', 'phone'], value: phone },
          { aliases: ['usuarioexterno'], value: email },
          { aliases: ['situacao'], value: 'Ativo' },
          { aliases: ['origem'], value: 'Site' },
        ]);
        savedMeta = created.meta;
        savedRow = created.record;
        invalidateCustomerCaches(email, getRecordPk(savedRow, savedMeta));
      }

      const profile = mapCustomerRow(savedRow, savedMeta, addresses, hasOrders);
      res.status(existing.record ? 200 : 201).json({ customer: profile });
    } catch (err) {
      next(err);
    }
  }
);

nocodbRouter.patch(
  '/clientes/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = sanitizeString(req.params.id, 64);
      const name = sanitizeString(req.body?.name, 140);
      const phone = sanitizeString(req.body?.phone, 40);
      if (!id || !name || !phone) {
        res.status(400).json({ error: 'ID, nome e telefone são obrigatórios.' });
        return;
      }

      const { meta, record } = await updateRecord('clientes', id, [
        { aliases: ['nome', 'nomecompleto', 'name'], value: name },
        { aliases: ['telefone', 'whatsapp', 'phone'], value: phone },
      ]);

      const email = String(
        readField(record, meta, ['email', 'emailcliente', 'mail']) ?? ''
      );
      const addresses = await fetchCustomerAddresses(id);
      const hasOrders = await hasCustomerPriorOrders(id);
      invalidateCustomerCaches(email, id);

      res.json({
        customer: mapCustomerRow(record, meta, addresses, hasOrders),
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- Endereços ---
nocodbRouter.post(
  '/enderecos',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = sanitizeString(req.body?.customerId, 64);
      const label = sanitizeString(req.body?.label, 60) || 'Endereço';
      const cepDigits = normalizeCep(String(req.body?.cep ?? ''));
      const street = sanitizeString(req.body?.street, 180);
      const number = sanitizeString(req.body?.number, 30);
      const complement = sanitizeString(req.body?.complement, 120);
      const neighborhood = sanitizeString(req.body?.neighborhood, 120);
      const city = sanitizeString(req.body?.city, 120);
      const state = sanitizeString(req.body?.state, 2).toUpperCase();
      const isDefault = Boolean(req.body?.isDefault);

      if (
        !customerId ||
        cepDigits.length !== 8 ||
        !street ||
        !number ||
        !neighborhood ||
        !city ||
        state.length !== 2
      ) {
        res.status(400).json({
          error:
            'Preencha todos os campos obrigatórios do endereço (CEP com 8 dígitos, rua, número, bairro, cidade e UF).',
        });
        return;
      }

      const { meta, record } = await createRecord('enderecos', [
        { aliases: ['identificacao', 'apelido', 'label'], value: label },
        { aliases: ['finalidade'], value: 'Entrega' },
        { aliases: ['cep'], value: formatCepDisplay(cepDigits) },
        { aliases: ['rua', 'logradouro'], value: street },
        { aliases: ['numero'], value: number },
        { aliases: ['complemento'], value: complement },
        { aliases: ['bairro'], value: neighborhood },
        { aliases: ['cidade'], value: city },
        { aliases: ['estado', 'uf'], value: state },
        { aliases: ['pais'], value: 'Brasil' },
        {
          aliases: ['referencia'],
          value: isDefault ? DEFAULT_ADDR_MARKER : undefined,
        },
        { aliases: ['ativo'], value: true },
      ]);

      const addressPk = getRecordPk(record, meta);
      await tryLinkRecords({
        sourceTable: 'enderecos',
        sourceRecordId: addressPk,
        targetTable: 'clientes',
        targetRecordId: customerId,
        linkAliasHints: ['cliente', 'clientes'],
      });

      invalidateCustomerCaches(undefined, customerId);
      res.status(201).json({ address: mapAddressRow(record, meta) });
    } catch (err) {
      next(err);
    }
  }
);

nocodbRouter.delete(
  '/enderecos/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = sanitizeString(req.params.id, 64);
      if (!id) {
        res.status(400).json({ error: 'ID do endereço inválido.' });
        return;
      }
      // Non-destructive soft deactivation when Ativo column exists; fallback delete if preferred
      try {
        await updateRecord('enderecos', id, [
          { aliases: ['ativo'], value: false },
        ]);
      } catch {
        await deleteRecord('enderecos', id);
      }
      invalidateCustomerCaches();
      res.json({ ok: true, id });
    } catch (err) {
      next(err);
    }
  }
);

// --- Pedidos ---
nocodbRouter.get(
  '/pedidos',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = sanitizeString(req.query.customerId, 64);
      const email = sanitizeString(req.query.email, 160).toLowerCase();
      if (!customerId && !email) {
        res.status(400).json({ error: 'Informe customerId ou email.' });
        return;
      }

      const cacheKey = `${customerId}:${email}`;
      const cached = ordersCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < ORDERS_CACHE_TTL_MS) {
        res.json({ orders: cached.orders });
        return;
      }

      let pending = ordersInFlight.get(cacheKey);
      if (!pending) {
        pending = fetchCustomerFullOrders(customerId, email)
          .then((orders) => {
            ordersCache.set(cacheKey, { fetchedAt: Date.now(), orders });
            return orders;
          })
          .finally(() => {
            ordersInFlight.delete(cacheKey);
          });
        ordersInFlight.set(cacheKey, pending);
      }

      const orders = await pending;
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  }
);

nocodbRouter.post(
  '/pedidos',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerInput = req.body?.customer ?? {};
      const addressInput = req.body?.shippingAddress ?? {};
      const itemsInput = (
        Array.isArray(req.body?.items) ? req.body.items : []
      ) as Array<Record<string, unknown>>;
      const paymentInput = req.body?.payment ?? {};

      const name = sanitizeString(customerInput.name, 140);
      const email = sanitizeString(customerInput.email, 160).toLowerCase();
      const phone = sanitizeString(customerInput.phone, 40);

      if (!name || !isValidEmail(email) || !phone) {
        res.status(400).json({
          error: 'Informe nome, e-mail válido e telefone para confirmar o pedido.',
        });
        return;
      }

      const cepDigits = normalizeCep(String(addressInput.cep ?? ''));
      const street = sanitizeString(addressInput.street, 180);
      const number = sanitizeString(addressInput.number, 30);
      const complement = sanitizeString(addressInput.complement, 120);
      const neighborhood = sanitizeString(addressInput.neighborhood, 120);
      const city = sanitizeString(addressInput.city, 120);
      const state = sanitizeString(addressInput.state, 2).toUpperCase();

      if (
        cepDigits.length !== 8 ||
        !street ||
        !number ||
        !neighborhood ||
        !city ||
        state.length !== 2
      ) {
        res.status(400).json({
          error:
            'Endereço incompleto. Preencha CEP (8 dígitos), rua, número, bairro, cidade e UF.',
        });
        return;
      }

      if (itemsInput.length === 0 || itemsInput.length > 30) {
        res.status(400).json({
          error: 'O pedido precisa conter entre 1 e 30 ecobags.',
        });
        return;
      }

      const paymentMethodRaw = sanitizeString(paymentInput.method, 40);
      const paymentMethod: PaymentMethod =
        paymentMethodRaw === 'pix_demo' || paymentMethodRaw === 'boleto_demo'
          ? paymentMethodRaw
          : 'credit_card_demo';

      const last4Digits = sanitizeString(
        String(paymentInput.last4 ?? '').replace(/\D/g, ''),
        4
      );
      const installments =
        paymentMethod === 'credit_card_demo'
          ? Math.max(
              1,
              Math.min(12, Math.round(Number(paymentInput.installments) || 1))
            )
          : undefined;

      // 1. Canonical prices & Product IDs from Produtos
      const { sizes: catalog, productIds } = await fetchCatalogFromNocoDB();

      const validatedItems = itemsInput.map((rawItem, idx) => {
        const cfg = (rawItem?.configuration ?? {}) as Record<string, unknown>;
        const rawSize = String(cfg.size ?? 'M').trim().toUpperCase();
        const size: BagSizeId =
          rawSize === 'P' || rawSize === 'G' ? rawSize : 'M';
        const quantity = Math.max(
          1,
          Math.min(99, Math.round(Number(rawItem?.quantity) || 1))
        );
        const unitPrice = catalog[size].price;
        return {
          id: sanitizeString(rawItem?.id, 64) || `item-${Date.now()}-${idx}`,
          configuration: {
            id: sanitizeString(cfg.id, 64) || `bag-${Date.now()}-${idx}`,
            size,
            bodyColor: sanitizeString(cfg.bodyColor, 32) || '#DBD6BE',
            handleColor: sanitizeString(cfg.handleColor, 32) || '#DBD6BE',
            unifiedColor: cfg.unifiedColor !== false,
            elements: Array.isArray(cfg.elements) ? cfg.elements : [],
            drawingStrokes: Array.isArray(cfg.drawingStrokes)
              ? cfg.drawingStrokes
              : [],
            drawingVisible: cfg.drawingVisible !== false,
            modelProvider:
              cfg.modelProvider === 'glb-official'
                ? ('glb-official' as const)
                : ('procedural-v1' as const),
            updatedAt: new Date().toISOString(),
          },
          quantity,
          unitPrice,
          previewDataUrl:
            typeof rawItem?.previewDataUrl === 'string' &&
            rawItem.previewDataUrl.startsWith('data:image/') &&
            rawItem.previewDataUrl.length <= 4_000_000
              ? rawItem.previewDataUrl
              : '',
          createdAt: new Date().toISOString(),
        };
      });

      const subtotal =
        Math.round(
          validatedItems.reduce(
            (sum: number, item) => sum + item.unitPrice * item.quantity,
            0
          ) * 100
        ) / 100;

      // 2. Find or create Customer in Clientes (non-destructive)
      const existingCustomer = await findRecordByAliases(
        'clientes',
        ['email', 'emailcliente', 'mail'],
        email,
        true
      );

      let customerMeta: NocoTableMeta;
      let customerRow: Record<string, unknown>;
      const isNewCustomer = !existingCustomer.record;

      if (existingCustomer.record) {
        const pk = getRecordPk(existingCustomer.record, existingCustomer.meta);
        const existingName = sanitizeString(
          String(
            readField(existingCustomer.record, existingCustomer.meta, [
              'nome',
              'nomecompleto',
              'name',
            ]) ?? ''
          ),
          140
        );
        const existingPhone = sanitizeString(
          String(
            readField(existingCustomer.record, existingCustomer.meta, [
              'telefone',
              'whatsapp',
              'phone',
            ]) ?? ''
          ),
          40
        );

        if (existingName === name && existingPhone === phone) {
          customerMeta = existingCustomer.meta;
          customerRow = existingCustomer.record;
        } else {
          const updated = await updateRecord('clientes', pk, [
            { aliases: ['nome', 'nomecompleto', 'name'], value: name },
            { aliases: ['telefone', 'whatsapp', 'phone'], value: phone },
          ]);
          customerMeta = updated.meta;
          customerRow = { ...existingCustomer.record, ...updated.record };
        }
      } else {
        const created = await createRecord('clientes', [
          { aliases: ['nome', 'nomecompleto', 'name'], value: name },
          { aliases: ['tipopessoa'], value: 'Fisica' },
          { aliases: ['email', 'emailcliente', 'mail'], value: email },
          { aliases: ['telefone', 'whatsapp', 'phone'], value: phone },
          { aliases: ['usuarioexterno'], value: email },
          { aliases: ['situacao'], value: 'Ativo' },
          { aliases: ['origem'], value: 'Site' },
        ]);
        customerMeta = created.meta;
        customerRow = created.record;
      }

      const customerId = getRecordPk(customerRow, customerMeta);

      // Verify first-purchase eligibility without loading full historical payloads
      const existingObs = String(
        readField(customerRow, customerMeta, ['observacoes', 'obs']) ?? ''
      );
      let isEligibleFirstPurchase = false;
      if (isNewCustomer) {
        isEligibleFirstPurchase = true;
      } else if (!existingObs.includes(PROMO_MARKER)) {
        const hasPrior = await hasCustomerPriorOrders(customerId);
        isEligibleFirstPurchase = !hasPrior;
      }

      const discountAmount = isEligibleFirstPurchase
        ? Math.round(subtotal * 0.05 * 100) / 100
        : 0;
      const shippingFee = isEligibleFirstPurchase
        ? 0
        : simulateShippingFee(cepDigits);
      const total = Math.max(
        0,
        Math.round((subtotal - discountAmount + shippingFee) * 100) / 100
      );

      // 3. Reuse matching Address or create new Address in Enderecos
      const mappedAddresses = isNewCustomer
        ? []
        : await fetchCustomerAddresses(customerId);
      const formattedCep = formatCepDisplay(cepDigits);
      let savedAddress = mappedAddresses.find(
        (a) =>
          normalizeCep(a.cep) === cepDigits &&
          a.number.trim().toLowerCase() === number.toLowerCase()
      );

      if (!savedAddress) {
        const createdAddr = await createRecord('enderecos', [
          {
            aliases: ['identificacao', 'apelido', 'label'],
            value: 'Endereço principal',
          },
          { aliases: ['finalidade'], value: 'Entrega' },
          { aliases: ['cep'], value: formattedCep },
          { aliases: ['rua', 'logradouro'], value: street },
          { aliases: ['numero'], value: number },
          { aliases: ['complemento'], value: complement },
          { aliases: ['bairro'], value: neighborhood },
          { aliases: ['cidade'], value: city },
          { aliases: ['estado', 'uf'], value: state },
          { aliases: ['pais'], value: 'Brasil' },
          { aliases: ['destinatario'], value: name },
          { aliases: ['telefoneentrega'], value: phone },
          {
            aliases: ['referencia'],
            value: mappedAddresses.length === 0 ? DEFAULT_ADDR_MARKER : undefined,
          },
          { aliases: ['ativo'], value: true },
        ]);
        savedAddress = mapAddressRow(createdAddr.record, createdAddr.meta);
        mappedAddresses.push(savedAddress);
        await tryLinkRecords({
          sourceTable: 'enderecos',
          sourceRecordId: savedAddress.id,
          targetTable: 'clientes',
          targetRecordId: customerId,
          linkAliasHints: ['cliente', 'clientes'],
        });
      }

      // 4. Build Order & ERP payload
      const nowIso = new Date().toISOString();
      const orderCode = `IE-${String(Math.floor(10000 + Math.random() * 89999))}`;
      const paymentLabel =
        paymentMethod === 'credit_card_demo'
          ? `Cartão de Crédito (Demonstrativo)${
              last4Digits ? ` •••• ${last4Digits}` : ''
            }`
          : paymentMethod === 'pix_demo'
            ? 'PIX Instantâneo (Demonstrativo)'
            : 'Boleto Bancário (Demonstrativo)';

      const paymentInfo = {
        method: paymentMethod,
        label: paymentLabel,
        last4:
          paymentMethod === 'credit_card_demo'
            ? last4Digits || '0000'
            : undefined,
        installments,
        status: 'Aprovado (Demonstrativo)' as const,
        paidAt: nowIso,
      };

      const erpPayload = {
        schemaVersion: '1.0' as const,
        targetModule: 'Pedidos de Clientes' as const,
        integrationStatus: 'pending_erp_connection' as const,
        orderReference: orderCode,
        createdAt: nowIso,
        customer: { id: customerId, name, email, phone },
        deliveryAddress: savedAddress,
        items: validatedItems.map((item) => {
          const spec = catalog[item.configuration.size];
          return {
            itemId: item.id,
            sku: `IE-ECO-${item.configuration.size}`,
            size: item.configuration.size,
            dimensionsCm: {
              width: spec.widthCm,
              height: spec.heightCm,
              depth: spec.depthCm,
            },
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            itemSubtotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
            previewImageDataUrl: item.previewDataUrl,
            uploadedFiles: [],
            bag3DConfiguration: item.configuration,
          };
        }),
        financials: {
          productsSubtotal: subtotal,
          discountAmount,
          shippingFee,
          finalTotal: total,
          firstPurchasePromoUsed: isEligibleFirstPurchase,
        },
        payment: paymentInfo,
      };

      const briefingSummary = validatedItems
        .map((it, i) => {
          const els = it.configuration.elements as Array<{ type?: string }>;
          return `Item ${i + 1}: Ecobag ${it.configuration.size} (${it.quantity}x) · Corpo ${it.configuration.bodyColor} · Alça ${it.configuration.handleColor} · ${els.length} elemento(s)`;
        })
        .join('\n');

      const currentStepIndex = 1;
      const timeline = buildTimeline(currentStepIndex, nowIso);
      const nocoFormaPagamento =
        paymentMethod === 'pix_demo'
          ? 'PIX'
          : paymentMethod === 'boleto_demo'
            ? 'Boleto'
            : 'Cartao';

      // 5. Insert Order in PedidosClientes
      const createdOrder = await createRecord('pedidos', [
        { aliases: ['numeropedido', 'codigo'], value: orderCode },
        { aliases: ['datapedido'], value: nowIso },
        {
          aliases: ['status'],
          value: mapStepToNocoPedidoStatus(currentStepIndex),
        },
        { aliases: ['canal'], value: 'Site 3D' },
        { aliases: ['fretecobrado'], value: shippingFee },
        { aliases: ['descontogeral'], value: discountAmount },
        { aliases: ['formapagamento'], value: nocoFormaPagamento },
        { aliases: ['statuspagamento'], value: 'Pago' },
        {
          aliases: ['provedorpagamento'],
          value: 'Demonstrativo Inside Ecobag',
        },
        { aliases: ['referenciapagamento'], value: `PAY-${orderCode}` },
        { aliases: ['briefingpersonalizacao'], value: briefingSummary },
        {
          aliases: ['idprojeto3d'],
          value: validatedItems[0]?.configuration.id,
        },
        { aliases: ['statusarte'], value: 'Aprovada' },
        {
          aliases: ['statusentrega'],
          value: mapStepToNocoEntregaStatus(currentStepIndex),
        },
        {
          aliases: ['eventosrastreio'],
          value: {
            currentStepIndex,
            timeline,
            customerSnapshot: { name, email, phone },
            shippingAddress: savedAddress,
            pricing: {
              subtotal,
              discountAmount,
              shippingFee,
              total,
              firstPurchasePromoApplied: isEligibleFirstPurchase,
            },
            payment: paymentInfo,
            erpPayload: slimErpPayloadForPedidoRow(erpPayload),
          },
        },
        { aliases: ['idpedidoexterno'], value: orderCode },
        { aliases: ['chaveidempotencia'], value: orderCode },
        {
          aliases: ['observacoes'],
          value: `Pedido ${orderCode} (${name} · ${email}) · Total ${total.toFixed(2)}`,
        },
      ]);

      const orderId = getRecordPk(createdOrder.record, createdOrder.meta);

      await tryLinkRecords({
        sourceTable: 'pedidos',
        sourceRecordId: orderId,
        targetTable: 'clientes',
        targetRecordId: customerId,
        linkAliasHints: ['cliente', 'clientes'],
      });
      await tryLinkRecords({
        sourceTable: 'pedidos',
        sourceRecordId: orderId,
        targetTable: 'enderecos',
        targetRecordId: savedAddress.id,
        linkAliasHints: ['enderecoentrega', 'enderecos', 'endereco'],
      });

      // 6. Upload complete 3D configuration JSON to NocoDB Storage ("arquivo 3d")
      //    and save only a compact summary/reference inside "configuracao 3d" (LongText)
      const persistedItems: Array<{
        item: (typeof validatedItems)[number];
        fileName: string;
        attachment: NocoAttachmentItem | null;
        persId: string;
      }> = [];
      for (let itemIndex = 0; itemIndex < validatedItems.length; itemIndex++) {
        const item = validatedItems[itemIndex];
        const els = item.configuration.elements as Array<{
          id?: string;
          type?: string;
          text?: string;
          name?: string;
          side?: string;
          imageUrl?: string;
          isCustomUpload?: boolean;
          isCustomPhoto?: boolean;
        }>;
        const textsList = els
          .filter((e) => e.type === 'text')
          .map((e) => `${e.side ?? 'front'}: "${e.text ?? ''}"`);
        const bottonsList = els
          .filter((e) => e.type === 'botton')
          .map((e) => `${e.side ?? 'front'}: ${e.name ?? 'Botton'}`);
        const printsList = els
          .filter((e) => e.type === 'print')
          .map((e) => `${e.side ?? 'front'}: ${e.name ?? 'Estampa'}`);

        const sizeLabel =
          item.configuration.size === 'P'
            ? 'Pequena'
            : item.configuration.size === 'G'
              ? 'Grande'
              : 'Media';

        const fullFilePayload: StoredPersonalizationFile = {
          schemaVersion: '2.0',
          source: 'Inside Ecobag 3D Studio',
          orderCode,
          projectId: item.configuration.id,
          createdAt: nowIso,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          configuration: item.configuration,
          previewDataUrl: item.previewDataUrl,
        };
        const fullJsonString = JSON.stringify(fullFilePayload);
        const byteSize = Buffer.byteLength(fullJsonString, 'utf8');
        const sha256 = crypto
          .createHash('sha256')
          .update(fullJsonString, 'utf8')
          .digest('hex');
        const safeProjectSlug =
          item.configuration.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) ||
          `item-${itemIndex + 1}`;
        const fileName = `personalizacao-${orderCode}-${itemIndex + 1}-${safeProjectSlug}.json`;

        const uploadedAttachments = await uploadJsonAttachment(
          fileName,
          fullJsonString
        );

        const summaryReferencePayload: StoredPersonalizationSummary = {
          schemaVersion: '2.0',
          storage: 'nocodb_attachment',
          attachmentColumn: 'arquivo 3d',
          fileName,
          mimeType: 'application/json',
          byteSize,
          sha256,
          orderCode,
          projectId: item.configuration.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          summary: {
            size: item.configuration.size,
            bodyColor: item.configuration.bodyColor,
            handleColor: item.configuration.handleColor,
            unifiedColor: item.configuration.unifiedColor,
            elementsCount: els.length,
            elementsSummary: els.slice(0, 60).map((e) => ({
              id: typeof e.id === 'string' ? e.id : undefined,
              type: e.type,
              side: e.side,
              name: typeof e.name === 'string' ? e.name.slice(0, 80) : undefined,
              text: typeof e.text === 'string' ? e.text.slice(0, 120) : undefined,
              hasImageData: Boolean(
                typeof e.imageUrl === 'string' && e.imageUrl.startsWith('data:')
              ),
            })),
            drawingStrokesCount: item.configuration.drawingStrokes.length,
            drawingVisible: item.configuration.drawingVisible,
            hasPreviewImage: Boolean(item.previewDataUrl),
          },
          attachment: uploadedAttachments[0] ?? null,
        };

        const createdPers = await createRecord('personalizacoes', [
          {
            aliases: ['title'],
            value: `${orderCode} · Ecobag ${item.configuration.size} (${item.quantity}x)`,
          },
          { aliases: ['tamanhodabolsa'], value: sizeLabel },
          { aliases: ['cordabolsa'], value: item.configuration.bodyColor },
          { aliases: ['cordaalca'], value: item.configuration.handleColor },
          { aliases: ['idprojeto3d'], value: item.configuration.id },
          {
            aliases: ['arquivo3d', 'arquivo_3d_'],
            value: uploadedAttachments,
          },
          {
            aliases: ['textopersonalizado'],
            value:
              textsList.length > 0
                ? textsList.join(' | ').slice(0, 50_000)
                : 'Sem texto',
          },
          {
            aliases: ['bottons'],
            value:
              bottonsList.length > 0
                ? bottonsList.join(' | ').slice(0, 50_000)
                : 'Sem bottons',
          },
          {
            aliases: ['elementosadicionais'],
            value: `Qtd: ${item.quantity} · Valor un.: ${item.unitPrice.toFixed(2)} · Estampas: ${
              printsList.length > 0 ? printsList.join(', ') : 'Nenhuma'
            } · Traços livres: ${item.configuration.drawingStrokes.length} · Arquivo 3D: ${fileName} (${byteSize} bytes)`.slice(
              0,
              50_000
            ),
          },
          {
            aliases: ['configuracao3d'],
            value: JSON.stringify(summaryReferencePayload),
          },
          { aliases: ['datadacriacao'], value: nowIso.slice(0, 10) },
          { aliases: ['status'], value: 'Aprovada' },
          {
            aliases: ['novasatualizacoes'],
            value: `Personalização vinculada ao pedido ${orderCode}. Configuração 3D completa salva no anexo "${fileName}" (${byteSize} bytes).`,
          },
        ]);

        const persId = getRecordPk(createdPers.record, createdPers.meta);
        await tryLinkRecords({
          sourceTable: 'personalizacoes',
          sourceRecordId: persId,
          targetTable: 'pedidos',
          targetRecordId: orderId,
          linkAliasHints: ['pedidosdosclientes', 'pedidos', 'pedido'],
        });

        const matchedProductId = productIds[item.configuration.size];
        if (matchedProductId) {
          await tryLinkRecords({
            sourceTable: 'personalizacoes',
            sourceRecordId: persId,
            targetTable: 'produtos',
            targetRecordId: matchedProductId,
            linkAliasHints: ['produto', 'produtos'],
          });
        }

        persistedItems.push({
          item,
          fileName,
          attachment: uploadedAttachments[0] ?? null,
          persId,
        });
      }

      // Enrich returned erpPayload items with their NocoDB personalizacao ID & retrieval endpoint
      erpPayload.items = erpPayload.items.map((erpIt, idx) => {
        const persisted = persistedItems[idx];
        if (!persisted) return erpIt;
        return {
          ...erpIt,
          personalizacaoId: persisted.persId,
          configurationFileUrl: `/api/personalizacoes/${encodeURIComponent(persisted.persId)}/configuracao-3d`,
          configurationDownloadUrl: `/api/personalizacoes/${encodeURIComponent(persisted.persId)}/configuracao-3d?download=1`,
          configurationFileName: persisted.fileName,
          attachment: persisted.attachment ?? undefined,
        };
      });

      // 7. Insert demonstrative Payment into pagamentos (never stores full card data)
      const pagFormaSelect =
        paymentMethod === 'pix_demo'
          ? 'Pix'
          : paymentMethod === 'credit_card_demo'
            ? 'Cartao de credito'
            : undefined;

      const createdPay = await createRecord('pagamentos', [
        { aliases: ['title'], value: `${orderCode} · ${paymentLabel}` },
        { aliases: ['currency', 'valor', 'amount'], value: total },
        { aliases: ['formadepagamento'], value: pagFormaSelect },
        { aliases: ['statusdopagamento'], value: 'aprovado' },
        {
          aliases: ['provedordopagamento'],
          value: 'Demonstrativo Inside Ecobag',
        },
        { aliases: ['referenciadopagamento'], value: `PAY-${orderCode}` },
        { aliases: ['datadopagamento'], value: nowIso.slice(0, 10) },
        {
          aliases: ['obsrvacoes', 'observacoes'],
          value: JSON.stringify({
            method: paymentMethod,
            label: paymentLabel,
            last4: paymentInfo.last4,
            installments: paymentInfo.installments,
            status: paymentInfo.status,
            paidAt: nowIso,
            isDemo: true,
          }),
        },
      ]);

      const payId = getRecordPk(createdPay.record, createdPay.meta);
      await tryLinkRecords({
        sourceTable: 'pagamentos',
        sourceRecordId: payId,
        targetTable: 'pedidos',
        targetRecordId: orderId,
        linkAliasHints: ['pedido', 'pedidos'],
      });
      await tryLinkRecords({
        sourceTable: 'pagamentos',
        sourceRecordId: payId,
        targetTable: 'clientes',
        targetRecordId: customerId,
        linkAliasHints: ['clientes', 'cliente'],
      });

      invalidateCustomerCaches(email, customerId);

      // 8. Only after order + payment succeed, preserve existing Observacoes & append promo marker
      if (!existingObs.includes(PROMO_MARKER)) {
        const nextObs = existingObs.trim()
          ? `${existingObs.trim()}\n${PROMO_MARKER} (${orderCode})`
          : `${PROMO_MARKER} (${orderCode})`;
        await updateRecord('clientes', customerId, [
          { aliases: ['observacoes', 'obs'], value: nextObs },
        ]);
      }

      const updatedCustomer = mapCustomerRow(
        customerRow,
        customerMeta,
        mappedAddresses,
        true
      );
      updatedCustomer.hasUsedFirstPurchasePromo = true;

      const orderResponse = {
        id: orderId,
        code: orderCode,
        customerId,
        customerSnapshot: { name, email, phone },
        shippingAddress: savedAddress,
        items: validatedItems,
        pricing: {
          subtotal,
          discountAmount,
          shippingFee,
          total,
          firstPurchasePromoApplied: isEligibleFirstPurchase,
        },
        payment: paymentInfo,
        currentStepIndex,
        timeline,
        isDemonstrativeTracking: true as const,
        erpPayload,
        createdAt: nowIso,
      };

      res.status(201).json({
        order: orderResponse,
        customer: updatedCustomer,
      });
    } catch (err) {
      next(err);
    }
  }
);

nocodbRouter.patch(
  '/pedidos/:id/etapa',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = sanitizeString(req.params.id, 64);
      const stepIndex = Math.max(
        0,
        Math.min(
          ORDER_TIMELINE_STEPS.length - 1,
          Math.round(Number(req.body?.stepIndex) || 0)
        )
      );

      if (!id) {
        res.status(400).json({ error: 'ID do pedido inválido.' });
        return;
      }

      const meta = await getTableMeta('pedidos');
      const { list } = await listRecords('pedidos', {
        limit: 10,
        where: `(${meta.pkField},eq,${id.replace(/[~(),]/g, '')})`,
      });
      const existingRow = list[0];
      const existingEvents = existingRow
        ? parseJsonSafe<Record<string, unknown>>(
            readField(existingRow, meta, ['eventosrastreio']),
            {}
          )
        : {};
      const createdAt = existingRow
        ? String(
            readField(existingRow, meta, ['datapedido', 'CreatedAt']) ??
              new Date().toISOString()
          )
        : new Date().toISOString();

      await updateRecord('pedidos', id, [
        {
          aliases: ['status'],
          value: mapStepToNocoPedidoStatus(stepIndex),
        },
        {
          aliases: ['statusentrega'],
          value: mapStepToNocoEntregaStatus(stepIndex),
        },
        {
          aliases: ['eventosrastreio'],
          value: {
            ...existingEvents,
            currentStepIndex: stepIndex,
            timeline: buildTimeline(stepIndex, createdAt),
          },
        },
      ]);

      invalidateCustomerCaches();

      res.json({
        ok: true,
        id,
        currentStepIndex: stepIndex,
        status: ORDER_TIMELINE_STEPS[stepIndex],
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- ERP / WMS Recovery Endpoints for Full 3D Personalization JSON ---
nocodbRouter.get(
  '/personalizacoes/:id/configuracao-3d',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = sanitizeString(req.params.id, 64);
      if (!id) {
        res.status(400).json({ error: 'ID da personalização inválido.' });
        return;
      }

      const { meta, record } = await getRecordByPk('personalizacoes', id);
      if (!record) {
        res.status(404).json({ error: 'Personalização não encontrada.' });
        return;
      }

      const createdAt =
        sanitizeString(
          String(
            readField(record, meta, ['datadacriacao', 'CreatedAt', 'created_at']) ??
              new Date().toISOString()
          ),
          60
        ) || new Date().toISOString();

      const hydrated = await hydratePersonalizationRecord(
        record,
        meta,
        createdAt,
        0,
        id
      );

      const safeDownloadName =
        hydrated.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') ||
        `personalizacao-${id}.json`;

      if (req.query.download === '1' || req.query.download === 'true') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeDownloadName}"`
        );
      }

      const fullPayload: StoredPersonalizationFile = hydrated.fullFile ?? {
        schemaVersion: '2.0',
        source: 'Inside Ecobag 3D Studio',
        projectId: String(hydrated.item.configuration.id ?? id),
        createdAt: hydrated.item.createdAt,
        quantity: hydrated.item.quantity,
        unitPrice: hydrated.item.unitPrice,
        configuration: hydrated.item.configuration,
        previewDataUrl: hydrated.item.previewDataUrl,
      };

      res.json({
        personalizacaoId: id,
        fileName: safeDownloadName,
        summary: hydrated.summary,
        ...fullPayload,
      });
    } catch (err) {
      next(err);
    }
  }
);

nocodbRouter.get(
  '/pedidos/:id/erp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idOrCode = sanitizeString(req.params.id, 64);
      if (!idOrCode) {
        res.status(400).json({ error: 'ID ou código do pedido inválido.' });
        return;
      }

      const pedidosMeta = await getTableMeta('pedidos');
      let orderRow: Record<string, unknown> | null = null;

      if (/^\d+$/.test(idOrCode)) {
        const direct = await getRecordByPk('pedidos', idOrCode);
        orderRow = direct.record;
      }
      if (!orderRow) {
        const byCode = await findRecordByAliases(
          'pedidos',
          ['numeropedido', 'idpedidoexterno', 'chaveidempotencia', 'codigo'],
          idOrCode,
          true
        );
        orderRow = byCode.record;
      }

      if (!orderRow) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
      }

      const orderPk = getRecordPk(orderRow, pedidosMeta);
      const linkedClients = await listLinkedRecords({
        sourceTable: 'pedidos',
        sourceRecordId: orderPk,
        targetTable: 'clientes',
        linkAliasHints: ['cliente', 'clientes'],
        limit: 1,
      });
      const clientesMeta = await getTableMeta('clientes');
      const clientRow = linkedClients[0];
      const customerId = clientRow ? getRecordPk(clientRow, clientesMeta) : '';
      const customerEmail = clientRow
        ? sanitizeString(
            String(
              readField(clientRow, clientesMeta, ['email', 'emailcliente', 'mail']) ??
                ''
            ),
            160
          )
        : '';

      const persMeta = await getTableMeta('personalizacoes').catch(() => null);
      const pagMeta = await getTableMeta('pagamentos').catch(() => null);

      const hydratedOrder = await hydrateOrderRow(
        orderRow,
        pedidosMeta,
        persMeta,
        pagMeta,
        customerId,
        customerEmail
      );

      res.json({
        orderId: hydratedOrder.id,
        orderCode: hydratedOrder.code,
        erpPayload: hydratedOrder.erpPayload,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- Centralized Error Middleware ---
nocodbRouter.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NocoNotConfiguredError) {
      res.status(503).json({
        error: err.message,
        code: 'NOCODB_NOT_CONFIGURED',
        missingVars: err.missingVars,
      });
      return;
    }

    if (err instanceof NocoApiError) {
      res.status(err.status).json({
        error: err.message,
        code: 'NOCODB_API_ERROR',
      });
      return;
    }

    const message =
      err instanceof Error
        ? err.message
        : 'Erro interno ao processar requisição.';
    res.status(500).json({ error: message, code: 'INTERNAL_ERROR' });
  }
);
