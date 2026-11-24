import React from 'react';

interface TutorialIllustrationProps {
  stepNumber: number;
}

/**
 * Ilustrações didáticas em alto contraste (#789BAE e #F8F5EF) indicando exatamente
 * onde clicar em cada etapa do Studio 3D, sem depender de termos técnicos.
 */
export const TutorialIllustration: React.FC<TutorialIllustrationProps> = ({
  stepNumber,
}) => {
  switch (stepNumber) {
    case 1:
      // Conhecendo o Studio 3D: barra esquerda + bolsa no centro + controles à direita
      return (
        <svg
          viewBox="0 0 360 148"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Mapa visual da tela do Studio 3D mostrando ferramentas à esquerda, bolsa no centro e controles de visualização à direita"
        >
          <rect width="360" height="148" rx="14" fill="#F8F5EF" />
          {/* Barra superior */}
          <rect x="12" y="10" width="90" height="20" rx="7" fill="#FFFFFF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="57" y="23" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#18242C">Voltar</text>
          <rect x="196" y="10" width="152" height="20" rx="7" fill="#FFFFFF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="272" y="23" textAnchor="middle" fontSize="9" fontWeight="700" fill="#18242C">Desfazer · Visualizar · Carrinho</text>

          {/* Barra lateral esquerda */}
          <rect x="14" y="40" width="54" height="96" rx="10" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="41" y="57" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Modelo</text>
          <text x="41" y="72" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Cores</text>
          <text x="41" y="87" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Estampas</text>
          <text x="41" y="102" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Texto</text>
          <text x="41" y="117" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Bottons</text>

          {/* Bolsa no centro */}
          <path d="M162 56 C162 39, 198 39, 198 56" fill="none" stroke="#789BAE" strokeWidth="4" strokeLinecap="round" />
          <rect x="148" y="56" width="64" height="72" rx="6" fill="#E8E3D2" stroke="#789BAE" strokeWidth="2" />
          {/* Seta de rotação ao redor da bolsa */}
          <path d="M134 94 C134 114, 226 114, 226 94" fill="none" stroke="#263B47" strokeWidth="2" strokeDasharray="4 3" />
          <polygon points="226,90 221,98 231,98" fill="#263B47" />
          <text x="180" y="138" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#263B47">Arraste para girar a bolsa</text>

          {/* Controles à direita */}
          <rect x="300" y="40" width="44" height="96" rx="10" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2.5" />
          <text x="322" y="58" textAnchor="middle" fontSize="9" fontWeight="700" fill="#263B47">Ângulos</text>
          <text x="322" y="75" textAnchor="middle" fontSize="9" fontWeight="700" fill="#263B47">Centro</text>
          <text x="322" y="93" textAnchor="middle" fontSize="11" fontWeight="800" fill="#263B47">+  -</text>
          <text x="322" y="112" textAnchor="middle" fontSize="9" fontWeight="700" fill="#263B47">Girar</text>

          {/* Seta apontando para controles */}
          <path d="M254 80 L294 80" stroke="#789BAE" strokeWidth="3" strokeLinecap="round" />
          <polygon points="298,80 290,75 290,85" fill="#789BAE" />
        </svg>
      );

    case 2:
      // Escolhendo o tamanho P, M, G
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando o botão Modelo e as opções Pequena, Média e Grande"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="16" y="22" width="76" height="96" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <rect x="22" y="30" width="64" height="32" rx="8" fill="#789BAE" />
          <text x="54" y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF">Modelo</text>
          <text x="54" y="82" textAnchor="middle" fontSize="9.5" fill="#41535E">Cores</text>
          <text x="54" y="102" textAnchor="middle" fontSize="9.5" fill="#41535E">Estampas</text>

          {/* Seta */}
          <path d="M98 46 L132 46" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="138,46 128,40 128,52" fill="#263B47" />

          {/* Opções P M G */}
          <rect x="144" y="16" width="200" height="32" rx="9" fill="#FFFFFF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="158" y="36" fontSize="11" fontWeight="700" fill="#18242C">Pequena (P) · 28 × 32 cm</text>

          <rect x="144" y="54" width="200" height="32" rx="9" fill="#789BAE" fillOpacity="0.2" stroke="#789BAE" strokeWidth="2.5" />
          <text x="158" y="74" fontSize="11" fontWeight="700" fill="#18242C">Média (M) · 35 × 40 cm</text>
          <circle cx="326" cy="70" r="8" fill="#789BAE" />
          <path d="M322 70 L325 73 L331 67" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

          <rect x="144" y="92" width="200" height="32" rx="9" fill="#FFFFFF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="158" y="112" fontSize="11" fontWeight="700" fill="#18242C">Grande (G) · 42 × 46 cm</text>
        </svg>
      );

    case 3:
      // Escolhendo a cor da ecobag
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando o botão Cores e a paleta de círculos coloridos"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="16" y="22" width="76" height="96" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="54" y="45" textAnchor="middle" fontSize="9.5" fill="#41535E">Modelo</text>
          <rect x="22" y="55" width="64" height="32" rx="8" fill="#789BAE" />
          <text x="54" y="75" textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF">Cores</text>
          <text x="54" y="104" textAnchor="middle" fontSize="9.5" fill="#41535E">Estampas</text>

          <path d="M98 71 L132 71" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="138,71 128,65 128,77" fill="#263B47" />

          <rect x="144" y="18" width="200" height="104" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <rect x="156" y="28" width="56" height="22" rx="6" fill="#789BAE" />
          <text x="184" y="43" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">Tudo</text>
          <rect x="216" y="28" width="56" height="22" rx="6" fill="#F8F5EF" />
          <text x="244" y="43" textAnchor="middle" fontSize="10" fontWeight="600" fill="#18242C">Corpo</text>
          <rect x="276" y="28" width="56" height="22" rx="6" fill="#F8F5EF" />
          <text x="304" y="43" textAnchor="middle" fontSize="10" fontWeight="600" fill="#18242C">Alças</text>

          {/* Círculos de cores */}
          <circle cx="176" cy="76" r="14" fill="#DBD6BE" stroke="#263B47" strokeWidth="1.5" />
          <circle cx="216" cy="76" r="14" fill="#789BAE" stroke="#18242C" strokeWidth="3" />
          <circle cx="256" cy="76" r="14" fill="#6F8A72" stroke="#263B47" strokeWidth="1.5" />
          <circle cx="296" cy="76" r="14" fill="#C46D53" stroke="#263B47" strokeWidth="1.5" />
          <text x="244" y="109" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">Toque em qualquer cor para testar</text>
        </svg>
      );

    case 4:
      // Estampas + Como baixar imagem no celular e no computador
      return (
        <svg
          viewBox="0 0 360 152"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando como tocar e segurar no celular ou clicar com botão direito no computador para salvar imagem e depois clicar em Carregar"
        >
          <rect width="360" height="152" rx="14" fill="#F8F5EF" />
          {/* Lado esquerdo: Celular */}
          <rect x="14" y="14" width="102" height="124" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="65" y="31" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">No Celular</text>
          <rect x="28" y="38" width="74" height="44" rx="7" fill="#E8EEF2" stroke="#789BAE" strokeWidth="1.5" />
          <text x="65" y="63" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#263B47">Tocar e segurar</text>
          <rect x="24" y="88" width="82" height="24" rx="6" fill="#789BAE" />
          <text x="65" y="103" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF">Baixar imagem</text>
          <text x="65" y="127" textAnchor="middle" fontSize="8.5" fill="#41535E">Vai para Galeria</text>

          {/* Meio: Computador */}
          <rect x="128" y="14" width="104" height="124" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="180" y="31" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">No Computador</text>
          <rect x="142" y="38" width="76" height="44" rx="7" fill="#E8EEF2" stroke="#789BAE" strokeWidth="1.5" />
          <text x="180" y="63" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#263B47">Botão direito</text>
          <rect x="138" y="88" width="84" height="24" rx="6" fill="#789BAE" />
          <text x="180" y="103" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF">Salvar imagem</text>
          <text x="180" y="127" textAnchor="middle" fontSize="8.5" fill="#41535E">Vai para Downloads</text>

          {/* Seta para Studio 3D */}
          <path d="M236 76 L254 76" stroke="#263B47" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="258,76 250,71 250,81" fill="#263B47" />

          {/* Direita: Botão Carregar no Studio 3D */}
          <rect x="260" y="14" width="86" height="124" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2.5" />
          <text x="303" y="34" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#263B47">Studio 3D</text>
          <text x="303" y="50" textAnchor="middle" fontSize="9" fill="#41535E">1. Estampas</text>
          <rect x="271" y="62" width="64" height="28" rx="14" fill="#789BAE" />
          <text x="303" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">Carregar</text>
          <text x="303" y="108" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">2. Escolher foto</text>
          <text x="303" y="122" textAnchor="middle" fontSize="8.5" fill="#41535E">e confirmar</text>
        </svg>
      );

    case 5:
      // Escolhendo a alça (Cores -> Alças)
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando como clicar em Cores e depois na aba Alças para mudar somente a cor das alças"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="16" y="20" width="188" height="100" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="32" y="40" fontSize="10" fontWeight="700" fill="#263B47">Dentro de Cores:</text>
          <rect x="28" y="48" width="48" height="24" rx="6" fill="#F8F5EF" />
          <text x="52" y="64" textAnchor="middle" fontSize="9.5" fill="#41535E">Tudo</text>
          <rect x="82" y="48" width="52" height="24" rx="6" fill="#F8F5EF" />
          <text x="108" y="64" textAnchor="middle" fontSize="9.5" fill="#41535E">Corpo</text>
          <rect x="140" y="46" width="54" height="28" rx="7" fill="#789BAE" stroke="#263B47" strokeWidth="2" />
          <text x="167" y="64" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#FFFFFF">Alças</text>
          <circle cx="52" cy="96" r="11" fill="#789BAE" />
          <circle cx="84" cy="96" r="11" fill="#384D3D" />
          <circle cx="116" cy="96" r="11" fill="#C46D53" />
          <circle cx="148" cy="96" r="11" fill="#283652" />

          <path d="M212 70 L248 70" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="254,70 244,64 244,76" fill="#263B47" />

          {/* Bolsa mostrando alça destacada */}
          <path d="M286 58 C286 30, 326 30, 326 58" fill="none" stroke="#789BAE" strokeWidth="6" strokeLinecap="round" />
          <rect x="272" y="58" width="68" height="62" rx="6" fill="#E8E3D2" stroke="#263B47" strokeWidth="1.5" />
          <text x="306" y="133" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#263B47">Alça muda na hora</text>
        </svg>
      );

    case 6:
      // Adicionando bottons
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando formatos de bottons, modelos prontos e onde excluir um botton"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="16" y="18" width="184" height="104" rx="12" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="108" y="37" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#263B47">Painel Bottons</text>
          {/* Formatos */}
          <circle cx="52" cy="64" r="13" fill="#789BAE" fillOpacity="0.25" stroke="#789BAE" strokeWidth="2" />
          <text x="52" y="88" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#263B47">Redondo</text>
          <rect x="94" y="51" width="26" height="26" rx="4" fill="#F8F5EF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="107" y="88" textAnchor="middle" fontSize="8.5" fill="#41535E">Quadrado</text>
          <path d="M162 76 C150 67, 148 56, 156 52 C160 50, 162 54, 162 54 C162 54, 164 50, 168 52 C176 56, 174 67, 162 76 Z" fill="#F8F5EF" stroke="#789BAE" strokeWidth="1.5" />
          <text x="162" y="88" textAnchor="middle" fontSize="8.5" fill="#41535E">Coração</text>
          <text x="108" y="109" textAnchor="middle" fontSize="9" fontWeight="700" fill="#263B47">Toque no botton para aplicar</text>

          <path d="M208 70 L242 70" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="248,70 238,64 238,76" fill="#263B47" />

          {/* Bolsa com botton */}
          <path d="M282 48 C282 28, 322 28, 322 48" fill="none" stroke="#789BAE" strokeWidth="4" strokeLinecap="round" />
          <rect x="268" y="48" width="68" height="66" rx="6" fill="#E8E3D2" stroke="#789BAE" strokeWidth="1.5" />
          <circle cx="290" cy="68" r="10" fill="#789BAE" stroke="#FFFFFF" strokeWidth="2.5" />
          <text x="302" y="129" textAnchor="middle" fontSize="9" fontWeight="700" fill="#263B47">Toque nele para Excluir</text>
        </svg>
      );

    case 7:
      // Conferindo a ecobag
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando os três ângulos de conferência: Frente, Costas e Lateral, além do botão Desfazer"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="18" y="20" width="96" height="84" rx="10" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <rect x="46" y="34" width="40" height="44" rx="4" fill="#E8E3D2" stroke="#789BAE" strokeWidth="1.5" />
          <text x="66" y="95" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">Frente</text>

          <rect x="132" y="20" width="96" height="84" rx="10" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <rect x="160" y="34" width="40" height="44" rx="4" fill="#E8E3D2" stroke="#789BAE" strokeWidth="1.5" />
          <text x="180" y="95" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">Costas</text>

          <rect x="246" y="20" width="96" height="84" rx="10" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <rect x="282" y="34" width="24" height="44" rx="4" fill="#E8E3D2" stroke="#789BAE" strokeWidth="1.5" />
          <text x="294" y="95" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">Lateral</text>

          <text x="180" y="126" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">
            Confira no botão Visualizar ou gire a bolsa · Use Desfazer para corrigir
          </text>
        </svg>
      );

    case 8:
    default:
      // Finalizando a personalização
      return (
        <svg
          viewBox="0 0 360 140"
          className="w-full h-auto rounded-2xl border-2 border-[#789BAE]/45 bg-white"
          role="img"
          aria-label="Ilustração mostrando o fluxo final: Adicionar ao carrinho, revisar no Carrinho e Finalizar pedido"
        >
          <rect width="360" height="140" rx="14" fill="#F8F5EF" />
          <rect x="14" y="38" width="112" height="46" rx="11" fill="#789BAE" stroke="#263B47" strokeWidth="2" />
          <text x="70" y="59" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1. Adicionar</text>
          <text x="70" y="73" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">ao carrinho</text>

          <path d="M132 61 L152 61" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="158,61 148,55 148,67" fill="#263B47" />

          <rect x="164" y="38" width="84" height="46" rx="11" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="206" y="59" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">2. Revisar</text>
          <text x="206" y="73" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">no Carrinho</text>

          <path d="M254 61 L274 61" stroke="#263B47" strokeWidth="3" strokeLinecap="round" />
          <polygon points="280,61 270,55 270,67" fill="#263B47" />

          <rect x="286" y="38" width="60" height="46" rx="11" fill="#FFFFFF" stroke="#789BAE" strokeWidth="2" />
          <text x="316" y="59" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">3. Fechar</text>
          <text x="316" y="73" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">pedido</text>

          <text x="180" y="114" textAnchor="middle" fontSize="10" fontWeight="700" fill="#263B47">
            Sua criação vai para o carrinho com segurança para você revisar tudo
          </text>
        </svg>
      );
  }
};
