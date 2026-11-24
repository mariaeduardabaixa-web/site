import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  Gift,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { BAG_SIZES, COTTON_COLORS, formatBRL } from '../data/catalog';
import { calculateOrderPricing } from '../services/promotionService';
import { CartItem, CustomerProfile, Order } from '../types';
import { BrandLogo } from './BrandLogo';

interface CartPageProps {
  items: CartItem[];
  customer: CustomerProfile | null;
  customerOrders: Order[];
  allOrders: Order[];
  onBackToSizes: () => void;
  onAddAnotherBag: () => void;
  onEditItem: (item: CartItem) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onProceedToCheckout: () => void;
}

function getColorLabel(hex: string): string {
  const match = COTTON_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase()
  );
  return match ? match.name : hex.toUpperCase();
}

export const CartPage: React.FC<CartPageProps> = ({
  items,
  customer,
  customerOrders,
  allOrders,
  onBackToSizes,
  onAddAnotherBag,
  onEditItem,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}) => {
  const defaultAddress =
    customer?.addresses.find((a) => a.isDefault) ??
    customer?.addresses[0] ??
    null;

  const pricing = calculateOrderPricing({
    items,
    customer,
    customerOrders,
    allOrders,
    address: defaultAddress,
    hasAddressProvided: Boolean(defaultAddress),
  });

  const summarizeCustomizations = (item: CartItem): string[] => {
    const cfg = item.configuration;
    const notes: string[] = [];
    if (cfg.unifiedColor) {
      notes.push(`Cor: ${getColorLabel(cfg.bodyColor)}`);
    } else {
      notes.push(
        `Corpo: ${getColorLabel(cfg.bodyColor)} · Alças: ${getColorLabel(cfg.handleColor)}`
      );
    }
    const prints = cfg.elements.filter((e) => e.type === 'print' && e.visible).length;
    const texts = cfg.elements.filter((e) => e.type === 'text' && e.visible).length;
    const bottons = cfg.elements.filter((e) => e.type === 'botton' && e.visible).length;
    const hasDraw = cfg.drawingVisible && cfg.drawingStrokes.length > 0;

    if (prints > 0) notes.push(`${prints} estampa${prints > 1 ? 's' : ''}`);
    if (texts > 0) notes.push(`${texts} texto${texts > 1 ? 's' : ''}`);
    if (bottons > 0) notes.push(`${bottons} botton${bottons > 1 ? 's' : ''} 3D`);
    if (hasDraw) notes.push('Desenho livre');
    return notes;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181A1F]">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-6 border-b border-[#E5E2D8]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToSizes}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A606B] hover:text-[#181A1F]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Personalizar</span>
          </button>
          <span className="h-4 w-px bg-[#DBD6BE]" />
          <BrandLogo size="sm" />
        </div>

        <button
          type="button"
          onClick={onAddAnotherBag}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#DBD6BE] bg-white text-xs font-semibold text-[#181A1F] hover:border-[#536895] transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-[#536895]" />
          Adicionar outra bolsa personalizada
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#181A1F]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Seu carrinho
          </h1>
          <p className="mt-1 text-sm text-[#5A606B]">
            Cada bolsa preserva sua própria configuração 3D de forma independente.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[#E5E2D8] p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F2EFE4] text-[#536895] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#181A1F]">
                Seu carrinho está vazio
              </h2>
              <p className="text-sm text-[#5A606B]">
                Escolha o tamanho da sua ecobag e personalize no estúdio 3D.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddAnotherBag}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#536895] text-white text-sm font-semibold hover:bg-[#41547D] transition-colors"
            >
              Personalizar ecobag
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Lista de itens */}
            <div className="lg:col-span-8 space-y-4">
              {items.map((item) => {
                const sizeSpec = BAG_SIZES[item.configuration.size];
                const itemSubtotal = item.unitPrice * item.quantity;
                const notes = summarizeCustomizations(item);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white border border-[#E5E2D8] p-4 sm:p-5 flex flex-col sm:flex-row gap-5"
                  >
                    <div className="w-full sm:w-32 h-36 rounded-xl bg-[#F2EFE4]/70 border border-[#E5E2D8] overflow-hidden shrink-0 flex items-center justify-center p-2">
                      {item.previewDataUrl ? (
                        <img
                          src={item.previewDataUrl}
                          alt={`Ecobag ${sizeSpec.name}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ShoppingBag className="w-8 h-8 text-[#536895]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-[#181A1F]">
                            Ecobag Personalizada · {sizeSpec.name}
                          </h3>
                          <p className="text-xs text-[#5A606B] mt-0.5">
                            {sizeSpec.summary}
                          </p>
                        </div>

                        <div className="text-right tabular-nums font-mono">
                          <div className="text-base font-semibold text-[#181A1F]">
                            {formatBRL(itemSubtotal)}
                          </div>
                          <div className="text-xs text-[#5A606B]">
                            {formatBRL(item.unitPrice)} / un.
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#2D3139] space-y-0.5">
                        {notes.map((n, idx) => (
                          <span key={idx}>
                            {n}
                            {idx < notes.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F2EFE4]">
                        <div className="inline-flex items-center rounded-xl border border-[#DBD6BE] bg-[#FAF9F5]">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(item.id, item.quantity - 1)
                            }
                            aria-label="Diminuir quantidade"
                            className="p-2 text-[#181A1F] hover:text-[#536895]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-semibold font-mono tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(item.id, item.quantity + 1)
                            }
                            aria-label="Aumentar quantidade"
                            className="p-2 text-[#181A1F] hover:text-[#536895]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#536895] hover:text-[#41547D]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar personalização
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumo e Promoção de Primeira Compra */}
            <aside className="lg:col-span-4 rounded-2xl bg-white border border-[#E5E2D8] p-6 space-y-5 sticky top-6">
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
                <div className="rounded-xl bg-[#F2EFE4] p-3.5 text-xs text-[#5A606B]">
                  {pricing.reason}
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A606B]">Subtotal dos produtos</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatBRL(pricing.subtotal)}
                  </span>
                </div>

                {pricing.isEligible && (
                  <div className="flex justify-between text-[#536895]">
                    <span>Desconto de 5% (1ª compra)</span>
                    <span className="font-mono font-semibold tabular-nums">
                      -{formatBRL(pricing.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-[#5A606B]">
                    Frete{' '}
                    {defaultAddress ? '(estimado)' : '(a calcular no checkout)'}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {pricing.freeShippingApplied
                      ? formatBRL(0)
                      : defaultAddress
                        ? formatBRL(pricing.shippingFee)
                        : 'No próximo passo'}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E5E2D8] flex justify-between items-baseline">
                  <span className="font-semibold text-[#181A1F]">
                    Total previsto
                  </span>
                  <span className="text-xl font-semibold text-[#181A1F] font-mono tabular-nums">
                    {formatBRL(pricing.total)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedToCheckout}
                className="w-full py-3.5 px-5 rounded-xl bg-[#536895] text-white text-sm font-semibold hover:bg-[#41547D] transition-colors inline-flex items-center justify-center gap-2"
              >
                <span>Finalizar pedido</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};
