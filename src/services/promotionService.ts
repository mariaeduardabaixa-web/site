import {
  Address,
  CartItem,
  CustomerProfile,
  Order,
  PromotionCalculation,
} from '../types';

/**
 * Simulates freight calculation based on CEP/UF for demonstrative mode.
 * Clearly identified as a simulation until real carrier integration is connected.
 */
export function simulateShippingFee(address: Partial<Address> | null): number {
  if (!address || !address.cep) {
    return 18.9;
  }
  const digits = address.cep.replace(/\D/g, '');
  if (digits.length < 2) return 18.9;

  const firstDigit = Number(digits[0]);
  // Realistic demonstrative Brazilian postal zone fee table
  if (firstDigit <= 1) return 14.9; // SP capital / interior
  if (firstDigit <= 3) return 18.9; // RJ / ES / MG
  if (firstDigit <= 5) return 21.5; // BA / SE / PE / AL / PB / RN / CE / PI / MA
  if (firstDigit <= 7) return 23.9; // DF / GO / TO / MT / MS / RO / AC / AM / RR / PA / AP
  return 19.9; // PR / SC / RS
}

/**
 * Checks if a customer is eligible for the mandatory first-purchase promotion:
 * "5% DE DESCONTO + FRETE GRÁTIS NA PRIMEIRA COMPRA"
 */
export function checkFirstPurchaseEligibility(
  customer: CustomerProfile | null,
  customerOrders: Order[],
  emailToCheck?: string,
  allOrders?: Order[]
): { eligible: boolean; reason: string } {
  // Check by authenticated/identified customer record
  if (customer) {
    if (customer.hasUsedFirstPurchasePromo) {
      return {
        eligible: false,
        reason: 'Benefício de primeira compra já utilizado nesta conta.',
      };
    }
    const paidOrdersForCustomer = customerOrders.filter(
      (o) => o.customerId === customer.id
    );
    if (paidOrdersForCustomer.length > 0) {
      return {
        eligible: false,
        reason: 'Já existe pedido confirmado no histórico desta conta.',
      };
    }
    return {
      eligible: true,
      reason: 'Cliente elegível para 5% de desconto + frete grátis na primeira compra.',
    };
  }

  // If guest typed an email at checkout, verify against existing order history
  if (emailToCheck && allOrders) {
    const normalized = (emailToCheck ?? '').trim().toLowerCase();
    const priorByEmail = normalized
      ? allOrders.find(
          (o) =>
            (o.customerSnapshot?.email ?? '').trim().toLowerCase() === normalized
        )
      : undefined;
    if (priorByEmail) {
      return {
        eligible: false,
        reason: 'Este e-mail já possui uma compra confirmada anteriormente.',
      };
    }
  }

  return {
    eligible: true,
    reason: 'Primeira compra elegível para 5% de desconto + frete grátis.',
  };
}

/**
 * Computes cart & checkout totals applying the automatic first-purchase promotion
 * (5% product discount + R$ 0,00 shipping) when eligible, and normal shipping otherwise.
 */
export function calculateOrderPricing(params: {
  items: CartItem[];
  customer: CustomerProfile | null;
  customerOrders: Order[];
  allOrders?: Order[];
  emailToCheck?: string;
  address: Partial<Address> | null;
  hasAddressProvided: boolean;
}): PromotionCalculation {
  const {
    items,
    customer,
    customerOrders,
    allOrders,
    emailToCheck,
    address,
    hasAddressProvided,
  } = params;

  const rawSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.unitPrice) * Math.max(1, item.quantity),
    0
  );
  const subtotal = Math.round(rawSubtotal * 100) / 100;

  if (subtotal <= 0) {
    return {
      isEligible: false,
      subtotal: 0,
      discountRate: 0,
      discountAmount: 0,
      shippingFee: 0,
      originalShippingFee: 0,
      freeShippingApplied: false,
      total: 0,
      reason: 'Carrinho vazio.',
    };
  }

  const eligibility = checkFirstPurchaseEligibility(
    customer,
    customerOrders,
    emailToCheck,
    allOrders
  );

  const simulatedFreight = hasAddressProvided ? simulateShippingFee(address) : 18.9;
  const discountRate = eligibility.eligible ? 0.05 : 0;
  const discountAmount = eligibility.eligible
    ? Math.round(subtotal * 0.05 * 100) / 100
    : 0;

  const shippingFee = eligibility.eligible ? 0 : simulatedFreight;
  const freeShippingApplied = eligibility.eligible;

  // Guard strictly against negative values
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const total = Math.max(
    0,
    Math.round((discountedSubtotal + shippingFee) * 100) / 100
  );

  return {
    isEligible: eligibility.eligible,
    subtotal,
    discountRate,
    discountAmount,
    shippingFee,
    originalShippingFee: simulatedFreight,
    freeShippingApplied,
    total,
    reason: eligibility.reason,
  };
}
