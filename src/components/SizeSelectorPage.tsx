import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShoppingBag, User } from 'lucide-react';
import { BAG_SIZES, formatBRL } from '../data/catalog';
import { BagSizeId } from '../types';
import { BrandLogo } from './BrandLogo';

interface SizeSelectorPageProps {
  initialSize?: BagSizeId;
  cartCount: number;
  onBack: () => void;
  onConfirmSize: (size: BagSizeId) => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
}

const EcobagProportionIllustration: React.FC<{ size: BagSizeId }> = ({
  size,
}) => {
  // Visual scale reflects real physical proportions P < M < G
  const scale = size === 'P' ? 0.78 : size === 'M' ? 0.92 : 1.08;
  return (
    <div className="h-52 w-full rounded-xl bg-[#F2EFE4]/75 flex items-center justify-center p-4">
      <svg
        viewBox="0 0 180 200"
        className="h-full w-auto transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        aria-hidden="true"
      >
        {/* Sombra no chão */}
        <ellipse cx="90" cy="182" rx="48" ry="7" fill="#181A1F" fillOpacity="0.1" />
        {/* Alça traseira */}
        <path
          d="M66 66 C66 28, 114 28, 114 66"
          fill="none"
          stroke="#C8C1A8"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Corpo com profundidade lateral */}
        <path
          d="M42 66 L132 66 L136 172 C136 175 133 178 130 178 L46 178 C43 178 40 175 40 172 Z"
          fill="#DBD6BE"
          stroke="#536895"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Fole lateral */}
        <path
          d="M132 66 L144 72 L147 170 L136 178 L132 66 Z"
          fill="#C9C2A6"
          stroke="#536895"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Costura superior e reforço das alças */}
        <line
          x1="43"
          y1="75"
          x2="132"
          y2="75"
          stroke="#536895"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
        {/* Alça frontal */}
        <path
          d="M62 72 C62 24, 112 24, 112 72"
          fill="none"
          stroke="#FAF9F5"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M62 72 C62 24, 112 24, 112 72"
          fill="none"
          stroke="#536895"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Rótulo de tamanho no tecido */}
        <text
          x="87"
          y="132"
          textAnchor="middle"
          fill="#536895"
          fontSize="22"
          fontWeight="700"
          fontFamily="Georgia, serif"
        >
          {size}
        </text>
      </svg>
    </div>
  );
};

export const SizeSelectorPage: React.FC<SizeSelectorPageProps> = ({
  initialSize = 'M',
  cartCount,
  onBack,
  onConfirmSize,
  onOpenCart,
  onOpenAccount,
}) => {
  const [selectedSize, setSelectedSize] = useState<BagSizeId>(initialSize);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181A1F]">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8 border-b border-[#E5E2D8]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A606B] hover:text-[#181A1F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Início</span>
          </button>
          <span className="h-4 w-px bg-[#DBD6BE]" />
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A606B] hover:text-[#181A1F]"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Área do cliente</span>
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#181A1F] hover:text-[#536895] tabular-nums"
          >
            <ShoppingBag className="w-4 h-4 text-[#536895]" />
            <span>Carrinho{cartCount > 0 ? ` (${cartCount})` : ''}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 sm:py-14 flex flex-col justify-center">
        <div className="text-center max-w-xl mx-auto space-y-2 mb-10">
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#181A1F]"
            style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
          >
            Escolha o tamanho da sua ecobag
          </h1>
          <p className="text-sm sm:text-base text-[#5A606B]">
            Selecione a proporção ideal para seguir ao estúdio 3D de
            personalização.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['P', 'M', 'G'] as BagSizeId[]).map((sizeId) => {
            const spec = BAG_SIZES[sizeId];
            const isSelected = selectedSize === sizeId;
            return (
              <div
                key={sizeId}
                onClick={() => setSelectedSize(sizeId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedSize(sizeId);
                  }
                }}
                className={`cursor-pointer rounded-2xl bg-white p-5 border transition-all flex flex-col ${
                  isSelected
                    ? 'border-[#536895] ring-2 ring-[#536895]/20 shadow-sm'
                    : 'border-[#E5E2D8] hover:border-[#DBD6BE]'
                }`}
              >
                <EcobagProportionIllustration size={sizeId} />

                <div className="mt-5 flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#181A1F]">
                    {spec.name}
                  </h2>
                  <span className="text-lg font-semibold text-[#536895] tabular-nums font-mono">
                    {formatBRL(spec.price)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-[#5A606B]">{spec.summary}</p>
                <p className="mt-3 text-sm text-[#2D3139] leading-relaxed flex-1">
                  {spec.capacityDesc}
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirmSize(sizeId);
                  }}
                  className={`mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    isSelected
                      ? 'bg-[#536895] text-white hover:bg-[#41547D]'
                      : 'bg-[#F2EFE4] text-[#181A1F] hover:bg-[#DBD6BE]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  Personalizar {spec.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
