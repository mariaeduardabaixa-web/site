export type AppView =
  | 'home'
  | 'size-select'
  | 'studio'
  | 'cart'
  | 'checkout'
  | 'account';

export type BagSizeId = 'P' | 'M' | 'G';

export type BagSide = 'front' | 'back';

export type StudioTool =
  | 'model'
  | 'colors'
  | 'prints'
  | 'text'
  | 'draw'
  | 'bottons'
  | 'elements';

export type PrintCategory =
  | 'Minimalistas'
  | 'Florais'
  | 'Abstratas'
  | 'Geométricas'
  | 'Natureza'
  | 'Artísticas'
  | 'Vintage'
  | 'Tipográficas'
  | 'Modernas';

export interface BagSizeSpec {
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

export interface CottonColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface PrintTemplate {
  id: string;
  name: string;
  category: PrintCategory;
  imageUrl: string;
}

export interface BottonTemplate {
  id: string;
  name: string;
  imageUrl: string;
  defaultBorderColor: string;
}

export interface BaseBagElement {
  id: string;
  name: string;
  side: BagSide;
  x: number; // Normalized [-0.42, 0.42] relative to bag face width
  y: number; // Normalized [-0.42, 0.42] relative to bag face height
  scale: number; // Relative scale (0.15 to 1.4)
  rotation: number; // Degrees (-180 to 180)
  visible: boolean;
  zIndex: number;
}

export interface PrintElement extends BaseBagElement {
  type: 'print';
  imageUrl: string;
  isCustomUpload: boolean;
  category?: PrintCategory;
}

export interface TextElement extends BaseBagElement {
  type: 'text';
  text: string;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
}

export type BottonShape = 'round' | 'square' | 'heart';
export type BottonFinish = 'matte' | 'glossy';

export interface BottonElement extends BaseBagElement {
  type: 'botton';
  imageUrl: string;
  shape: BottonShape;
  finish: BottonFinish;
  borderColor: string;
  showBorder: boolean;
  isCustomPhoto: boolean;
}

export interface DrawingStroke {
  id: string;
  side: BagSide;
  points: Array<{ u: number; v: number }>; // Normalized [0..1] face UV coordinates
  color: string;
  size: number; // Stroke width in normalized canvas units
  isEraser: boolean;
}

export interface DrawingLayerMeta {
  id: string;
  type: 'drawing';
  name: string;
  side: BagSide;
  visible: boolean;
  zIndex: number;
}

export type BagElement = PrintElement | TextElement | BottonElement;

export interface BagConfiguration {
  id: string;
  size: BagSizeId;
  bodyColor: string;
  handleColor: string;
  unifiedColor: boolean;
  elements: BagElement[];
  drawingStrokes: DrawingStroke[];
  drawingVisible: boolean;
  modelProvider: 'procedural-v1' | 'glb-official';
  updatedAt: string;
}

export interface CartItem {
  id: string;
  configuration: BagConfiguration;
  quantity: number;
  unitPrice: number;
  previewDataUrl: string;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  savedForFuture: boolean;
  hasUsedFirstPurchasePromo: boolean;
  addresses: Address[];
  createdAt: string;
}

export interface PromotionCalculation {
  isEligible: boolean;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  shippingFee: number;
  originalShippingFee: number;
  freeShippingApplied: boolean;
  total: number;
  reason: string;
}

export type ErpOrderStatusCode =
  | 'PEDIDO_RECEBIDO'
  | 'ANALISE_PERSONALIZACAO'
  | 'ARTE_AGUARDANDO_APROVACAO'
  | 'ARTE_APROVADA'
  | 'SEPARACAO_MATERIAIS'
  | 'EM_PRODUCAO'
  | 'INSPECAO_QUALIDADE'
  | 'EMBALAGEM'
  | 'PRONTO_PARA_EXPEDICAO'
  | 'PEDIDO_EXPEDIDO'
  | 'EM_TRANSPORTE'
  | 'SAIU_PARA_ENTREGA'
  | 'ENTREGUE'
  | 'ENTREGA_CONFIRMADA_CLIENTE';

export type OrderTimelineStatus =
  | 'Pedido recebido'
  | 'Análise da personalização'
  | 'Arte aguardando aprovação'
  | 'Arte aprovada'
  | 'Separação de materiais'
  | 'Em produção'
  | 'Inspeção de qualidade'
  | 'Embalagem'
  | 'Pronto para expedição'
  | 'Pedido expedido'
  | 'Em transporte'
  | 'Saiu para entrega'
  | 'Entregue'
  | 'Entrega confirmada pelo cliente';

export interface OrderTimelineEntry {
  step: number;
  erpCode?: ErpOrderStatusCode;
  status: OrderTimelineStatus;
  completed: boolean;
  timestamp?: string;
  note?: string;
  source?: 'erp_wms_demo' | 'erp_wms_sync' | 'customer_confirmation';
}

export interface ErpStatusUpdateEvent {
  orderId?: string;
  orderReference: string;
  erpCode: ErpOrderStatusCode;
  statusLabel?: OrderTimelineStatus;
  updatedAt: string;
  note?: string;
}

export interface ErpDeliveryConfirmationPayload {
  schemaVersion: '1.0';
  eventType: 'CUSTOMER_DELIVERY_CONFIRMED';
  targetModule: 'Pedidos de Clientes';
  integrationStatus: 'pending_erp_connection';
  orderId: string;
  orderReference: string;
  customerId: string;
  customerEmail: string;
  previousStatus: OrderTimelineStatus;
  previousErpCode: ErpOrderStatusCode;
  newStatus: 'Entrega confirmada pelo cliente';
  newErpCode: 'ENTREGA_CONFIRMADA_CLIENTE';
  confirmedAt: string;
}

export interface OrderDeliveryConfirmation {
  confirmed: true;
  statusLabel: 'Entrega confirmada pelo cliente';
  confirmedAt: string;
  previousStatus: OrderTimelineStatus;
  erpSyncStatus: 'pending_erp_connection';
  erpPreparedPayload: ErpDeliveryConfirmationPayload;
}

export type PaymentMethod = 'credit_card_demo' | 'pix_demo' | 'boleto_demo';

export interface OrderPaymentInfo {
  method: PaymentMethod;
  label: string;
  last4?: string;
  installments?: number;
  status: 'Aprovado (Demonstrativo)';
  paidAt: string;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerSnapshot: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: Address;
  items: CartItem[];
  pricing: {
    subtotal: number;
    discountAmount: number;
    shippingFee: number;
    total: number;
    firstPurchasePromoApplied: boolean;
  };
  payment: OrderPaymentInfo;
  currentStepIndex: number; // 0..12 across the 13 ERP/WMS stages
  erpStatusCode?: ErpOrderStatusCode;
  erpStatusLabel?: OrderTimelineStatus;
  deliveryConfirmation?: OrderDeliveryConfirmation;
  timeline: OrderTimelineEntry[];
  isDemonstrativeTracking: true;
  erpPayload: ErpOrderPayload;
  createdAt: string;
}

export type ComplaintReason =
  | 'Defeito no produto'
  | 'Estampa incorreta'
  | 'Cor ou tamanho incorreto'
  | 'Danos no transporte'
  | 'Pedido incompleto'
  | 'Outros motivos';

export type ComplaintStatus =
  | 'Solicitação recebida'
  | 'Em análise pela qualidade'
  | 'Aguardando retorno'
  | 'Resolvido';

export interface ComplaintTicket {
  id: string;
  protocol: string;
  customerId: string;
  orderCode: string;
  reason: ComplaintReason;
  description: string;
  attachments: Array<{ name: string; dataUrl: string }>;
  status: ComplaintStatus;
  updates: Array<{ date: string; message: string }>;
  createdAt: string;
}

/**
 * Estrutura preparada para futura integração com o módulo
 * "Pedidos de Clientes" do ERP/WMS da Inside Ecobag.
 */
export interface ErpOrderPayload {
  schemaVersion: '1.0';
  targetModule: 'Pedidos de Clientes';
  integrationStatus: 'pending_erp_connection';
  orderReference: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  deliveryAddress: Address;
  items: Array<{
    itemId: string;
    sku: string;
    size: BagSizeId;
    dimensionsCm: { width: number; height: number; depth: number };
    quantity: number;
    unitPrice: number;
    itemSubtotal: number;
    previewImageDataUrl: string;
    uploadedFiles: Array<{ elementId: string; type: 'print' | 'botton'; dataUrl: string }>;
    bag3DConfiguration: BagConfiguration;
  }>;
  financials: {
    productsSubtotal: number;
    discountAmount: number;
    shippingFee: number;
    finalTotal: number;
    firstPurchasePromoUsed: boolean;
  };
  payment: OrderPaymentInfo;
}
