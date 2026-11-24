import {
  CLIENT_DELIVERY_CONFIRMED_STATUS,
  ORDER_TIMELINE_STEPS,
} from '../data/catalog';
import {
  Address,
  BagConfiguration,
  CartItem,
  ComplaintTicket,
  CustomerProfile,
  Order,
  OrderDeliveryConfirmation,
  OrderTimelineEntry,
} from '../types';
import {
  buildErpDeliveryConfirmationPayload,
  buildErpOrderPayload,
  buildErpTimelineFromStep,
  canCustomerConfirmDelivery,
  getErpDefinitionByStep,
  normalizeOrderForErpView,
  queueDeliveryConfirmationForErpSync,
} from './erpService';

const KEYS = {
  CART: 'inside_ecobag_cart_v1',
  DRAFT_BAG: 'inside_ecobag_draft_v1',
  CUSTOMERS: 'inside_ecobag_customers_v1',
  ACTIVE_CUSTOMER_ID: 'inside_ecobag_active_customer_v1',
  ORDERS: 'inside_ecobag_orders_v1',
  COMPLAINTS: 'inside_ecobag_complaints_v1',
  DEMO_ERP_STATE: 'inside_ecobag_demo_erp_state_v1',
};

interface DemoErpOverlayState {
  currentStepIndex?: number;
  deliveryConfirmation?: OrderDeliveryConfirmation;
}

function getOverlayKey(order: Pick<Order, 'id' | 'code'>): string {
  return order.code || order.id;
}

function readDemoErpOverlayMap(): Record<string, DemoErpOverlayState> {
  return safeRead<Record<string, DemoErpOverlayState>>(KEYS.DEMO_ERP_STATE, {});
}

function writeDemoErpOverlay(
  order: Pick<Order, 'id' | 'code'>,
  patch: DemoErpOverlayState
): void {
  const map = readDemoErpOverlayMap();
  const key = getOverlayKey(order);
  map[key] = {
    ...(map[key] ?? {}),
    ...patch,
  };
  safeWrite(KEYS.DEMO_ERP_STATE, map);
}

function applyOverlayAndNormalize(
  rawOrder: Order,
  overlayMap: Record<string, DemoErpOverlayState>
): Order {
  const normalized = normalizeOrderForErpView(rawOrder);
  const overlay =
    overlayMap[normalized.code] ?? overlayMap[normalized.id] ?? undefined;
  if (!overlay) return normalized;

  const mergedStep =
    typeof overlay.currentStepIndex === 'number'
      ? Math.max(normalized.currentStepIndex, overlay.currentStepIndex)
      : normalized.currentStepIndex;
  const mergedConfirmation =
    normalized.deliveryConfirmation ?? overlay.deliveryConfirmation;

  return normalizeOrderForErpView({
    ...normalized,
    currentStepIndex: mergedStep,
    deliveryConfirmation: mergedConfirmation,
  });
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Handle storage quota gracefully
  }
}

export function createTimelineFromStep(
  activeStepIndex: number,
  createdAtIso: string,
  deliveryConfirmation?: OrderDeliveryConfirmation,
  existingTimeline?: OrderTimelineEntry[]
): OrderTimelineEntry[] {
  return buildErpTimelineFromStep(
    activeStepIndex,
    createdAtIso,
    deliveryConfirmation,
    'erp_wms_demo',
    existingTimeline
  );
}

/**
 * Serviço de persistência temporária separado da camada de UI.
 * Preparado para futura substituição por chamadas à API do NocoDB da Inside Ecobag.
 */
export const storageService = {
  // --- Draft Bag ---
  getDraftBag(): BagConfiguration | null {
    return safeRead<BagConfiguration | null>(KEYS.DRAFT_BAG, null);
  },

  saveDraftBag(config: BagConfiguration): void {
    safeWrite(KEYS.DRAFT_BAG, config);
  },

  // --- Cart ---
  getCart(): CartItem[] {
    return safeRead<CartItem[]>(KEYS.CART, []);
  },

  saveCart(items: CartItem[]): void {
    safeWrite(KEYS.CART, items);
  },

  clearCart(): void {
    safeWrite(KEYS.CART, []);
  },

  // --- Customers ---
  getCustomers(): CustomerProfile[] {
    return safeRead<CustomerProfile[]>(KEYS.CUSTOMERS, []);
  },

  getActiveCustomer(): CustomerProfile | null {
    const activeId = safeRead<string | null>(KEYS.ACTIVE_CUSTOMER_ID, null);
    if (!activeId) return null;
    const customers = this.getCustomers();
    return customers.find((c) => c.id === activeId) ?? null;
  },

  setActiveCustomer(customerId: string | null): void {
    safeWrite(KEYS.ACTIVE_CUSTOMER_ID, customerId);
  },

  upsertCustomer(profile: CustomerProfile): CustomerProfile {
    const customers = this.getCustomers();
    const incomingEmail = (profile.email ?? '').trim().toLowerCase();
    const idx = customers.findIndex(
      (c) =>
        c.id === profile.id ||
        (Boolean(incomingEmail) &&
          (c.email ?? '').trim().toLowerCase() === incomingEmail)
    );
    let updated: CustomerProfile;
    if (idx >= 0) {
      updated = {
        ...customers[idx],
        ...profile,
        id: customers[idx].id,
        hasUsedFirstPurchasePromo:
          customers[idx].hasUsedFirstPurchasePromo ||
          profile.hasUsedFirstPurchasePromo,
      };
      customers[idx] = updated;
    } else {
      updated = profile;
      customers.push(updated);
    }
    safeWrite(KEYS.CUSTOMERS, customers);
    this.setActiveCustomer(updated.id);
    return updated;
  },

  findCustomerByEmail(email: string): CustomerProfile | null {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized) return null;
    return (
      this.getCustomers().find(
        (c) => (c.email ?? '').trim().toLowerCase() === normalized
      ) ?? null
    );
  },

  markFirstPurchasePromoUsed(customerId: string): CustomerProfile | null {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx < 0) return null;
    customers[idx] = {
      ...customers[idx],
      hasUsedFirstPurchasePromo: true,
    };
    safeWrite(KEYS.CUSTOMERS, customers);
    return customers[idx];
  },

  saveCustomerAddress(customerId: string, address: Address): CustomerProfile | null {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx < 0) return null;
    const existing = customers[idx].addresses;
    const nextAddresses = existing.some((a) => a.id === address.id)
      ? existing.map((a) =>
          a.id === address.id
            ? address
            : address.isDefault
              ? { ...a, isDefault: false }
              : a
        )
      : [
          ...existing.map((a) =>
            address.isDefault ? { ...a, isDefault: false } : a
          ),
          address,
        ];
    customers[idx] = {
      ...customers[idx],
      addresses: nextAddresses,
    };
    safeWrite(KEYS.CUSTOMERS, customers);
    return customers[idx];
  },

  deleteCustomerAddress(customerId: string, addressId: string): CustomerProfile | null {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx < 0) return null;
    const filtered = customers[idx].addresses.filter((a) => a.id !== addressId);
    if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
      filtered[0].isDefault = true;
    }
    customers[idx] = {
      ...customers[idx],
      addresses: filtered,
    };
    safeWrite(KEYS.CUSTOMERS, customers);
    return customers[idx];
  },

  // --- Orders ---
  getAllOrders(): Order[] {
    const overlayMap = readDemoErpOverlayMap();
    return safeRead<Order[]>(KEYS.ORDERS, []).map((order) =>
      applyOverlayAndNormalize(order, overlayMap)
    );
  },

  getOrdersByCustomer(customerId: string): Order[] {
    return this.getAllOrders().filter((o) => o.customerId === customerId);
  },

  createOrder(
    orderInput: Omit<Order, 'erpPayload' | 'timeline' | 'currentStepIndex'>
  ): Order {
    const orders = this.getAllOrders();
    const initialStep = 0; // 'Pedido recebido'
    const def = getErpDefinitionByStep(initialStep);
    const timeline = createTimelineFromStep(initialStep, orderInput.createdAt);
    const baseOrder: Omit<Order, 'erpPayload'> = {
      ...orderInput,
      currentStepIndex: initialStep,
      erpStatusCode: def.code,
      erpStatusLabel: def.label,
      timeline,
    };
    const fullOrder: Order = {
      ...baseOrder,
      erpPayload: buildErpOrderPayload(baseOrder),
    };
    orders.unshift(fullOrder);
    safeWrite(KEYS.ORDERS, orders);
    return fullOrder;
  },

  advanceDemoOrderStep(orderId: string): Order | null {
    const orders = this.getAllOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const current = orders[idx];
    if (current.deliveryConfirmation?.confirmed) {
      return current;
    }

    const nextStep = Math.min(
      ORDER_TIMELINE_STEPS.length - 1,
      current.currentStepIndex + 1
    );
    const def = getErpDefinitionByStep(nextStep);
    const updatedOrder: Order = {
      ...current,
      currentStepIndex: nextStep,
      erpStatusCode: def.code,
      erpStatusLabel: def.label,
      timeline: createTimelineFromStep(
        nextStep,
        current.createdAt,
        current.deliveryConfirmation,
        current.timeline
      ),
    };

    orders[idx] = updatedOrder;
    safeWrite(KEYS.ORDERS, orders);
    writeDemoErpOverlay(updatedOrder, { currentStepIndex: nextStep });
    return updatedOrder;
  },

  /**
   * Registra a confirmação de recebimento feita pelo cliente (regra: permitido
   * apenas quando em "Saiu para entrega" ou "Entregue", nunca duplicado).
   * Prepara o payload de comunicação futura com o ERP/WMS sem enviar chamada externa.
   */
  confirmOrderDelivery(orderId: string): {
    order: Order | null;
    alreadyConfirmed: boolean;
    syncMessage?: string;
  } {
    const orders = this.getAllOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx < 0) {
      return { order: null, alreadyConfirmed: false };
    }

    const current = orders[idx];
    if (current.deliveryConfirmation?.confirmed) {
      return { order: current, alreadyConfirmed: true };
    }

    if (!canCustomerConfirmDelivery(current)) {
      return { order: current, alreadyConfirmed: false };
    }

    const confirmedAtIso = new Date().toISOString();
    const erpPreparedPayload = buildErpDeliveryConfirmationPayload(
      current,
      confirmedAtIso
    );
    const syncResult = queueDeliveryConfirmationForErpSync(erpPreparedPayload);

    const confirmation: OrderDeliveryConfirmation = {
      confirmed: true,
      statusLabel: CLIENT_DELIVERY_CONFIRMED_STATUS,
      confirmedAt: confirmedAtIso,
      previousStatus: erpPreparedPayload.previousStatus,
      erpSyncStatus: 'pending_erp_connection',
      erpPreparedPayload,
    };

    const updatedOrder: Order = {
      ...current,
      erpStatusCode: 'ENTREGA_CONFIRMADA_CLIENTE',
      erpStatusLabel: CLIENT_DELIVERY_CONFIRMED_STATUS,
      deliveryConfirmation: confirmation,
      timeline: buildErpTimelineFromStep(
        current.currentStepIndex,
        current.createdAt,
        confirmation,
        'erp_wms_demo',
        current.timeline
      ),
    };

    orders[idx] = updatedOrder;
    safeWrite(KEYS.ORDERS, orders);
    writeDemoErpOverlay(updatedOrder, {
      currentStepIndex: updatedOrder.currentStepIndex,
      deliveryConfirmation: confirmation,
    });

    return {
      order: updatedOrder,
      alreadyConfirmed: false,
      syncMessage: syncResult.message,
    };
  },

  upsertOrderFromServer(order: Order): Order {
    const overlayMap = readDemoErpOverlayMap();
    const normalized = applyOverlayAndNormalize(order, overlayMap);
    const orders = this.getAllOrders();
    const idx = orders.findIndex(
      (o) => o.id === normalized.id || o.code === normalized.code
    );
    if (idx >= 0) {
      orders[idx] = normalized;
    } else {
      orders.unshift(normalized);
    }
    safeWrite(KEYS.ORDERS, orders);
    return normalized;
  },

  mergeOrdersFromServer(serverOrders: Order[]): Order[] {
    const overlayMap = readDemoErpOverlayMap();
    const orders = this.getAllOrders();
    const byKey = new Map<string, Order>();
    for (const o of orders) {
      byKey.set(o.code || o.id, o);
    }
    for (const s of serverOrders) {
      const key = s.code || s.id;
      const existing = byKey.get(key);
      const mergedCandidate: Order = existing
        ? {
            ...s,
            currentStepIndex: Math.max(
              s.currentStepIndex,
              existing.currentStepIndex
            ),
            deliveryConfirmation:
              s.deliveryConfirmation ?? existing.deliveryConfirmation,
          }
        : s;
      byKey.set(key, applyOverlayAndNormalize(mergedCandidate, overlayMap));
    }
    const merged = Array.from(byKey.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    safeWrite(KEYS.ORDERS, merged);
    return merged;
  },

  // --- Complaints ---
  getComplaintsByCustomer(customerId: string): ComplaintTicket[] {
    return safeRead<ComplaintTicket[]>(KEYS.COMPLAINTS, []).filter(
      (t) => t.customerId === customerId
    );
  },

  createComplaint(ticket: ComplaintTicket): ComplaintTicket {
    const all = safeRead<ComplaintTicket[]>(KEYS.COMPLAINTS, []);
    all.unshift(ticket);
    safeWrite(KEYS.COMPLAINTS, all);
    return ticket;
  },
};
