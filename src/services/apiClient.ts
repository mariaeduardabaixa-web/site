import {
  Address,
  BagSizeId,
  BagSizeSpec,
  CartItem,
  CustomerProfile,
  Order,
  PaymentMethod,
} from '../types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export function isNocoNotConfiguredError(err: unknown): boolean {
  return (
    err instanceof ApiClientError &&
    (err.code === 'NOCODB_NOT_CONFIGURED' || err.status === 503)
  );
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError(
      'Não foi possível conectar ao servidor da aplicação.',
      503,
      'NETWORK_ERROR'
    );
  }

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const obj =
      typeof data === 'object' && data !== null
        ? (data as { error?: string; code?: string })
        : {};
    throw new ApiClientError(
      obj.error || `Erro HTTP ${response.status}`,
      response.status,
      obj.code
    );
  }

  return data as T;
}

type ProdutosResponse = {
  source: 'nocodb' | 'fallback';
  sizes: Record<BagSizeId, BagSizeSpec>;
};
type LoginResponse = {
  customer: CustomerProfile;
  orders: Order[];
};

let inFlightProdutos: Promise<ProdutosResponse> | null = null;
const inFlightLogins = new Map<string, Promise<LoginResponse>>();
const inFlightOrders = new Map<string, Promise<{ orders: Order[] }>>();

export const apiClient = {
  async getProdutos(): Promise<ProdutosResponse> {
    if (!inFlightProdutos) {
      inFlightProdutos = apiFetch<ProdutosResponse>('/api/produtos').finally(
        () => {
          inFlightProdutos = null;
        }
      );
    }
    return inFlightProdutos;
  },

  async loginByEmail(email: string): Promise<LoginResponse> {
    const safeEmail = (email ?? '').trim().toLowerCase();
    const existing = inFlightLogins.get(safeEmail);
    if (existing) return existing;

    const promise = apiFetch<LoginResponse>('/api/clientes/login', {
      method: 'POST',
      body: JSON.stringify({ email: safeEmail }),
    }).finally(() => {
      inFlightLogins.delete(safeEmail);
    });
    inFlightLogins.set(safeEmail, promise);
    return promise;
  },

  async upsertCustomer(input: {
    name: string;
    email: string;
    phone: string;
    savedForFuture?: boolean;
  }): Promise<{ customer: CustomerProfile }> {
    return apiFetch('/api/clientes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateCustomer(
    id: string,
    input: { name: string; phone: string }
  ): Promise<{ customer: CustomerProfile }> {
    return apiFetch(`/api/clientes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async createAddress(input: {
    customerId: string;
    customerEmail?: string;
    label: string;
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    isDefault: boolean;
  }): Promise<{ address: Address }> {
    return apiFetch('/api/enderecos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async deleteAddress(addressId: string): Promise<{ ok: boolean; id: string }> {
    return apiFetch(`/api/enderecos/${encodeURIComponent(addressId)}`, {
      method: 'DELETE',
    });
  },

  async getOrdersByCustomer(
    customerId: string,
    email?: string
  ): Promise<{ orders: Order[] }> {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (email) params.set('email', email);
    const key = params.toString();
    const existing = inFlightOrders.get(key);
    if (existing) return existing;

    const promise = apiFetch<{ orders: Order[] }>(`/api/pedidos?${key}`).finally(
      () => {
        inFlightOrders.delete(key);
      }
    );
    inFlightOrders.set(key, promise);
    return promise;
  },

  async createOrder(input: {
    customer: {
      name: string;
      email: string;
      phone: string;
      savedForFuture: boolean;
    };
    shippingAddress: Omit<Address, 'id'>;
    items: CartItem[];
    payment: {
      method: PaymentMethod;
      last4?: string;
      installments?: number;
    };
  }): Promise<{ order: Order; customer: CustomerProfile }> {
    return apiFetch('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async advanceOrderStep(
    orderId: string,
    stepIndex: number
  ): Promise<{ ok: boolean; id: string; currentStepIndex: number; status: string }> {
    return apiFetch(`/api/pedidos/${encodeURIComponent(orderId)}/etapa`, {
      method: 'PATCH',
      body: JSON.stringify({ stepIndex }),
    });
  },
};
