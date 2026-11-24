import {
  BAG_SIZES,
  CLIENT_DELIVERY_CONFIRMED_STATUS,
  ORDER_TIMELINE_STEPS,
} from '../data/catalog';
import {
  ErpDeliveryConfirmationPayload,
  ErpOrderPayload,
  ErpOrderStatusCode,
  ErpStatusUpdateEvent,
  Order,
  OrderDeliveryConfirmation,
  OrderTimelineEntry,
  OrderTimelineStatus,
} from '../types';

export interface ErpStatusDefinition {
  stepIndex: number;
  code: ErpOrderStatusCode;
  label: OrderTimelineStatus;
  stageGroup: 'recebimento' | 'arte' | 'producao' | 'expedicao' | 'entrega';
}

/**
 * Catálogo canônico de etapas reais compartilhadas entre o app e o ERP/WMS.
 * [INTEGRAÇÃO FUTURA ERP/WMS]: Ao ativar a integração, o status exibido ao
 * cliente corresponderá diretamente ao código/etapa registrado no ERP/WMS.
 */
export const ERP_STATUS_CATALOG: ErpStatusDefinition[] = [
  { stepIndex: 0, code: 'PEDIDO_RECEBIDO', label: 'Pedido recebido', stageGroup: 'recebimento' },
  { stepIndex: 1, code: 'ANALISE_PERSONALIZACAO', label: 'Análise da personalização', stageGroup: 'arte' },
  { stepIndex: 2, code: 'ARTE_AGUARDANDO_APROVACAO', label: 'Arte aguardando aprovação', stageGroup: 'arte' },
  { stepIndex: 3, code: 'ARTE_APROVADA', label: 'Arte aprovada', stageGroup: 'arte' },
  { stepIndex: 4, code: 'SEPARACAO_MATERIAIS', label: 'Separação de materiais', stageGroup: 'producao' },
  { stepIndex: 5, code: 'EM_PRODUCAO', label: 'Em produção', stageGroup: 'producao' },
  { stepIndex: 6, code: 'INSPECAO_QUALIDADE', label: 'Inspeção de qualidade', stageGroup: 'producao' },
  { stepIndex: 7, code: 'EMBALAGEM', label: 'Embalagem', stageGroup: 'expedicao' },
  { stepIndex: 8, code: 'PRONTO_PARA_EXPEDICAO', label: 'Pronto para expedição', stageGroup: 'expedicao' },
  { stepIndex: 9, code: 'PEDIDO_EXPEDIDO', label: 'Pedido expedido', stageGroup: 'expedicao' },
  { stepIndex: 10, code: 'EM_TRANSPORTE', label: 'Em transporte', stageGroup: 'entrega' },
  { stepIndex: 11, code: 'SAIU_PARA_ENTREGA', label: 'Saiu para entrega', stageGroup: 'entrega' },
  { stepIndex: 12, code: 'ENTREGUE', label: 'Entregue', stageGroup: 'entrega' },
];

const LEGACY_STATUS_TO_ERP_STEP: Record<string, number> = {
  'pedido confirmado': 0,
  'pagamento aprovado': 0,
  'em produção': 5,
  'pronto para envio': 8,
  'pedido enviado': 9,
  'em trânsito': 10,
  'saiu para entrega': 11,
  entregue: 12,
};

export function getErpDefinitionByStep(stepIndex: number): ErpStatusDefinition {
  const safe = Math.max(
    0,
    Math.min(ERP_STATUS_CATALOG.length - 1, Math.round(stepIndex))
  );
  return ERP_STATUS_CATALOG[safe];
}

export function getErpDefinitionByCode(
  code?: ErpOrderStatusCode | string
): ErpStatusDefinition | null {
  if (!code) return null;
  return ERP_STATUS_CATALOG.find((item) => item.code === code) ?? null;
}

export function buildErpTimelineFromStep(
  activeStepIndex: number,
  createdAtIso: string,
  deliveryConfirmation?: OrderDeliveryConfirmation,
  source: OrderTimelineEntry['source'] = 'erp_wms_demo',
  existingTimeline?: OrderTimelineEntry[]
): OrderTimelineEntry[] {
  const safeIdx = Math.max(
    0,
    Math.min(ORDER_TIMELINE_STEPS.length - 1, Math.round(activeStepIndex))
  );
  const baseMs = Number.isNaN(new Date(createdAtIso).getTime())
    ? Date.now()
    : new Date(createdAtIso).getTime();

  const steps: OrderTimelineEntry[] = ERP_STATUS_CATALOG.map((def, idx) => {
    const prev = existingTimeline?.find((e) => e.status === def.label);
    const completed = idx <= safeIdx;
    return {
      step: idx + 1,
      erpCode: def.code,
      status: def.label,
      completed,
      timestamp: completed
        ? prev?.timestamp || new Date(baseMs + idx * 1800 * 1000).toISOString()
        : undefined,
      note:
        prev?.note ||
        (idx === safeIdx && !deliveryConfirmation?.confirmed
          ? 'Etapa atual sincronizada em modo demonstrativo (pronta para ERP/WMS)'
          : undefined),
      source: prev?.source || source,
    };
  });

  if (deliveryConfirmation?.confirmed) {
    steps.push({
      step: ERP_STATUS_CATALOG.length + 1,
      erpCode: 'ENTREGA_CONFIRMADA_CLIENTE',
      status: CLIENT_DELIVERY_CONFIRMED_STATUS,
      completed: true,
      timestamp: deliveryConfirmation.confirmedAt,
      note: 'Recebimento confirmado pelo cliente. Registro preparado para envio futuro ao ERP/WMS.',
      source: 'customer_confirmation',
    });
  }

  return steps;
}

/**
 * Converte pedidos vindos de fontes legadas/NocoDB (8 etapas) ou já no formato ERP/WMS
 * para a linha do tempo unificada de 13 etapas + confirmação do cliente.
 */
export function normalizeOrderForErpView(order: Order): Order {
  const alreadyModern =
    order.timeline.length >= ERP_STATUS_CATALOG.length &&
    order.timeline[0]?.status === 'Pedido recebido';

  let resolvedStepIndex = order.currentStepIndex;
  if (!alreadyModern) {
    const currentLegacyLabel =
      (order.erpStatusLabel ||
        order.timeline[order.currentStepIndex]?.status ||
        '')
        .trim()
        .toLowerCase();

    if (currentLegacyLabel in LEGACY_STATUS_TO_ERP_STEP) {
      resolvedStepIndex = LEGACY_STATUS_TO_ERP_STEP[currentLegacyLabel];
    } else if (order.erpStatusCode) {
      const matched = getErpDefinitionByCode(order.erpStatusCode);
      if (matched) resolvedStepIndex = matched.stepIndex;
    } else {
      const directIdx = ORDER_TIMELINE_STEPS.findIndex(
        (s) => s.toLowerCase() === currentLegacyLabel
      );
      if (directIdx >= 0) {
        resolvedStepIndex = directIdx;
      }
    }
  }

  const safeIdx = Math.max(
    0,
    Math.min(ERP_STATUS_CATALOG.length - 1, resolvedStepIndex)
  );
  const def = getErpDefinitionByStep(safeIdx);
  const isConfirmed = Boolean(order.deliveryConfirmation?.confirmed);

  return {
    ...order,
    currentStepIndex: safeIdx,
    erpStatusCode: isConfirmed ? 'ENTREGA_CONFIRMADA_CLIENTE' : def.code,
    erpStatusLabel: isConfirmed
      ? CLIENT_DELIVERY_CONFIRMED_STATUS
      : def.label,
    timeline: buildErpTimelineFromStep(
      safeIdx,
      order.createdAt,
      order.deliveryConfirmation,
      'erp_wms_demo',
      alreadyModern ? order.timeline : undefined
    ),
  };
}

export function getOrderCurrentStatus(order: Order): OrderTimelineStatus {
  if (order.deliveryConfirmation?.confirmed) {
    return CLIENT_DELIVERY_CONFIRMED_STATUS;
  }
  if (order.erpStatusLabel) {
    return order.erpStatusLabel;
  }
  return (
    order.timeline[order.currentStepIndex]?.status ?? ORDER_TIMELINE_STEPS[0]
  );
}

/**
 * Regra de confirmação de entrega:
 * O botão "Confirmar recebimento" só aparece quando o pedido estiver com status
 * "Saiu para entrega" ou "Entregue" e ainda não tiver sido confirmado.
 */
export function canCustomerConfirmDelivery(order: Order): boolean {
  if (order.deliveryConfirmation?.confirmed) return false;
  const currentStatus = getOrderCurrentStatus(order);
  return (
    currentStatus === 'Saiu para entrega' || currentStatus === 'Entregue'
  );
}

/**
 * [INTEGRAÇÃO FUTURA ERP/WMS - RECEBIMENTO DE STATUS]:
 * Ponto único onde o aplicativo receberá atualizações de status vindas do ERP/WMS
 * da Inside Ecobag (via webhook ou consulta programada) para refletir em tempo real
 * na tela do cliente o mesmo status registrado internamente pelo ERP/WMS.
 */
export function applyErpStatusUpdateToOrder(
  order: Order,
  event: ErpStatusUpdateEvent
): Order {
  // Não sobrescreve confirmação explícita já registrada pelo cliente
  if (order.deliveryConfirmation?.confirmed) {
    return order;
  }

  const matchedByCode = getErpDefinitionByCode(event.erpCode);
  const matchedByLabel = event.statusLabel
    ? ERP_STATUS_CATALOG.find((d) => d.label === event.statusLabel)
    : undefined;
  const target = matchedByCode ?? matchedByLabel;
  if (!target) return order;

  const updatedTimeline = buildErpTimelineFromStep(
    target.stepIndex,
    order.createdAt,
    undefined,
    'erp_wms_sync',
    order.timeline
  ).map((entry) =>
    entry.step === target.stepIndex + 1
      ? {
          ...entry,
          timestamp: event.updatedAt || entry.timestamp,
          note:
            event.note ||
            'Status atualizado a partir do ERP/WMS da Inside Ecobag',
          source: 'erp_wms_sync' as const,
        }
      : entry
  );

  return {
    ...order,
    currentStepIndex: target.stepIndex,
    erpStatusCode: target.code,
    erpStatusLabel: target.label,
    timeline: updatedTimeline,
  };
}

/**
 * [INTEGRAÇÃO FUTURA ERP/WMS - CONFIRMAÇÃO DE ENTREGA]:
 * Monta o payload estruturado de confirmação de recebimento pelo cliente para
 * futuro envio ao ERP/WMS, permitindo que a equipe interna visualize a confirmação.
 */
export function buildErpDeliveryConfirmationPayload(
  order: Order,
  confirmedAtIso: string
): ErpDeliveryConfirmationPayload {
  const previousDef = getErpDefinitionByStep(order.currentStepIndex);
  return {
    schemaVersion: '1.0',
    eventType: 'CUSTOMER_DELIVERY_CONFIRMED',
    targetModule: 'Pedidos de Clientes',
    integrationStatus: 'pending_erp_connection',
    orderId: order.id,
    orderReference: order.code,
    customerId: order.customerId,
    customerEmail: order.customerSnapshot.email,
    previousStatus: getOrderCurrentStatus(order),
    previousErpCode: previousDef.code,
    newStatus: CLIENT_DELIVERY_CONFIRMED_STATUS,
    newErpCode: 'ENTREGA_CONFIRMADA_CLIENTE',
    confirmedAt: confirmedAtIso,
  };
}

/**
 * [INTEGRAÇÃO FUTURA ERP/WMS - DISPARO DA CONFIRMAÇÃO DE ENTREGA]:
 * Nesta etapa preparatória, não realiza chamadas externas ao ERP/WMS.
 * Quando a integração for conectada, este método enviará o evento
 * `CUSTOMER_DELIVERY_CONFIRMED` para o endpoint oficial do ERP/WMS.
 */
export function queueDeliveryConfirmationForErpSync(
  _payload: ErpDeliveryConfirmationPayload
): { queued: false; status: 'pending_erp_connection'; message: string } {
  return {
    queued: false,
    status: 'pending_erp_connection',
    message:
      'Confirmação registrada localmente em modo demonstrativo e preparada para envio futuro ao ERP/WMS.',
  };
}

/**
 * Constrói o payload completo preparado para envio automático ao módulo
 * "Pedidos de Clientes" do ERP/WMS da Inside Ecobag quando a integração for configurada.
 */
export function buildErpOrderPayload(
  order: Omit<Order, 'erpPayload'>
): ErpOrderPayload {
  return {
    schemaVersion: '1.0',
    targetModule: 'Pedidos de Clientes',
    integrationStatus: 'pending_erp_connection',
    orderReference: order.code,
    createdAt: order.createdAt,
    customer: {
      id: order.customerId,
      name: order.customerSnapshot.name,
      email: order.customerSnapshot.email,
      phone: order.customerSnapshot.phone,
    },
    deliveryAddress: order.shippingAddress,
    items: order.items.map((item) => {
      const sizeSpec = BAG_SIZES[item.configuration.size];
      const uploadedFiles: Array<{
        elementId: string;
        type: 'print' | 'botton';
        dataUrl: string;
      }> = [];

      for (const el of item.configuration.elements) {
        if (el.type === 'print' && el.isCustomUpload) {
          uploadedFiles.push({
            elementId: el.id,
            type: 'print',
            dataUrl: el.imageUrl,
          });
        } else if (el.type === 'botton' && el.isCustomPhoto) {
          uploadedFiles.push({
            elementId: el.id,
            type: 'botton',
            dataUrl: el.imageUrl,
          });
        }
      }

      return {
        itemId: item.id,
        sku: `IE-ECO-${item.configuration.size}`,
        size: item.configuration.size,
        dimensionsCm: {
          width: sizeSpec.widthCm,
          height: sizeSpec.heightCm,
          depth: sizeSpec.depthCm,
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
        previewImageDataUrl: item.previewDataUrl,
        uploadedFiles,
        bag3DConfiguration: item.configuration,
      };
    }),
    financials: {
      productsSubtotal: order.pricing.subtotal,
      discountAmount: order.pricing.discountAmount,
      shippingFee: order.pricing.shippingFee,
      finalTotal: order.pricing.total,
      firstPurchasePromoUsed: order.pricing.firstPurchasePromoApplied,
    },
    payment: order.payment,
  };
}

/**
 * Ponto único de despacho para o futuro webhook/API do ERP/WMS.
 * Nesta etapa inicial, apenas registra a preparação do payload sem simular envio externo.
 */
export async function queueOrderForErpSync(
  _payload: ErpOrderPayload
): Promise<{ queued: false; status: 'pending_erp_connection'; message: string }> {
  return {
    queued: false,
    status: 'pending_erp_connection',
    message:
      'Estrutura preparada para envio automático ao módulo "Pedidos de Clientes" assim que a API do ERP/WMS for conectada.',
  };
}
