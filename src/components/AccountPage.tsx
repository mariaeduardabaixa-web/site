import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gift,
  LogOut,
  MapPin,
  MessageSquareWarning,
  Package,
  PackageCheck,
  Paperclip,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import {
  BAG_SIZES,
  COMPLAINT_REASONS,
  ORDER_TIMELINE_STEPS,
  formatBRL,
} from '../data/catalog';
import {
  ApiClientError,
  apiClient,
  isNocoNotConfiguredError,
} from '../services/apiClient';
import {
  canCustomerConfirmDelivery,
  getOrderCurrentStatus,
} from '../services/erpService';
import { storageService } from '../services/storageService';
import {
  Address,
  ComplaintReason,
  ComplaintTicket,
  CustomerProfile,
  Order,
} from '../types';
import { BrandLogo } from './BrandLogo';

export type AccountTab =
  | 'profile'
  | 'addresses'
  | 'orders'
  | 'support';

interface AccountPageProps {
  customer: CustomerProfile | null;
  orders: Order[];
  complaints: ComplaintTicket[];
  initialTab?: AccountTab;
  highlightedOrderId?: string | null;
  onBackHome: () => void;
  onStartPersonalize: () => void;
  onCustomerChange: (customer: CustomerProfile | null) => void;
  onOrdersChange: () => void;
  onComplaintsChange: () => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler anexo'));
    reader.readAsDataURL(file);
  });
}

function formatDateTimeBR(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const datePart = date.toLocaleDateString('pt-BR');
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  customer,
  orders,
  complaints,
  initialTab = 'orders',
  highlightedOrderId = null,
  onBackHome,
  onStartPersonalize,
  onCustomerChange,
  onOrdersChange,
  onComplaintsChange,
}) => {
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    highlightedOrderId ?? orders[0]?.id ?? null
  );

  // Quick login / register inside Account area if not signed in
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Profile edit
  const [editName, setEditName] = useState(customer?.name ?? '');
  const [editPhone, setEditPhone] = useState(customer?.phone ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  // New Address
  const [newLabel, setNewLabel] = useState('Casa');
  const [newCep, setNewCep] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');

  // Support / Complaint form
  const [ticketOrderCode, setTicketOrderCode] = useState(
    orders[0]?.code ?? ''
  );
  const [ticketReason, setTicketReason] =
    useState<ComplaintReason>('Defeito no produto');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketFiles, setTicketFiles] = useState<
    Array<{ name: string; dataUrl: string }>
  >([]);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Confirmação de recebimento pelo cliente (preparada para ERP/WMS)
  const [confirmDeliveryOrder, setConfirmDeliveryOrder] =
    useState<Order | null>(null);
  const [deliveryConfirmSuccess, setDeliveryConfirmSuccess] = useState<{
    orderId: string;
    orderCode: string;
    confirmedAt: string;
    message: string;
  } | null>(null);

  const selectedOrder =
    orders.find((o) => o.id === selectedOrderId) ?? orders[0] ?? null;

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail.trim()) return;

    setAuthBusy(true);
    try {
      try {
        const res = await apiClient.loginByEmail(authEmail.trim());
        const synced = storageService.upsertCustomer(res.customer);
        storageService.mergeOrdersFromServer(res.orders);
        onOrdersChange();
        onCustomerChange(synced);
        setEditName(synced.name);
        setEditPhone(synced.phone);
        return;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          if (!authName.trim() || !authPhone.trim()) {
            setAuthError(
              'E-mail não cadastrado ainda. Informe também nome e telefone para criar sua conta.'
            );
            return;
          }
          const createdRes = await apiClient.upsertCustomer({
            name: authName.trim(),
            email: authEmail.trim(),
            phone: authPhone.trim(),
            savedForFuture: true,
          });
          const synced = storageService.upsertCustomer(createdRes.customer);
          onCustomerChange(synced);
          setEditName(synced.name);
          setEditPhone(synced.phone);
          return;
        }
        if (!isNocoNotConfiguredError(err)) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Não foi possível acessar sua conta no momento.'
          );
          return;
        }
      }

      // Fallback local caso NocoDB ainda não esteja configurado (503)
      const existing = storageService.findCustomerByEmail(authEmail);
      if (existing) {
        storageService.setActiveCustomer(existing.id);
        onCustomerChange(existing);
        setEditName(existing.name);
        setEditPhone(existing.phone);
        return;
      }

      if (!authName.trim() || !authPhone.trim()) {
        setAuthError(
          'E-mail não cadastrado ainda. Informe também nome e telefone para criar sua conta.'
        );
        return;
      }

      const created = storageService.upsertCustomer({
        id: `cust-${Date.now()}`,
        name: authName.trim(),
        email: authEmail.trim(),
        phone: authPhone.trim(),
        savedForFuture: true,
        hasUsedFirstPurchasePromo: false,
        addresses: [],
        createdAt: new Date().toISOString(),
      });
      onCustomerChange(created);
      setEditName(created.name);
      setEditPhone(created.phone);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const nextName = editName.trim() || customer.name;
    const nextPhone = editPhone.trim() || customer.phone;

    try {
      const res = await apiClient.updateCustomer(customer.id, {
        name: nextName,
        phone: nextPhone,
      });
      const synced = storageService.upsertCustomer(res.customer);
      onCustomerChange(synced);
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2200);
      return;
    } catch (err) {
      if (!isNocoNotConfiguredError(err)) {
        return;
      }
    }

    const updated = storageService.upsertCustomer({
      ...customer,
      name: nextName,
      phone: nextPhone,
    });
    onCustomerChange(updated);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2200);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !newCep.trim() || !newStreet.trim()) return;

    try {
      const res = await apiClient.createAddress({
        customerId: customer.id,
        customerEmail: customer.email,
        label: newLabel.trim() || 'Endereço',
        cep: newCep.trim(),
        street: newStreet.trim(),
        number: newNumber.trim(),
        neighborhood: newNeighborhood.trim(),
        city: newCity.trim(),
        state: newState.trim().toUpperCase(),
        isDefault: customer.addresses.length === 0,
      });
      const updated = storageService.saveCustomerAddress(
        customer.id,
        res.address
      );
      if (updated) onCustomerChange(updated);
    } catch (err) {
      if (!isNocoNotConfiguredError(err)) {
        return;
      }
      const addr: Address = {
        id: `addr-${Date.now()}`,
        label: newLabel.trim() || 'Endereço',
        cep: newCep.trim(),
        street: newStreet.trim(),
        number: newNumber.trim(),
        neighborhood: newNeighborhood.trim(),
        city: newCity.trim(),
        state: newState.trim().toUpperCase(),
        isDefault: customer.addresses.length === 0,
      };
      const updated = storageService.saveCustomerAddress(customer.id, addr);
      if (updated) onCustomerChange(updated);
    }

    setNewCep('');
    setNewStreet('');
    setNewNumber('');
    setNewNeighborhood('');
    setNewCity('');
    setNewState('');
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!customer) return;
    try {
      await apiClient.deleteAddress(addrId);
    } catch (err) {
      if (!isNocoNotConfiguredError(err)) return;
    }
    const updated = storageService.deleteCustomerAddress(customer.id, addrId);
    if (updated) onCustomerChange(updated);
  };

  // [INTEGRAÇÃO FUTURA ERP/WMS]: Quando o ERP/WMS estiver conectado, as atualizações
  // das 13 etapas virão automaticamente do sistema interno (via `applyErpStatusUpdateToOrder`).
  // Nesta etapa demonstrativa, avançamos o fluxo localmente e mantemos o NocoDB em melhor esforço.
  const handleAdvanceDemoTracking = async (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.deliveryConfirmation?.confirmed) return;

    const nextStep = Math.min(
      ORDER_TIMELINE_STEPS.length - 1,
      target.currentStepIndex + 1
    );

    if (nextStep <= 7) {
      try {
        await apiClient.advanceOrderStep(orderId, nextStep);
      } catch {
        // Mantém fluxo demonstrativo das etapas ERP/WMS sem alterar integrações existentes
      }
    }

    storageService.advanceDemoOrderStep(orderId);
    onOrdersChange();
  };

  // [INTEGRAÇÃO FUTURA ERP/WMS]: Ao confirmar o recebimento, grava data/hora localmente
  // e gera o payload `CUSTOMER_DELIVERY_CONFIRMED` pronto para disparo futuro ao ERP/WMS.
  const handleConfirmDelivery = (order: Order) => {
    const result = storageService.confirmOrderDelivery(order.id);
    setConfirmDeliveryOrder(null);

    if (!result.order) return;

    if (!result.alreadyConfirmed && result.order.deliveryConfirmation) {
      setDeliveryConfirmSuccess({
        orderId: result.order.id,
        orderCode: result.order.code,
        confirmedAt: result.order.deliveryConfirmation.confirmedAt,
        message:
          result.syncMessage ??
          'Recebimento confirmado com sucesso e preparado para registro futuro no ERP/WMS.',
      });
    }

    onOrdersChange();
  };

  const handleAttachImages = async (files: FileList | null) => {
    if (!files) return;
    const list: Array<{ name: string; dataUrl: string }> = [];
    for (const file of Array.from(files).slice(0, 4)) {
      const dataUrl = await fileToDataUrl(file);
      list.push({ name: file.name, dataUrl });
    }
    setTicketFiles((prev) => [...prev, ...list].slice(0, 4));
  };

  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !ticketDesc.trim()) return;
    const now = new Date().toISOString();
    storageService.createComplaint({
      id: `comp-${Date.now()}`,
      protocol: `ATD-${Math.floor(10000 + Math.random() * 89999)}`,
      customerId: customer.id,
      orderCode: ticketOrderCode || 'Sem pedido vinculado',
      reason: ticketReason,
      description: ticketDesc.trim(),
      attachments: ticketFiles,
      status: 'Solicitação recebida',
      updates: [
        {
          date: now,
          message:
            'Solicitação registrada com sucesso. Nossa equipe de qualidade analisará seu relato.',
        },
      ],
      createdAt: now,
    });
    setTicketDesc('');
    setTicketFiles([]);
    setTicketSuccess(true);
    onComplaintsChange();
    window.setTimeout(() => setTicketSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181A1F]">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-6 border-b border-[#E5E2D8]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A606B] hover:text-[#181A1F]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Início</span>
          </button>
          <span className="h-4 w-px bg-[#DBD6BE]" />
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onStartPersonalize}
            className="px-4 py-2 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D] transition-colors"
          >
            Nova ecobag
          </button>
          {customer && (
            <button
              type="button"
              onClick={() => {
                storageService.setActiveCustomer(null);
                onCustomerChange(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DBD6BE] bg-white text-xs font-medium text-[#5A606B] hover:text-[#181A1F]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 sm:py-10">
        {!customer ? (
          <div className="max-w-md mx-auto rounded-2xl bg-white border border-[#E5E2D8] p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <h1
                className="text-2xl font-semibold text-[#181A1F]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Área do cliente
              </h1>
              <p className="text-sm text-[#5A606B]">
                Entre com seu e-mail ou crie um cadastro para acompanhar pedidos
                e endereços.
              </p>
            </div>

            <form onSubmit={handleQuickAuth} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#5A606B] mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5A606B] mb-1">
                  Nome (se for novo cadastro)
                </label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Maria Silva"
                  className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5A606B] mb-1">
                  Telefone (se for novo cadastro)
                </label>
                <input
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-700">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-3 rounded-xl bg-[#536895] text-white text-sm font-semibold hover:bg-[#41547D] transition-colors disabled:opacity-60"
              >
                {authBusy ? 'Acessando...' : 'Acessar área do cliente'}
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Menu lateral da Área do Cliente */}
            <aside className="lg:col-span-3 rounded-2xl bg-white border border-[#E5E2D8] p-4 space-y-2">
              <div className="px-3 py-2 border-b border-[#F2EFE4]">
                <p className="text-sm font-semibold text-[#181A1F] truncate">
                  {customer.name}
                </p>
                <p className="text-xs text-[#5A606B] truncate">
                  {customer.email}
                </p>
              </div>

              {(
                [
                  { id: 'orders', label: 'Meus pedidos', Icon: Package },
                  { id: 'profile', label: 'Meu perfil', Icon: User },
                  { id: 'addresses', label: 'Meus endereços', Icon: MapPin },
                  {
                    id: 'support',
                    label: 'Atendimento e reclamações',
                    Icon: MessageSquareWarning,
                  },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                    tab === id
                      ? 'bg-[#536895] text-white'
                      : 'text-[#181A1F] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </aside>

            {/* Conteúdo Principal */}
            <div className="lg:col-span-9 space-y-6">
              {tab === 'profile' && (
                <section className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5">
                  <h2 className="text-xl font-semibold text-[#181A1F]">
                    Meu perfil
                  </h2>

                  <div className="rounded-xl bg-[#F2EFE4] p-4 flex items-start gap-3">
                    <Gift className="w-5 h-5 text-[#536895] shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-[#181A1F]">
                        Promoção de primeira compra (5% de desconto + frete grátis)
                      </p>
                      <p className="mt-0.5 text-[#5A606B]">
                        {customer.hasUsedFirstPurchasePromo || orders.length > 0
                          ? 'Benefício já utilizado em sua primeira compra confirmada. Nas compras seguintes, o frete é calculado normalmente.'
                          : 'Benefício disponível! Será aplicado automaticamente na finalização do seu primeiro pedido.'}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveProfile}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-[#5A606B] mb-1">
                        Nome completo
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5A606B] mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#5A606B] mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        disabled
                        value={customer.email}
                        className="w-full rounded-xl border border-[#E5E2D8] bg-[#F2EFE4]/60 px-3.5 py-2.5 text-sm text-[#5A606B]"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D]"
                      >
                        Salvar alterações
                      </button>
                      {profileSaved && (
                        <span className="text-xs font-medium text-[#536895]">
                          Perfil atualizado!
                        </span>
                      )}
                    </div>
                  </form>
                </section>
              )}

              {tab === 'addresses' && (
                <section className="space-y-6">
                  <div className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-[#181A1F]">
                      Meus endereços
                    </h2>
                    {customer.addresses.length === 0 ? (
                      <p className="text-sm text-[#5A606B]">
                        Nenhum endereço salvo ainda.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {customer.addresses.map((addr) => (
                          <div
                            key={addr.id}
                            className="rounded-xl border border-[#E5E2D8] bg-[#FAF9F5] p-4 flex justify-between gap-3"
                          >
                            <div className="text-xs space-y-1">
                              <p className="font-semibold text-[#181A1F]">
                                {addr.label}
                                {addr.isDefault ? ' · Padrão' : ''}
                              </p>
                              <p className="text-[#2D3139]">
                                {addr.street}, {addr.number}
                                {addr.complement ? ` (${addr.complement})` : ''}
                              </p>
                              <p className="text-[#5A606B]">
                                {addr.neighborhood} · {addr.city}/{addr.state}
                              </p>
                              <p className="font-mono text-[#5A606B]">
                                CEP {addr.cep}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 h-fit rounded-lg text-red-600 hover:bg-red-50"
                              aria-label="Excluir endereço"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleAddAddress}
                    className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-4"
                  >
                    <h3 className="text-base font-semibold text-[#181A1F] flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#536895]" />
                      Adicionar novo endereço
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Apelido (Casa, Trabalho)"
                        className="sm:col-span-2 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newCep}
                        onChange={(e) => setNewCep(e.target.value)}
                        placeholder="CEP *"
                        className="sm:col-span-2 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={newState}
                        maxLength={2}
                        onChange={(e) => setNewState(e.target.value)}
                        placeholder="UF *"
                        className="sm:col-span-2 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs uppercase"
                      />
                      <input
                        type="text"
                        required
                        value={newStreet}
                        onChange={(e) => setNewStreet(e.target.value)}
                        placeholder="Rua / Avenida *"
                        className="sm:col-span-4 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        placeholder="Número *"
                        className="sm:col-span-2 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newNeighborhood}
                        onChange={(e) => setNewNeighborhood(e.target.value)}
                        placeholder="Bairro *"
                        className="sm:col-span-3 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        placeholder="Cidade *"
                        className="sm:col-span-3 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D]"
                    >
                      Salvar endereço
                    </button>
                  </form>
                </section>
              )}

              {tab === 'orders' && (
                <section className="space-y-6">
                  {orders.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-[#E5E2D8] p-10 text-center space-y-3">
                      <ShoppingBag className="w-8 h-8 text-[#536895] mx-auto" />
                      <h2 className="text-lg font-semibold text-[#181A1F]">
                        Você ainda não possui pedidos
                      </h2>
                      <p className="text-sm text-[#5A606B]">
                        Crie sua primeira ecobag no estúdio 3D para aproveitar
                        5% de desconto + frete grátis.
                      </p>
                      <button
                        type="button"
                        onClick={onStartPersonalize}
                        className="px-5 py-2.5 rounded-xl bg-[#536895] text-white text-xs font-semibold"
                      >
                        Personalizar agora
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Lista de pedidos */}
                      <div className="rounded-2xl bg-white border border-[#E5E2D8] p-5 space-y-3">
                        <h2 className="text-lg font-semibold text-[#181A1F]">
                          Meus pedidos ({orders.length})
                        </h2>
                        <div className="space-y-2.5">
                          {orders.map((ord) => {
                            const active = selectedOrder?.id === ord.id;
                            const ordStatus = getOrderCurrentStatus(ord);
                            return (
                              <button
                                key={ord.id}
                                type="button"
                                onClick={() => setSelectedOrderId(ord.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-colors flex flex-wrap items-center justify-between gap-3 ${
                                  active
                                    ? 'border-[#536895] bg-[#536895]/6'
                                    : 'border-[#E5E2D8] bg-[#FAF9F5] hover:border-[#DBD6BE]'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#181A1F] font-mono">
                                    Pedido {ord.code}
                                  </p>
                                  <p className="text-xs text-[#5A606B]">
                                    {new Date(ord.createdAt).toLocaleDateString(
                                      'pt-BR'
                                    )}{' '}
                                    · {ord.items.length}{' '}
                                    {ord.items.length === 1 ? 'item' : 'itens'} ·{' '}
                                    <span
                                      className={
                                        ord.deliveryConfirmation?.confirmed
                                          ? 'font-semibold text-[#1F5E3B]'
                                          : 'font-medium text-[#181A1F]'
                                      }
                                    >
                                      {ordStatus}
                                    </span>
                                  </p>
                                </div>
                                <span className="text-sm font-semibold font-mono tabular-nums text-[#181A1F]">
                                  {formatBRL(ord.pricing.total)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detalhes do pedido selecionado + Etapas ERP/WMS + Confirmação de entrega */}
                      {selectedOrder && (() => {
                        const currentStatus =
                          getOrderCurrentStatus(selectedOrder);
                        const isDeliveryConfirmed = Boolean(
                          selectedOrder.deliveryConfirmation?.confirmed
                        );
                        const canConfirmReceipt =
                          canCustomerConfirmDelivery(selectedOrder);
                        const canAdvanceDemo =
                          !isDeliveryConfirmed &&
                          selectedOrder.currentStepIndex <
                            ORDER_TIMELINE_STEPS.length - 1;
                        const completedHistory = [
                          ...selectedOrder.timeline.filter((s) => s.completed),
                        ].reverse();

                        return (
                          <div className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-6">
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D8] pb-4">
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-[#181A1F]">
                                  Detalhes do pedido{' '}
                                  <span className="font-mono">
                                    {selectedOrder.code}
                                  </span>
                                </h3>
                                <p className="text-xs text-[#5A606B]">
                                  {selectedOrder.payment.label} ·{' '}
                                  {selectedOrder.payment.status}
                                </p>
                                <p className="text-xs text-[#2D3139] pt-0.5">
                                  Status atual:{' '}
                                  <strong
                                    className={
                                      isDeliveryConfirmed
                                        ? 'text-[#1F5E3B]'
                                        : 'text-[#536895]'
                                    }
                                  >
                                    {currentStatus}
                                  </strong>
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5">
                                {canAdvanceDemo && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdvanceDemoTracking(
                                        selectedOrder.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#536895] text-xs font-semibold text-[#536895] hover:bg-[#536895]/8 transition-colors"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    Simular próxima etapa (Demo)
                                  </button>
                                )}

                                {canConfirmReceipt && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDeliveryOrder(selectedOrder)
                                    }
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F5E3B] text-white text-xs font-semibold hover:bg-[#184B2E] transition-colors"
                                  >
                                    <PackageCheck className="w-4 h-4" />
                                    Confirmar recebimento
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Mensagem de sucesso / registro da confirmação de recebimento */}
                            {(deliveryConfirmSuccess?.orderId ===
                              selectedOrder.id ||
                              selectedOrder.deliveryConfirmation?.confirmed) && (
                              <div
                                role="status"
                                className="rounded-xl border border-[#1F5E3B]/30 bg-[#1F5E3B]/8 p-4 flex items-start gap-3"
                              >
                                <CheckCircle2 className="w-5 h-5 text-[#1F5E3B] shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold text-[#184B2E]">
                                    {deliveryConfirmSuccess?.orderId ===
                                    selectedOrder.id
                                      ? 'Recebimento confirmado com sucesso!'
                                      : 'Entrega confirmada pelo cliente'}
                                  </p>
                                  <p className="text-[#2D3139]">
                                    Status atualizado para{' '}
                                    <strong>
                                      Entrega confirmada pelo cliente
                                    </strong>{' '}
                                    em{' '}
                                    <strong className="font-mono">
                                      {formatDateTimeBR(
                                        selectedOrder.deliveryConfirmation
                                          ?.confirmedAt ??
                                          deliveryConfirmSuccess?.confirmedAt
                                      )}
                                    </strong>
                                    .
                                  </p>
                                  <p className="text-[#5A606B]">
                                    Confirmação registrada no histórico do
                                    pedido e preparada para envio futuro ao
                                    ERP/WMS da Inside Ecobag.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Acompanhamento das 13 etapas reais preparadas para ERP/WMS + confirmação */}
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-[#181A1F]">
                                  Acompanhamento da entrega
                                </h4>
                                <span className="text-[11px] font-medium text-[#5A606B]">
                                  Etapas preparadas para ERP/WMS (Demo)
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {selectedOrder.timeline.map((step) => {
                                  const isCustomerStep =
                                    step.source === 'customer_confirmation';
                                  return (
                                    <div
                                      key={step.step}
                                      className={`p-3 rounded-xl border text-xs ${
                                        isCustomerStep
                                          ? 'border-[#1F5E3B]/45 bg-[#1F5E3B]/8 text-[#181A1F]'
                                          : step.completed
                                            ? 'border-[#536895]/40 bg-[#536895]/6 text-[#181A1F]'
                                            : 'border-[#E5E2D8] bg-[#FAF9F5] text-[#5A606B]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span
                                          className={`font-mono font-semibold ${
                                            isCustomerStep
                                              ? 'text-[#1F5E3B]'
                                              : 'text-[#536895]'
                                          }`}
                                        >
                                          {String(step.step).padStart(2, '0')}
                                        </span>
                                        {step.completed && (
                                          <CheckCircle2
                                            className={`w-3.5 h-3.5 ${
                                              isCustomerStep
                                                ? 'text-[#1F5E3B]'
                                                : 'text-[#536895]'
                                            }`}
                                          />
                                        )}
                                      </div>
                                      <p className="font-semibold leading-snug">
                                        {step.status}
                                      </p>
                                      {step.completed && step.timestamp && (
                                        <p className="mt-1 text-[11px] text-[#5A606B] font-mono">
                                          {formatDateTimeBR(step.timestamp)}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Histórico detalhado do pedido */}
                            <div className="space-y-3 pt-2 border-t border-[#E5E2D8]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-[#181A1F] flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-[#536895]" />
                                  Histórico do pedido
                                </h4>
                                <span className="text-[11px] text-[#5A606B]">
                                  Registro cronológico de eventos
                                </span>
                              </div>

                              <div className="space-y-2">
                                {completedHistory.map((entry) => {
                                  const isCustomerConfirm =
                                    entry.source === 'customer_confirmation';
                                  return (
                                    <div
                                      key={`hist-${entry.step}-${entry.status}`}
                                      className={`rounded-xl border px-3.5 py-2.5 text-xs flex flex-wrap items-start justify-between gap-2 ${
                                        isCustomerConfirm
                                          ? 'border-[#1F5E3B]/35 bg-[#1F5E3B]/6'
                                          : 'border-[#E5E2D8] bg-[#FAF9F5]'
                                      }`}
                                    >
                                      <div className="space-y-0.5">
                                        <p
                                          className={`font-semibold ${
                                            isCustomerConfirm
                                              ? 'text-[#184B2E]'
                                              : 'text-[#181A1F]'
                                          }`}
                                        >
                                          {entry.status}
                                        </p>
                                        {entry.note && (
                                          <p className="text-[11px] text-[#5A606B]">
                                            {entry.note}
                                          </p>
                                        )}
                                      </div>
                                      {entry.timestamp && (
                                        <span className="text-[11px] font-mono text-[#5A606B] shrink-0">
                                          {formatDateTimeBR(entry.timestamp)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                          {/* Itens & Valores */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[#E5E2D8]">
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-[#181A1F]">
                                Ecobags personalizadas
                              </h4>
                              {selectedOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F5] border border-[#E5E2D8]"
                                >
                                  <img
                                    src={item.previewDataUrl}
                                    alt={`Ecobag ${item.configuration.size}`}
                                    className="w-12 h-12 rounded-lg bg-white object-contain p-1"
                                  />
                                  <div className="min-w-0 flex-1 text-xs">
                                    <p className="font-semibold text-[#181A1F]">
                                      {BAG_SIZES[item.configuration.size].name}
                                    </p>
                                    <p className="text-[#5A606B]">
                                      Qtd: {item.quantity} ·{' '}
                                      {item.configuration.elements.length}{' '}
                                      elemento(s)
                                    </p>
                                  </div>
                                  <span className="text-xs font-mono font-semibold tabular-nums">
                                    {formatBRL(item.unitPrice * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="space-y-3 text-xs">
                              <h4 className="text-sm font-semibold text-[#181A1F]">
                                Resumo financeiro e entrega
                              </h4>
                              <div className="rounded-xl bg-[#FAF9F5] border border-[#E5E2D8] p-4 space-y-2">
                                <p className="text-[#2D3139]">
                                  <strong>Entrega:</strong>{' '}
                                  {selectedOrder.shippingAddress.street},{' '}
                                  {selectedOrder.shippingAddress.number} —{' '}
                                  {selectedOrder.shippingAddress.city}/
                                  {selectedOrder.shippingAddress.state} (CEP{' '}
                                  {selectedOrder.shippingAddress.cep})
                                </p>
                                <div className="pt-2 border-t border-[#E5E2D8] space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-[#5A606B]">
                                      Subtotal dos produtos
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {formatBRL(
                                        selectedOrder.pricing.subtotal
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#5A606B]">
                                      Desconto (5%)
                                    </span>
                                    <span className="font-mono tabular-nums text-[#536895]">
                                      -
                                      {formatBRL(
                                        selectedOrder.pricing.discountAmount
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#5A606B]">Frete</span>
                                    <span className="font-mono tabular-nums">
                                      {formatBRL(
                                        selectedOrder.pricing.shippingFee
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between pt-1.5 border-t border-[#E5E2D8] font-semibold text-sm">
                                    <span>Total pago</span>
                                    <span className="font-mono tabular-nums">
                                      {formatBRL(selectedOrder.pricing.total)}
                                    </span>
                                  </div>
                                </div>
                                <p className="pt-2 text-[11px] text-[#5A606B]">
                                  Payload ERP/WMS preparado para o módulo
                                  &ldquo;{selectedOrder.erpPayload.targetModule}&rdquo;.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })()}
                    </>
                  )}
                </section>
              )}

              {tab === 'support' && (
                <section className="space-y-6">
                  <form
                    onSubmit={handleSubmitComplaint}
                    className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-4"
                  >
                    <div>
                      <h2 className="text-xl font-semibold text-[#181A1F]">
                        Atendimento e reclamações
                      </h2>
                      <p className="text-xs text-[#5A606B] mt-0.5">
                        Registre solicitações sobre seu pedido e anexe fotos
                        para agilizar a análise.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#5A606B] mb-1">
                          Pedido relacionado
                        </label>
                        <select
                          value={ticketOrderCode}
                          onChange={(e) => setTicketOrderCode(e.target.value)}
                          className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2.5 text-xs"
                        >
                          {orders.length === 0 ? (
                            <option value="Atendimento geral">
                              Atendimento geral
                            </option>
                          ) : (
                            orders.map((o) => (
                              <option key={o.id} value={o.code}>
                                Pedido {o.code} ({formatBRL(o.pricing.total)})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#5A606B] mb-1">
                          Motivo da solicitação
                        </label>
                        <select
                          value={ticketReason}
                          onChange={(e) =>
                            setTicketReason(e.target.value as ComplaintReason)
                          }
                          className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2.5 text-xs"
                        >
                          {COMPLAINT_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#5A606B] mb-1">
                        Descrição do problema *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        placeholder="Descreva o ocorrido com detalhes..."
                        className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#536895]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-[#536895] bg-[#536895]/6 text-xs font-semibold text-[#536895] cursor-pointer hover:bg-[#536895]/12">
                        <Paperclip className="w-3.5 h-3.5" />
                        Anexar imagens (até 4 fotos)
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleAttachImages(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {ticketFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ticketFiles.map((f, idx) => (
                            <div
                              key={idx}
                              className="relative w-16 h-16 rounded-lg border border-[#DBD6BE] overflow-hidden bg-[#FAF9F5]"
                            >
                              <img
                                src={f.dataUrl}
                                alt={f.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setTicketFiles((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5 text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D]"
                      >
                        Enviar solicitação
                      </button>
                      {ticketSuccess && (
                        <span className="text-xs font-medium text-[#536895]">
                          Solicitação registrada! Acompanhe o andamento abaixo.
                        </span>
                      )}
                    </div>
                  </form>

                  <div className="rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-4">
                    <h3 className="text-base font-semibold text-[#181A1F]">
                      Andamento das solicitações ({complaints.length})
                    </h3>
                    {complaints.length === 0 ? (
                      <p className="text-xs text-[#5A606B]">
                        Nenhuma solicitação registrada até o momento.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {complaints.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-xl border border-[#E5E2D8] bg-[#FAF9F5] p-4 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold font-mono text-[#181A1F]">
                                {t.protocol} · {t.orderCode}
                              </span>
                              <span className="text-xs font-semibold text-[#536895]">
                                {t.status}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-[#2D3139]">
                              Motivo: {t.reason}
                            </p>
                            <p className="text-xs text-[#5A606B]">
                              {t.description}
                            </p>
                            {t.attachments.length > 0 && (
                              <div className="flex gap-2 pt-1">
                                {t.attachments.map((att, i) => (
                                  <img
                                    key={i}
                                    src={att.dataUrl}
                                    alt={att.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-[#DBD6BE]"
                                  />
                                ))}
                              </div>
                            )}
                            <div className="pt-2 border-t border-[#E5E2D8] text-[11px] text-[#5A606B]">
                              {t.updates[0]?.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de confirmação de recebimento do pedido */}
      {confirmDeliveryOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delivery-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E5E2D8] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1F5E3B]/10 text-[#1F5E3B] flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <h3
                  id="confirm-delivery-title"
                  className="text-base font-semibold text-[#181A1F]"
                >
                  Confirmar recebimento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeliveryOrder(null)}
                aria-label="Fechar confirmação"
                className="p-1 rounded-lg text-[#5A606B] hover:bg-[#FAF9F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-[#2D3139]">
              <p>
                Você realmente recebeu o pedido{' '}
                <strong className="font-mono text-[#181A1F]">
                  {confirmDeliveryOrder.code}
                </strong>
                ?
              </p>
              <p className="text-xs text-[#5A606B]">
                Ao confirmar, o status será alterado para{' '}
                <strong>Entrega confirmada pelo cliente</strong> com registro de
                data e horário no histórico. Esta confirmação é definitiva e não
                poderá ser refeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeliveryOrder(null)}
                className="px-4 py-2 rounded-xl border border-[#DBD6BE] bg-white text-xs font-medium text-[#5A606B] hover:text-[#181A1F]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelivery(confirmDeliveryOrder)}
                className="px-4 py-2 rounded-xl bg-[#1F5E3B] text-white text-xs font-semibold hover:bg-[#184B2E] transition-colors"
              >
                Sim, recebi o pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
