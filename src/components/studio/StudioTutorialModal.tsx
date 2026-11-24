import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Pause,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { StudioTool } from '../../types';
import { TutorialIllustration } from './TutorialIllustration';

export type TutorialHighlightId =
  | 'canvas-bag'
  | 'camera-controls'
  | 'tool-model'
  | 'tool-colors'
  | 'tool-colors-handles'
  | 'tool-prints'
  | 'tool-bottons'
  | 'top-preview'
  | 'top-finish';

export interface TutorialStepDef {
  id: number;
  shortLabel: string;
  title: string;
  intro: string;
  highlight: TutorialHighlightId;
  associatedTool?: StudioTool;
  cardPosition: 'left' | 'right';
  whereToClick: string;
  bullets: Array<{ label: string; detail: string }>;
  internetGuide?: {
    title: string;
    steps: string[];
    note: string;
  };
  audioScript: string;
}

export const STUDIO_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 1,
    shortLabel: 'Studio 3D',
    title: 'Etapa 1 – Conhecendo o Studio 3D',
    intro:
      'O Studio 3D é um espaço onde você vê a sua ecobag em tamanho e formato reais antes de fazer o pedido. Nada do que você clicar aqui estraga a bolsa: você pode testar tudo com calma.',
    highlight: 'camera-controls',
    cardPosition: 'left',
    whereToClick:
      'Olhe para a barra de botões no canto direito e para os botões à esquerda da tela.',
    bullets: [
      {
        label: 'Barra da esquerda',
        detail:
          'Tem as ferramentas para montar a bolsa: Modelo (tamanho), Cores, Estampas, Texto, Desenho, Bottons e Elementos (lista do que você colocou).',
      },
      {
        label: 'Barra da direita (visualização)',
        detail:
          'Permite girar a bolsa, escolher ângulos prontos (cubo), aproximar com a lupa (+), afastar com a lupa (-) e voltar à posição inicial clicando no ícone de centralizar (quadrado com setas).',
      },
      {
        label: 'Girar com o dedo ou mouse',
        detail:
          'Você também pode tocar ou clicar no fundo cinza ao redor da bolsa e arrastar para os lados para vê-la de frente, de costas e de lado.',
      },
      {
        label: 'Barra de cima',
        detail:
          'Tem Voltar, Desfazer e Refazer (setas curvas), Salvar (em telas maiores), Visualizar e o botão principal Adicionar ao carrinho.',
      },
    ],
    audioScript:
      'Etapa 1: Conhecendo o Studio 3D. O Studio 3D é um espaço para você visualizar sua ecobag em três dimensões antes de comprar. Na barra à esquerda ficam as ferramentas de criação: Modelo, Cores, Estampas, Texto, Desenho, Bottons e Elementos. No centro está a sua bolsa; você pode arrastar na tela para girar ou usar os botões do lado direito para aproximar com o sinal de mais, afastar com o sinal de menos, girar para a esquerda ou direita e clicar no ícone de centralizar para voltar à visão inicial. Em cima ficam os botões para voltar, desfazer, visualizar e adicionar ao carrinho.',
  },
  {
    id: 2,
    shortLabel: 'Tamanho',
    title: 'Etapa 2 – Escolhendo o tamanho da ecobag',
    intro:
      'Aqui você escolhe o tamanho que melhor combina com o que costuma carregar no dia a dia. Todas são feitas em algodão cru resistente.',
    highlight: 'tool-model',
    associatedTool: 'model',
    cardPosition: 'right',
    whereToClick:
      'Clique no botão "Modelo" na barra esquerda e depois toque em um dos três tamanhos.',
    bullets: [
      {
        label: 'Pequena (P) – 28 × 32 × 8 cm',
        detail:
          'Compacta e leve. Ótima para carregar livros, caderno, carteira, celular e itens essenciais do dia.',
      },
      {
        label: 'Média (M) – 35 × 40 × 10 cm',
        detail:
          'Tamanho equilibrado e versátil. Cabe notebook, agenda, compras do dia e objetos pessoais.',
      },
      {
        label: 'Grande (G) – 42 × 46 × 12 cm',
        detail:
          'Bem espaçosa e funda. Ideal para feira, viagens curtas, praia ou quando precisa levar bastante coisa.',
      },
      {
        label: 'Como confirmar a escolha',
        detail:
          'Basta tocar uma vez no tamanho desejado. A bolsa na tela muda na hora e o tamanho escolhido fica marcado com um sinal de visto azul. Ali embaixo você também pode alternar entre Frente e Costas.',
      },
    ],
    audioScript:
      'Etapa 2: Escolhendo o tamanho da ecobag. Na barra esquerda, clique no botão Modelo. Você verá três opções: Pequena, de 28 por 32 centímetros, ideal para itens leves como livros e carteira; Média, de 35 por 40 centímetros, versátil para o dia a dia e compras; e Grande, de 42 por 46 centímetros, com bastante espaço para feira ou passeios. Para confirmar a escolha, basta clicar sobre o tamanho desejado. Ele ficará marcado com um sinal de visto e a bolsa na tela se ajusta imediatamente.',
  },
  {
    id: 3,
    shortLabel: 'Cor',
    title: 'Etapa 3 – Escolhendo a cor da ecobag',
    intro:
      'O campo de cor serve para escolher a cor do tecido de algodão da sua bolsa. Você pode experimentar quantas cores quiser até achar a que mais gosta.',
    highlight: 'tool-colors',
    associatedTool: 'colors',
    cardPosition: 'right',
    whereToClick:
      'Clique no botão "Cores" na barra esquerda e toque em qualquer círculo colorido.',
    bullets: [
      {
        label: 'Como ver as cores disponíveis',
        detail:
          'Ao abrir "Cores", aparecem 12 círculos com cores da loja, como Pérola Natural, Algodão Cru, Azul UCLA, Verde Sálvia e Terracota.',
      },
      {
        label: 'Como escolher e trocar a cor',
        detail:
          'Toque em um círculo para pintar a bolsa na hora. Se quiser mudar, é só tocar em outro círculo. Em "Tudo", a bolsa inteira muda de cor de uma só vez.',
      },
      {
        label: 'Cor personalizada',
        detail:
          'Se quiser um tom diferente, toque no quadradinho colorido no final do painel "Cor personalizada" para escolher qualquer cor.',
      },
    ],
    audioScript:
      'Etapa 3: Escolhendo a cor da ecobag. Clique no botão Cores na barra esquerda. Esse campo define a cor do tecido da sua bolsa. Você verá doze círculos com cores prontas da loja, além de um seletor chamado Cor personalizada no final do painel. Com a opção Tudo marcada no alto do painel, basta tocar em qualquer círculo colorido para ver a bolsa inteira mudar na hora. Você pode trocar de cor quantas vezes quiser.',
  },
  {
    id: 4,
    shortLabel: 'Estampa e Foto',
    title: 'Etapa 4 – Escolhendo a estampa ou foto',
    intro:
      'Você pode usar uma estampa pronta da loja ou colocar uma foto que esteja salva no seu celular ou computador. Quando você envia uma foto com fundo simples, o próprio estúdio adapta o fundo da imagem para a cor da bolsa que você escolheu.',
    highlight: 'tool-prints',
    associatedTool: 'prints',
    cardPosition: 'right',
    whereToClick:
      'Clique em "Estampas" na barra esquerda. Use "Carregar" para enviar uma foto sua, ou escolha uma estampa abaixo.',
    bullets: [
      {
        label: 'Escolher estampa da loja',
        detail:
          'Role o painel de Estampas para baixo, escolha uma categoria se desejar, e toque em qualquer desenho pronto para colocá-lo na bolsa.',
      },
      {
        label: 'Enviar uma foto do aparelho',
        detail:
          'Toque no botão azul "Carregar" (que serve para enviar sua imagem). No celular, escolha entre "Galeria / Fotos" ou "Arquivos / Downloads". No computador, abra a pasta "Downloads" ou "Imagens", clique na foto e confirme em "Abrir".',
      },
      {
        label: 'Posicionar e ajustar a imagem',
        detail:
          'Depois que a imagem aparecer na bolsa, arraste-a com o dedo ou mouse para mudar o lugar. No painel "Editar elemento" à direita, você pode aumentar ou diminuir o Tamanho, girar (Rotação) e mover para os lados ou para cima e baixo.',
      },
    ],
    internetGuide: {
      title: 'Como baixar uma imagem da internet passo a passo',
      steps: [
        '1. Abra o navegador (como Google Chrome ou Safari) ou o aplicativo onde está a imagem.',
        '2. Procure a imagem desejada até ela aparecer bem visível na tela.',
        '3. No celular: toque com o dedo em cima da imagem e segure por 2 segundos até abrir um menu. No computador: leve a seta sobre a imagem e clique com o botão direito do mouse.',
        '4. Escolha a opção "Baixar imagem" ou "Salvar imagem" (quando estiver disponível).',
        '5. A imagem ficará guardada no seu aparelho, geralmente na pasta Downloads ou na Galeria de fotos.',
        '6. Volte para esta tela do Studio 3D.',
        '7. Clique em "Estampas" e depois no botão azul "Carregar" (para enviar a imagem).',
        '8. Procure na pasta Downloads ou na Galeria a imagem que acabou de salvar.',
        '9. Toque nela e confirme em "Selecionar" ou "Abrir" para colocá-la na ecobag.',
      ],
      note: 'Atenção: nem todos os sites permitem baixar imagens, e algumas fotos ou desenhos possuem direitos autorais (pertencem a outra pessoa). Dê preferência às suas próprias fotos ou a imagens liberadas para uso pessoal.',
    },
    audioScript:
      'Etapa 4: Escolhendo a estampa ou enviando uma imagem. Clique no botão Estampas na barra esquerda. Para usar um desenho pronto da loja, basta rolar o painel e tocar na estampa desejada. Para enviar uma foto sua, clique no botão azul Carregar, localize a pasta Galeria ou Downloads do seu celular ou computador, escolha a foto e confirme. Depois, você pode arrastar a foto sobre a bolsa ou usar o painel Editar elemento à direita para ajustar o tamanho e a posição. Se ainda não salvou a imagem da internet: abra o navegador, encontre a imagem, toque e segure no celular ou clique com o botão direito no computador, escolha Baixar imagem ou Salvar imagem, volte ao Studio 3D, clique em Carregar e selecione o arquivo salvo. Lembre-se de que nem todo site permite baixar imagens e algumas possuem direitos autorais.',
  },
  {
    id: 5,
    shortLabel: 'Alça',
    title: 'Etapa 5 – Escolhendo a alça',
    intro:
      'Você pode deixar as alças da mesma cor do corpo da ecobag ou escolher uma cor diferente para destacar as alças e criar uma combinação exclusiva.',
    highlight: 'tool-colors-handles',
    associatedTool: 'colors',
    cardPosition: 'right',
    whereToClick:
      'Clique em "Cores" na barra esquerda e, no alto do painel, toque na aba "Alças".',
    bullets: [
      {
        label: 'Onde fica o campo da alça',
        detail:
          'Ele fica dentro do botão "Cores". No alto do painel existem três botões lado a lado: "Tudo", "Corpo" e "Alças".',
      },
      {
        label: 'Opções disponíveis para a alça',
        detail:
          'Com "Alças" selecionado, você pode escolher qualquer uma das 12 cores de algodão ou usar a "Cor personalizada" somente para as alças.',
      },
      {
        label: 'Como visualizar a mudança',
        detail:
          'Ao tocar em uma cor, apenas as alças mudam imediatamente no modelo 3D, sem alterar a estampa nem o corpo da bolsa. Para voltar a ter tudo igual, clique na aba "Tudo".',
      },
    ],
    audioScript:
      'Etapa 5: Escolhendo a cor da alça. Para personalizar as alças da ecobag, clique no botão Cores na barra esquerda. No topo do painel, toque na opção Alças, ao lado de Tudo e Corpo. Em seguida, escolha qualquer uma das doze cores ou a cor personalizada. Apenas as alças da bolsa mudarão imediatamente na tela para você ver a combinação com o corpo da ecobag.',
  },
  {
    id: 6,
    shortLabel: 'Bottons',
    title: 'Etapa 6 – Adicionando bottons',
    intro:
      'Bottons são pequenos broches decorativos redondos, quadrados ou em formato de coração que ficam aplicados em relevo 3D na sua ecobag.',
    highlight: 'tool-bottons',
    associatedTool: 'bottons',
    cardPosition: 'right',
    whereToClick:
      'Clique em "Bottons" na barra esquerda, escolha formato, acabamento e toque em um modelo.',
    bullets: [
      {
        label: 'Escolher formato e acabamento',
        detail:
          'Antes de aplicar, escolha se prefere o botton Redondo, Quadrado ou Coração, e com acabamento Brilhante ou Fosco.',
      },
      {
        label: 'Como adicionar um botton',
        detail:
          'Toque em um dos 6 modelos prontos da loja ou clique em "Enviar foto para botton" para criar um broche com uma foto sua. Ele aparece na bolsa na hora.',
      },
      {
        label: 'Como visualizar e ajustar',
        detail:
          'Os bottons aparecem em 3D sobre o tecido. Você pode clicar no botton na bolsa e arrastar para movê-lo, ou trocar a cor da borda no painel à direita.',
      },
      {
        label: 'Como retirar um botton',
        detail:
          'Clique sobre o botton na bolsa e toque no botão vermelho "Excluir" no painel à direita, ou abra "Elementos" na barra esquerda e toque no ícone de lixeira ao lado dele.',
      },
    ],
    audioScript:
      'Etapa 6: Adicionando bottons. Bottons são pequenos broches decorativos aplicados em três dimensões na ecobag. Clique no botão Bottons na barra esquerda. Você pode escolher o formato Redondo, Quadrado ou Coração, e o acabamento Brilhante ou Fosco. Depois, basta tocar em um dos modelos prontos ou clicar em Enviar foto para botton para colocá-lo na bolsa. Para mudar o botton de lugar, arraste-o sobre a bolsa. Para retirar um botton, clique nele e toque em Excluir no painel da direita, ou use o ícone de lixeira na aba Elementos.',
  },
  {
    id: 7,
    shortLabel: 'Conferir',
    title: 'Etapa 7 – Conferindo a ecobag',
    intro:
      'Antes de concluir, vale olhar a ecobag inteira com calma por todos os lados para ter certeza de que tamanho, cor, alça, estampa e bottons ficaram como você imaginou.',
    highlight: 'top-preview',
    cardPosition: 'left',
    whereToClick:
      'Use o botão "Visualizar" (ícone de olho no alto) ou o cubo de "Ângulos" na barra direita.',
    bullets: [
      {
        label: 'Ver em diferentes ângulos',
        detail:
          'Na barra da direita, clique no ícone do cubo para ver Frente, Costas, Lateral, Topo e Fundo, ou clique em "Visualizar" no topo para ver frente, costas e lateral juntas.',
      },
      {
        label: 'O que conferir',
        detail:
          'Veja se o tamanho escolhido atende sua necessidade, se a cor do corpo e das alças combinam, se a estampa está bem centralizada e se os bottons estão no lugar certo.',
      },
      {
        label: 'Como voltar e corrigir',
        detail:
          'Errou algo? Clique na seta "Desfazer" no topo para voltar um passo, ou clique em Modelo, Cores, Estampas, Bottons ou Elementos na barra esquerda para ajustar qualquer detalhe.',
      },
    ],
    audioScript:
      'Etapa 7: Conferindo a ecobag. Antes de finalizar, confira sua criação por todos os lados. Clique no ícone de olho chamado Visualizar na barra superior para ver a frente, as costas e a lateral juntas, ou use o ícone de cubo no lado direito para girar entre frente, costas, lateral, topo e fundo. Confira o tamanho, a cor da bolsa e das alças, o posicionamento da estampa e os bottons. Se quiser mudar alguma coisa, basta clicar na seta Desfazer no topo ou abrir novamente a ferramenta desejada na barra esquerda.',
  },
  {
    id: 8,
    shortLabel: 'Finalizar',
    title: 'Etapa 8 – Finalizando a personalização',
    intro:
      'Quando sua ecobag estiver pronta e do jeito que você quer, o próximo passo é levá-la para o carrinho de compras com segurança.',
    highlight: 'top-finish',
    cardPosition: 'left',
    whereToClick:
      'Clique no botão azul "Adicionar ao carrinho" no canto superior direito da tela.',
    bullets: [
      {
        label: 'Salvar para continuar depois',
        detail:
          'Suas alterações já ficam salvas automaticamente no aparelho. Em computadores e tablets maiores, também há o botão "Salvar" no topo.',
      },
      {
        label: 'Adicionar ao carrinho',
        detail:
          'Ao clicar em "Adicionar ao carrinho", a sua criação é registrada e você vai para a tela do Carrinho.',
      },
      {
        label: 'O que acontece depois de finalizar',
        detail:
          'No Carrinho você confere o valor, a quantidade e pode criar outra ecobag se quiser. Quando estiver pronto, clica para seguir ao pedido, preenche seus dados e endereço de entrega, e depois acompanha cada etapa pela Área do cliente.',
      },
    ],
    audioScript:
      'Etapa 8: Finalizando a personalização. Quando estiver satisfeito com a sua ecobag, suas escolhas já ficam salvas no aparelho e você pode clicar no botão azul Adicionar ao carrinho no canto superior direito. Isso levará você para a tela do Carrinho, onde poderá conferir o resumo da sua bolsa personalizada, ajustar a quantidade ou prosseguir para informar os dados e o endereço de entrega e concluir o seu pedido.',
  },
];

interface StudioTutorialModalProps {
  isOpen: boolean;
  stepIndex: number;
  onChangeStep: (nextIndex: number) => void;
  onClose: () => void;
}

export const StudioTutorialModal: React.FC<StudioTutorialModalProps> = ({
  isOpen,
  stepIndex,
  onChangeStep,
  onClose,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  const step = STUDIO_TUTORIAL_STEPS[stepIndex] ?? STUDIO_TUTORIAL_STEPS[0];
  const totalSteps = STUDIO_TUTORIAL_STEPS.length;
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakCurrentStep = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAudioUnavailable(true);
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(step.audioScript);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    const ptVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('pt-br')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setAudioUnavailable(false);
    setIsSpeaking(true);
    synth.speak(utterance);
  }, [step.audioScript]);

  useEffect(() => {
    stopSpeech();
  }, [stepIndex, isOpen, stopSpeech]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  if (!isOpen) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Posiciona o cartão do tutorial no lado oposto ao elemento destacado em tablets/computadores,
  // evitando tampar os botões reais que estão sendo ensinados na tela.
  const desktopSideClass =
    step.cardPosition === 'right'
      ? 'sm:left-auto sm:right-[68px] lg:right-[80px] sm:top-[72px] sm:bottom-[72px] sm:w-[390px] md:w-[440px]'
      : 'sm:right-auto sm:left-[92px] lg:left-[104px] sm:top-[72px] sm:bottom-4 sm:w-[400px] md:w-[450px]';

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`Tutorial do Studio 3D - ${step.title}`}
      className={`fixed z-40 bottom-2.5 left-2 right-2 max-h-[64vh] sm:max-h-none flex flex-col rounded-3xl bg-[#F8F5EF] border-2 border-[#789BAE] shadow-[0_18px_50px_rgba(24,36,44,0.22)] overflow-hidden ${desktopSideClass}`}
    >
      {/* Cabeçalho com marca, progresso e botão Fechar */}
      <header className="bg-[#789BAE] text-white px-4 sm:px-5 py-3.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-[#F8F5EF] text-[#263B47] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold tracking-wide uppercase text-[#F8F5EF]">
                Guia Passo a Passo · Etapa {stepIndex + 1} de {totalSteps}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F5EF] text-[#18242C] text-sm font-bold hover:bg-white transition-colors shrink-0 min-h-[40px]"
            aria-label="Fechar tutorial"
          >
            <X className="w-4 h-4" />
            <span>Fechar</span>
          </button>
        </div>

        {/* Barra de progresso clara */}
        <div className="mt-3 space-y-1.5">
          <div
            className="w-full h-2.5 rounded-full bg-[#F8F5EF]/40 overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso do tutorial: ${progressPercent}%`}
          >
            <div
              className="h-full rounded-full bg-[#F8F5EF] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Navegação rápida entre etapas já existentes */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {STUDIO_TUTORIAL_STEPS.map((s, idx) => {
              const current = idx === stepIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeStep(idx)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    current
                      ? 'bg-[#F8F5EF] text-[#18242C]'
                      : 'bg-white/20 text-[#F8F5EF] hover:bg-white/30'
                  }`}
                >
                  {idx + 1}. {s.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Controles de Narração em Áudio */}
      <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-[#789BAE]/25 flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => (isSpeaking ? stopSpeech() : speakCurrentStep())}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors min-h-[42px] ${
            isSpeaking
              ? 'bg-[#263B47] text-[#F8F5EF]'
              : 'bg-[#789BAE] text-white hover:bg-[#61859A]'
          }`}
        >
          {isSpeaking ? (
            <>
              <Pause className="w-4 h-4 shrink-0" />
              <span>Pausar áudio</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>Ouvir explicação</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={speakCurrentStep}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8F5EF] border border-[#789BAE] text-[#18242C] text-sm font-bold hover:bg-[#EFE9DE] transition-colors min-h-[42px]"
        >
          <RotateCcw className="w-4 h-4 shrink-0 text-[#476A7D]" />
          <span>Repetir explicação</span>
        </button>

        {audioUnavailable && (
          <p className="w-full text-xs font-medium text-[#41535E]">
            A narração em voz automática não está disponível neste navegador, mas todo o passo a passo está escrito abaixo.
          </p>
        )}
      </div>

      {/* Conteúdo rolável com letra grande e espaçamento confortável */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#18242C] leading-snug">
            {step.title}
          </h2>
          <p className="mt-2 text-[15px] sm:text-base text-[#273842] leading-relaxed">
            {step.intro}
          </p>
        </div>

        {/* Ilustração didática indicando onde clicar */}
        <TutorialIllustration stepNumber={step.id} />

        {/* Indicação destacada de onde clicar na tela real */}
        <div className="rounded-2xl bg-white border-2 border-[#789BAE] px-4 py-3 flex items-start gap-3">
          <ArrowRight className="w-5 h-5 text-[#476A7D] shrink-0 mt-0.5" />
          <p className="text-[15px] font-semibold text-[#18242C] leading-snug">
            Onde clicar: {step.whereToClick}
          </p>
        </div>

        {/* Lista de explicações detalhadas em palavras simples */}
        <ul className="space-y-2.5">
          {step.bullets.map((item) => (
            <li
              key={item.label}
              className="rounded-2xl bg-white border border-[#789BAE]/30 px-4 py-3"
            >
              <p className="text-[15px] font-bold text-[#18242C]">
                {item.label}
              </p>
              <p className="mt-1 text-[15px] text-[#324551] leading-relaxed">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>

        {/* Explicação especial da Etapa 4: Como baixar uma imagem da internet */}
        {step.internetGuide && (
          <div className="rounded-2xl bg-white border-2 border-[#789BAE] p-4 space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-[#18242C]">
              {step.internetGuide.title}
            </h3>
            <ol className="space-y-2">
              {step.internetGuide.steps.map((line) => (
                <li
                  key={line}
                  className="text-[15px] text-[#273842] leading-relaxed bg-[#F8F5EF] rounded-xl px-3.5 py-2.5"
                >
                  {line}
                </li>
              ))}
            </ol>
            <div className="rounded-xl bg-[#789BAE]/15 border border-[#789BAE]/40 px-3.5 py-3 text-sm font-medium text-[#18242C] leading-relaxed">
              {step.internetGuide.note}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com botões grandes de navegação */}
      <footer className="px-4 sm:px-5 py-3.5 bg-white border-t border-[#789BAE]/30 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onChangeStep(Math.max(0, stepIndex - 1))}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#789BAE] bg-[#F8F5EF] text-[#18242C] text-sm sm:text-base font-bold hover:bg-[#EFE9DE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[46px]"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Voltar</span>
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#789BAE] text-white text-sm sm:text-base font-bold hover:bg-[#61859A] transition-colors min-h-[46px] flex-1 sm:flex-initial"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Concluir tutorial</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChangeStep(Math.min(totalSteps - 1, stepIndex + 1))}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#789BAE] text-white text-sm sm:text-base font-bold hover:bg-[#61859A] transition-colors min-h-[46px] flex-1 sm:flex-initial"
          >
            <span>Próxima etapa</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}
      </footer>
    </section>
  );
};
