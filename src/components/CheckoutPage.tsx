import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Gift,
  Lock,
  MapPin,
  QrCode,
  Receipt,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { BAG_SIZES, formatBRL } from '../data/catalog';
import { apiClient, isNocoNotConfiguredError } from '../services/apiClient';
import { calculateOrderPricing } from '../services/promotionService';
import { storageService } from '../services/storageService';
import {
  Address,
  CartItem,
  CustomerProfile,
  Order,
  PaymentMethod,
} from '../types';
import { BrandLogo } from './BrandLogo';

interface CheckoutPageProps {
  items: CartItem[];
  customer: CustomerProfile | null;
  allOrders: Order[];
  onBackToCart: () => void;
  onCustomerAuthenticated: (customer: CustomerProfile) => void;
  onOrderConfirmed: (order: Order, updatedCustomer: CustomerProfile) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  customer,
  allOrders,
  onBackToCart,
  onCustomerAuthenticated,
  onOrderConfirmed,
}) => {
  // Auth / Identification mode
  const [authMode, setAuthMode] = useState<'register' | 'login'>(
    customer ? 'register' : 'register'
  );
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Customer form state
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [saveForFuture, setSaveForFuture] = useState(
    customer?.savedForFuture ?? true
  );

  // Address & Shipping state
  const defaultAddr =
    customer?.addresses.find((a) => a.isDefault) ?? customer?.addresses[0];
  const [cep, setCep] = useState(defaultAddr?.cep ?? '');
  const [street, setStreet] = useState(defaultAddr?.street ?? '');
  const [number, setNumber] = useState(defaultAddr?.number ?? '');
  const [complement, setComplement] = useState(defaultAddr?.complement ?? '');
  const [neighborhood, setNeighborhood] = useState(
    defaultAddr?.neighborhood ?? ''
  );
  const [city, setCity] = useState(defaultAddr?.city ?? '');
  const [stateUf, setStateUf] = useState(defaultAddr?.state ?? '');
  const [shippingCalculated, setShippingCalculated] = useState(
    Boolean(defaultAddr?.cep)
  );

  // Payment demo state (never stores full card data)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('credit_card_demo');
  const [cardDisplayLast4, setCardDisplayLast4] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [installments, setInstallments] = useState(1);

  const [formError, setFormError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const identifiedCustomer = useMemo(() => {
    if (customer) return customer;
    if (email.trim()) {
      return storageService.findCustomerByEmail(email);
    }
    return null;
  }, [customer, email]);

  const customerOrders = useMemo(() => {
    if (!identifiedCustomer) return [];
    return allOrders.filter((o) => o.customerId === identifiedCustomer.id);
  }, [identifiedCustomer, allOrders]);

  const currentAddress: Address = {
    id: defaultAddr?.id ?? `addr-${Date.now()}`,
    label: 'Endereço principal',
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state: stateUf,
    isDefault: true,
  };

  const hasAddressProvided =
    shippingCalculated &&
    cep.replace(/\D/g, '').length >= 8 &&
    street.trim().length > 1;

  const pricing = calculateOrderPricing({
    items,
    customer: identifiedCustomer,
    customerOrders,
    allOrders,
    emailToCheck: email,
    address: currentAddress,
    hasAddressProvided,
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim()) return;

    setIsLoggingIn(true);
    try {
      let found: CustomerProfile | null = null;
      try {
        const res = await apiClient.loginByEmail(loginEmail.trim());
        found = storageService.upsertCustomer(res.customer);
        storageService.mergeOrdersFromServer(res.orders);
      } catch (err) {
        if (isNocoNotConfiguredError(err)) {
          found = storageService.findCustomerByEmail(loginEmail);
        } else {
          setLoginError(
            err instanceof Error
              ? err.message
              : 'Nenhuma conta encontrada com este e-mail. Use a aba "Criar cadastro" abaixo.'
          );
          return;
        }
      }

      if (!found) {
        setLoginError(
          'Nenhuma conta encontrada com este e-mail. Use a aba "Criar cadastro" abaixo.'
        );
        return;
      }

      onCustomerAuthenticated(found);
      setName(found.name);
      setEmail(found.email);
      setPhone(found.phone);
      setSaveForFuture(found.savedForFuture);
      const addr = found.addresses.find((a) => a.isDefault) ?? found.addresses[0];
      if (addr) {
        setCep(addr.cep);
        setStreet(addr.street);
        setNumber(addr.number);
        setComplement(addr.complement ?? '');
        setNeighborhood(addr.neighborhood);
        setCity(addr.city);
        setStateUf(addr.state);
        setShippingCalculated(true);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCalculateShipping = () => {
    setFormError(null);
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length < 8 || !street.trim() || !city.trim() || !stateUf.trim()) {
      setFormError(
        'Preencha CEP (8 dígitos), rua, cidade e estado para calcular o frete.'
      );
      return;
    }
    setShippingCalculated(true);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormError('Informe nome, e-mail e telefone para concluir o pedido.');
      return;
    }

    if (
      cep.replace(/\D/g, '').length < 8 ||
      !street.trim() ||
      !number.trim() ||
      !neighborhood.trim() ||
      !city.trim() ||
      !stateUf.trim()
    ) {
      setFormError('Preencha todos os campos obrigatórios do endereço de entrega.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.createOrder({
        customer: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          savedForFuture: saveForFuture,
        },
        shippingAddress: {
          label: currentAddress.label,
          cep: currentAddress.cep,
          street: currentAddress.street,
          number: currentAddress.number,
          complement: currentAddress.complement,
          neighborhood: currentAddress.neighborhood,
          city: currentAddress.city,
          state: currentAddress.state,
          isDefault: currentAddress.isDefault,
        },
        items,
        payment: {
          method: paymentMethod,
          last4:
            paymentMethod === 'credit_card_demo'
              ? cardDisplayLast4.slice(-4) || '0000'
              : undefined,
          installments:
            paymentMethod === 'credit_card_demo' ? installments : undefined,
        },
      });

      onOrderConfirmed(response.order, response.customer);
      return;
    } catch (err) {
      if (!isNocoNotConfiguredError(err)) {
        setFormError(
          err instanceof Error
            ? err.message
            : 'Erro ao registrar pedido no servidor NocoDB.'
        );
        return;
      }
    } finally {
      setIsSubmitting(false);
    }

    // Fallback local apenas quando o NocoDB ainda não estiver configurado neste ambiente (HTTP 503)
    const finalPricing = calculateOrderPricing({
      items,
      customer: identifiedCustomer,
      customerOrders,
      allOrders,
      emailToCheck: email,
      address: currentAddress,
      hasAddressProvided: true,
    });

    const existingByEmail = storageService.findCustomerByEmail(email);
    const baseCustomer: CustomerProfile = existingByEmail
      ? {
          ...existingByEmail,
          name: name.trim(),
          phone: phone.trim(),
          savedForFuture: saveForFuture,
          addresses: existingByEmail.addresses.some(
            (a) =>
              a.cep === currentAddress.cep && a.number === currentAddress.number
          )
            ? existingByEmail.addresses
            : [
                ...existingByEmail.addresses.map((a) => ({
                  ...a,
                  isDefault: false,
                })),
                currentAddress,
              ],
        }
      : {
          id: `cust-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          savedForFuture: saveForFuture,
          hasUsedFirstPurchasePromo: false,
          addresses: [currentAddress],
          createdAt: new Date().toISOString(),
        };

    const savedCustomer = storageService.upsertCustomer(baseCustomer);

    const paymentLabel =
      paymentMethod === 'credit_card_demo'
        ? `Cartão de Crédito (Demonstrativo)${
            cardDisplayLast4 ? ` •••• ${cardDisplayLast4.slice(-4)}` : ''
          }`
        : paymentMethod === 'pix_demo'
          ? 'PIX Instantâneo (Demonstrativo)'
          : 'Boleto Bancário (Demonstrativo)';

    const nowIso = new Date().toISOString();
    const orderCode = `IE-${String(Math.floor(10000 + Math.random() * 89999))}`;

    const newOrder = storageService.createOrder({
      id: `ord-${Date.now()}`,
      code: orderCode,
      customerId: savedCustomer.id,
      customerSnapshot: {
        name: savedCustomer.name,
        email: savedCustomer.email,
        phone: savedCustomer.phone,
      },
      shippingAddress: currentAddress,
      items,
      pricing: {
        subtotal: finalPricing.subtotal,
        discountAmount: finalPricing.discountAmount,
        shippingFee: finalPricing.shippingFee,
        total: finalPricing.total,
        firstPurchasePromoApplied: finalPricing.isEligible,
      },
      payment: {
        method: paymentMethod,
        label: paymentLabel,
        last4:
          paymentMethod === 'credit_card_demo'
            ? cardDisplayLast4.slice(-4) || '0000'
            : undefined,
        installments:
          paymentMethod === 'credit_card_demo' ? installments : undefined,
        status: 'Aprovado (Demonstrativo)',
        paidAt: nowIso,
      },
      isDemonstrativeTracking: true,
      createdAt: nowIso,
    });

    const finalCustomer =
      storageService.markFirstPurchasePromoUsed(savedCustomer.id) ??
      savedCustomer;

    onOrderConfirmed(newOrder, finalCustomer);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181A1F]">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-6 border-b border-[#E5E2D8]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToCart}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A606B] hover:text-[#181A1F]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao carrinho</span>
          </button>
          <span className="h-4 w-px bg-[#DBD6BE]" />
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-[#5A606B]">
          <Lock className="w-3.5 h-3.5 text-[#536895]" />
          <span>Finalização demonstrativa</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 sm:py-10">
        <form
          onSubmit={handleConfirmOrder}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          {/* Coluna Esquerda: Cadastro/Login, Endereço/Frete e Pagamento */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Cadastro e Login */}
            <section className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-5 h-5 text-[#536895]" />
                  <h2 className="text-lg font-semibold text-[#181A1F]">
                    1. Identificação do cliente
                  </h2>
                </div>

                {!customer && (
                  <div className="flex gap-1 p-1 rounded-xl bg-[#F2EFE4]">
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        authMode === 'register'
                          ? 'bg-white text-[#181A1F] shadow-sm'
                          : 'text-[#5A606B]'
                      }`}
                    >
                      Criar cadastro
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        authMode === 'login'
                          ? 'bg-white text-[#181A1F] shadow-sm'
                          : 'text-[#5A606B]'
                      }`}
                    >
                      Já tenho conta
                    </button>
                  </div>
                )}
              </div>

              {authMode === 'login' && !customer ? (
                <div className="space-y-3 rounded-xl bg-[#FAF9F5] border border-[#E5E2D8] p-4">
                  <label className="block text-xs font-medium text-[#5A606B]">
                    Informe seu e-mail cadastrado
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="cliente@exemplo.com"
                      className="flex-1 rounded-xl border border-[#DBD6BE] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                    />
                    <button
                      type="button"
                      disabled={isLoggingIn}
                      onClick={handleLoginSubmit}
                      className="px-4 py-2.5 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D] disabled:opacity-60"
                    >
                      {isLoggingIn ? 'Buscando...' : 'Entrar'}
                    </button>
                  </div>
                  {loginError && (
                    <p className="text-xs text-red-700">{loginError}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Maria Silva"
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="maria@exemplo.com"
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Telefone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                    />
                  </div>
                  <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-[#2D3139] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveForFuture}
                      onChange={(e) => setSaveForFuture(e.target.checked)}
                      className="rounded accent-[#536895]"
                    />
                    Salvar meus dados para futuras compras
                  </label>
                </div>
              )}
            </section>

            {/* 2. Endereço e Frete */}
            <section className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-5 h-5 text-[#536895]" />
                  <h2 className="text-lg font-semibold text-[#181A1F]">
                    2. Endereço de entrega e frete
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-[#5A606B]">
                  Simulação demonstrativa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    CEP *
                  </label>
                  <input
                    type="text"
                    required
                    value={cep}
                    onChange={(e) => {
                      setCep(e.target.value);
                      setShippingCalculated(false);
                    }}
                    placeholder="01310-100"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#536895]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Rua / Avenida *
                  </label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Av. Paulista"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="1000"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto 42"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    required
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bela Vista"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A606B] mb-1">
                    Estado (UF) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={stateUf}
                    onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm uppercase focus:outline-none focus:border-[#536895]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F2EFE4]">
                <button
                  type="button"
                  onClick={handleCalculateShipping}
                  className="px-4 py-2 rounded-xl border border-[#536895] text-xs font-semibold text-[#536895] hover:bg-[#536895]/8 transition-colors"
                >
                  Calcular frete
                </button>

                {hasAddressProvided ? (
                  <div className="text-xs text-[#181A1F]">
                    {pricing.freeShippingApplied ? (
                      <span className="font-semibold text-[#536895]">
                        Frete grátis aplicado na 1ª compra (R$ 0,00) · Prazo
                        simulado: 4 a 6 dias úteis
                      </span>
                    ) : (
                      <span>
                        Frete padrão simulado:{' '}
                        <strong className="font-mono">
                          {formatBRL(pricing.shippingFee)}
                        </strong>{' '}
                        · Prazo simulado: 4 a 6 dias úteis
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-[#5A606B]">
                    Informe seu endereço e clique em Calcular frete.
                  </span>
                )}
              </div>
            </section>

            {/* 3. Pagamento (Modo Demonstrativo) */}
            <section className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-[#536895]" />
                  <h2 className="text-lg font-semibold text-[#181A1F]">
                    3. Pagamento demonstrativo
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-[#5A606B]">
                  Sem cobrança real
                </span>
              </div>

              <div className="rounded-xl bg-[#F2EFE4] p-3 text-xs text-[#2D3139] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#536895] shrink-0 mt-0.5" />
                <span>
                  Ambiente em modo demonstrativo: nenhuma cobrança real será
                  efetuada e nenhum dado completo de cartão é armazenado.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: 'credit_card_demo',
                      label: 'Cartão (Demo)',
                      Icon: CreditCard,
                    },
                    { id: 'pix_demo', label: 'PIX (Demo)', Icon: QrCode },
                    {
                      id: 'boleto_demo',
                      label: 'Boleto (Demo)',
                      Icon: Receipt,
                    },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      paymentMethod === id
                        ? 'border-[#536895] bg-[#536895]/8 text-[#536895]'
                        : 'border-[#E5E2D8] text-[#5A606B] hover:border-[#DBD6BE]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'credit_card_demo' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Nome no cartão (opcional para demo)
                    </label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="MARIA SILVA"
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#536895]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      4 últimos dígitos (demo)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardDisplayLast4}
                      onChange={(e) =>
                        setCardDisplayLast4(e.target.value.replace(/\D/g, ''))
                      }
                      placeholder="4242"
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#536895]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Parcelamento simulado
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs focus:outline-none focus:border-[#536895]"
                    >
                      <option value={1}>
                        1x de {formatBRL(pricing.total)} sem juros
                      </option>
                      <option value={2}>
                        2x de {formatBRL(pricing.total / 2)} sem juros
                      </option>
                      <option value={3}>
                        3x de {formatBRL(pricing.total / 3)} sem juros
                      </option>
                    </select>
                  </div>
                </div>
              )}

              {paymentMethod === 'pix_demo' && (
                <div className="rounded-xl border border-[#E5E2D8] bg-[#FAF9F5] p-4 text-xs text-[#5A606B]">
                  Ao confirmar, o pagamento via PIX será aprovado imediatamente
                  em modo demonstrativo.
                </div>
              )}

              {paymentMethod === 'boleto_demo' && (
                <div className="rounded-xl border border-[#E5E2D8] bg-[#FAF9F5] p-4 text-xs text-[#5A606B]">
                  Ao confirmar, o pedido será registrado com compensação
                  demonstrativa imediata.
                </div>
              )}
            </section>
          </div>

          {/* Coluna Direita: Revisão Final do Pedido */}
          <aside className="lg:col-span-5 rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5 sticky top-6">
            <h2 className="text-lg font-semibold text-[#181A1F]">
              Revisão do pedido
            </h2>

            {/* Itens */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 pb-3 border-b border-[#F2EFE4]"
                >
                  <img
                    src={item.previewDataUrl}
                    alt={`Ecobag ${item.configuration.size}`}
                    className="w-14 h-14 rounded-lg bg-[#F2EFE4] object-contain p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#181A1F] truncate">
                      {BAG_SIZES[item.configuration.size].name}
                    </p>
                    <p className="text-[11px] text-[#5A606B]">
                      Qtd: {item.quantity} × {formatBRL(item.unitPrice)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold font-mono tabular-nums">
                    {formatBRL(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Promoção de Primeira Compra */}
            {pricing.isEligible ? (
              <div className="rounded-xl bg-[#536895]/8 border border-[#536895]/25 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#536895]">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>Sua primeira compra tem vantagens!</span>
                </div>
                <ul className="text-xs text-[#181A1F] space-y-1 pl-6 list-disc">
                  <li>Desconto de 5% aplicado.</li>
                  <li>Frete grátis aplicado.</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-xl bg-[#F2EFE4] p-3 text-xs text-[#5A606B]">
                {pricing.reason}
              </div>
            )}

            {/* 1. Subtotal, 2. Desconto, 3. Frete, 4. Total final */}
            <div className="space-y-2.5 text-sm pt-1">
              <div className="flex justify-between">
                <span className="text-[#5A606B]">
                  1. Subtotal dos produtos
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatBRL(pricing.subtotal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#5A606B]">2. Desconto de 5%</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    pricing.discountAmount > 0
                      ? 'text-[#536895]'
                      : 'text-[#5A606B]'
                  }`}
                >
                  {pricing.discountAmount > 0
                    ? `-${formatBRL(pricing.discountAmount)}`
                    : formatBRL(0)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#5A606B]">3. Frete</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    pricing.freeShippingApplied
                      ? 'text-[#536895] font-semibold'
                      : 'text-[#181A1F]'
                  }`}
                >
                  {pricing.freeShippingApplied
                    ? `${formatBRL(0)} (Grátis)`
                    : hasAddressProvided
                      ? formatBRL(pricing.shippingFee)
                      : `${formatBRL(pricing.shippingFee)} (estimado)`}
                </span>
              </div>

              <div className="pt-3 border-t border-[#E5E2D8] flex justify-between items-baseline">
                <span className="font-semibold text-[#181A1F]">
                  4. Total final
                </span>
                <span className="text-2xl font-semibold text-[#181A1F] font-mono tabular-nums">
                  {formatBRL(pricing.total)}
                </span>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 rounded-xl bg-[#536895] text-white text-sm font-semibold hover:bg-[#41547D] transition-colors inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Confirmando pedido...'
                  : 'Confirmar pedido (demonstrativo)'}
              </span>
            </button>
          </aside>
        </form>
      </main>
    </div>
  );
};
