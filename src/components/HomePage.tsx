import React from 'react';
import { ArrowRight, ShoppingBag, User } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HomePageProps {
  cartCount: number;
  hasCustomer: boolean;
  onStartPersonalize: () => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  cartCount,
  hasCustomer,
  onStartPersonalize,
  onOpenCart,
  onOpenAccount,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181A1F]">
      {/* Navegação superior discreta */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-8">
        <BrandLogo size="md" />

        <div className="flex items-center gap-6 shrink-0">
          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#5A606B] hover:text-[#181A1F] transition-colors whitespace-nowrap"
          >
            <User className="w-4 h-4" />
            <span>{hasCustomer ? 'Área do cliente' : 'Entrar'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#181A1F] hover:text-[#536895] transition-colors whitespace-nowrap tabular-nums"
          >
            <ShoppingBag className="w-4 h-4 text-[#536895]" />
            <span>Carrinho{cartCount > 0 ? ` (${cartCount})` : ''}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo central minimalista conforme especificação */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl text-center space-y-8">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>

          <div className="space-y-4">
            <h1 className="sr-only">Inside Ecobag</h1>

            <p className="max-w-lg mx-auto text-base sm:text-lg text-[#5A606B] leading-relaxed">
              Ecobags em algodão de alta gramatura pensadas para acompanhar sua
              rotina com durabilidade, estética atemporal e acabamento
              artesanal. Crie cada detalhe da sua bolsa em nosso estúdio 3D.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onStartPersonalize}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#536895] text-white text-sm font-semibold tracking-wide hover:bg-[#41547D] transition-colors shadow-sm"
            >
              <span>PERSONALIZE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
