import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgePlus,
  Box,
  Brush,
  Check,
  ChevronRight,
  Circle,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  Heart,
  HelpCircle,
  ImagePlus,
  Layers,
  Maximize2,
  MousePointer2,
  Palette,
  Pin,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  ShoppingBag,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BAG_SIZES,
  BOTTON_TEMPLATES,
  COTTON_COLORS,
  PRINT_CATEGORIES,
  PRINT_GALLERY,
  STUDIO_FONTS,
} from '../../data/catalog';
import { storageService } from '../../services/storageService';
import {
  BagConfiguration,
  BagElement,
  BagSide,
  BagSizeId,
  BottonElement,
  BottonFinish,
  BottonShape,
  DrawingStroke,
  PrintCategory,
  PrintElement,
  StudioTool,
  TextElement,
} from '../../types';
import { BrandLogo } from '../BrandLogo';
import { prepareUploadedPhotoForBag } from '../../studio3d/imageBackgroundProcessor';
import {
  BagCanvas3D,
  BagCanvas3DHandle,
  CameraPreset,
} from './BagCanvas3D';
import { DrawingPad } from './DrawingPad';
import { ElementEditorPanel } from './ElementEditorPanel';
import {
  STUDIO_TUTORIAL_STEPS,
  StudioTutorialModal,
  TutorialHighlightId,
} from './StudioTutorialModal';

interface StudioPageProps {
  initialConfig: BagConfiguration;
  editingCartItemId: string | null;
  onBack: () => void;
  onAddToCart: (config: BagConfiguration, previewDataUrl: string) => void;
}

const RAIL_TOOLS: Array<{
  id: StudioTool;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'model', label: 'Modelo', Icon: Box },
  { id: 'colors', label: 'Cores', Icon: Palette },
  { id: 'prints', label: 'Estampas', Icon: ImagePlus },
  { id: 'text', label: 'Texto', Icon: Type },
  { id: 'draw', label: 'Desenho', Icon: Brush },
  { id: 'bottons', label: 'Bottons', Icon: Pin },
  { id: 'elements', label: 'Elementos', Icon: Layers },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export const StudioPage: React.FC<StudioPageProps> = ({
  initialConfig,
  editingCartItemId,
  onBack,
  onAddToCart,
}) => {
  const canvasRef = useRef<BagCanvas3DHandle | null>(null);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<BagConfiguration[]>([initialConfig]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const config = history[historyIdx];

  const [activeTool, setActiveTool] = useState<StudioTool | null>('prints');
  const [activeSide, setActiveSide] = useState<BagSide>('front');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [drawingSelected, setDrawingSelected] = useState(false);

  // Tool states
  const [colorTarget, setColorTarget] = useState<'both' | 'body' | 'handles'>('both');
  const [printCategory, setPrintCategory] = useState<PrintCategory | 'Todas'>('Todas');

  // Text creator state
  const [newTextValue, setNewTextValue] = useState('Inside Ecobag');
  const [newTextFont, setNewTextFont] = useState(STUDIO_FONTS[0].id);
  const [newTextColor, setNewTextColor] = useState('#181A1F');
  const [newTextAlign, setNewTextAlign] = useState<'left' | 'center' | 'right'>('center');

  // Drawing tool state
  const [drawInteractionMode, setDrawInteractionMode] = useState<'bag' | 'orbit'>('bag');
  const [brushColor, setBrushColor] = useState('#536895');
  const [brushSize, setBrushSize] = useState(0.014);
  const [isEraser, setIsEraser] = useState(false);

  // Botton defaults before adding
  const [newBottonShape, setNewBottonShape] = useState<BottonShape>('round');
  const [newBottonFinish, setNewBottonFinish] = useState<BottonFinish>('glossy');

  // Camera views popover & responsive viewport tracking (lateral layout on mobile, tablet, and desktop)
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const isNarrowViewport = viewportWidth < 640;

  // Feedback & Preview modal
  const [savedToast, setSavedToast] = useState(false);
  const [previewModal, setPreviewModal] = useState<{
    front: string;
    back: string;
    side: string;
  } | null>(null);

  // Tutorial interativo acessível (preserva toda personalização em andamento)
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const tutorialSavedToolRef = useRef<StudioTool | null>(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const commitConfig = useCallback(
    (updater: (prev: BagConfiguration) => BagConfiguration) => {
      setHistory((prevHist) => {
        const current = prevHist[historyIdx];
        const next = updater(current);
        const stamped: BagConfiguration = {
          ...next,
          updatedAt: new Date().toISOString(),
        };
        const sliced = prevHist.slice(0, historyIdx + 1);
        const updatedHist = [...sliced, stamped].slice(-30);
        setHistoryIdx(updatedHist.length - 1);
        return updatedHist;
      });
    },
    [historyIdx]
  );

  useEffect(() => {
    storageService.saveDraftBag(config);
  }, [config]);

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const handleUndo = () => {
    if (canUndo) setHistoryIdx((i) => i - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIdx((i) => i + 1);
  };

  const handleSelectTool = (tool: StudioTool) => {
    if (activeTool === tool) {
      setActiveTool(null);
    } else {
      if (isNarrowViewport) {
        setSelectedElementId(null);
        setDrawingSelected(false);
      }
      setActiveTool(tool);
    }
  };

  const nextZIndex = () =>
    config.elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;

  // --- Color actions ---
  const applyColor = (hex: string) => {
    commitConfig((prev) => {
      if (colorTarget === 'both') {
        return { ...prev, bodyColor: hex, handleColor: hex, unifiedColor: true };
      }
      if (colorTarget === 'body') {
        return {
          ...prev,
          bodyColor: hex,
          unifiedColor: hex.toLowerCase() === prev.handleColor.toLowerCase(),
        };
      }
      return {
        ...prev,
        handleColor: hex,
        unifiedColor: hex.toLowerCase() === prev.bodyColor.toLowerCase(),
      };
    });
  };

  // --- Size / Model change ---
  const handleChangeSize = (size: BagSizeId) => {
    commitConfig((prev) => ({ ...prev, size }));
  };

  // --- Print actions ---
  const addPrint = (
    name: string,
    imageUrl: string,
    isCustomUpload: boolean,
    category?: PrintCategory
  ) => {
    const newEl: PrintElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'print',
      name,
      side: activeSide,
      x: 0,
      y: 0.02,
      scale: 0.65,
      rotation: 0,
      visible: true,
      zIndex: nextZIndex(),
      imageUrl,
      isCustomUpload,
      category,
    };
    commitConfig((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
    setDrawingSelected(false);
    if (isNarrowViewport) setActiveTool(null);
  };

  const handleUploadPrint = async (file: File) => {
    const rawDataUrl = await fileToDataUrl(file);
    const dataUrl = await prepareUploadedPhotoForBag(rawDataUrl, file.type);
    addPrint(file.name.replace(/\.[^.]+$/, '') || 'Imagem enviada', dataUrl, true);
  };

  const handleReplacePrintImage = async (id: string, file: File) => {
    const rawDataUrl = await fileToDataUrl(file);
    const dataUrl = await prepareUploadedPhotoForBag(rawDataUrl, file.type);
    commitConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id && el.type === 'print'
          ? {
              ...el,
              imageUrl: dataUrl,
              isCustomUpload: true,
              name: file.name.replace(/\.[^.]+$/, '') || el.name,
            }
          : el
      ),
    }));
  };

  // --- Text actions ---
  const handleAddText = () => {
    if (!newTextValue.trim()) return;
    const newEl: TextElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      name: newTextValue.trim().slice(0, 22),
      side: activeSide,
      x: 0,
      y: 0.05,
      scale: 0.72,
      rotation: 0,
      visible: true,
      zIndex: nextZIndex(),
      text: newTextValue.trim(),
      fontFamily: newTextFont,
      color: newTextColor,
      align: newTextAlign,
    };
    commitConfig((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
    setDrawingSelected(false);
    if (isNarrowViewport) setActiveTool(null);
  };

  // --- Drawing actions ---
  const handleAddDrawingStroke = useCallback(
    (stroke: DrawingStroke) => {
      commitConfig((prev) => ({
        ...prev,
        drawingVisible: true,
        drawingStrokes: [...prev.drawingStrokes, stroke],
      }));
    },
    [commitConfig]
  );

  const handleClearDrawing = () => {
    commitConfig((prev) => ({ ...prev, drawingStrokes: [] }));
    setDrawingSelected(false);
  };

  // --- Botton actions ---
  const addBotton = (
    name: string,
    imageUrl: string,
    borderColor: string,
    isCustomPhoto: boolean
  ) => {
    const count = config.elements.filter((e) => e.type === 'botton').length;
    const offset = (count % 3) * 0.1 - 0.1;
    const newEl: BottonElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'botton',
      name,
      side: activeSide,
      x: offset,
      y: 0.16 - (count % 2) * 0.12,
      scale: 0.75,
      rotation: 0,
      visible: true,
      zIndex: nextZIndex(),
      imageUrl,
      shape: newBottonShape,
      finish: newBottonFinish,
      borderColor,
      showBorder: true,
      isCustomPhoto,
    };
    commitConfig((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
    setDrawingSelected(false);
    if (isNarrowViewport) setActiveTool(null);
  };

  const handleUploadBottonPhoto = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    addBotton(
      file.name.replace(/\.[^.]+$/, '') || 'Botton com foto',
      dataUrl,
      '#DBD6BE',
      true
    );
  };

  // --- Element editing & direct 3D dragging ---
  const handleUpdateElement = (id: string, patch: Partial<BagElement>) => {
    commitConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as BagElement) : el
      ),
    }));
  };

  const handleDragElementMove = useCallback(
    (id: string, x: number, y: number) => {
      setHistory((prevHist) =>
        prevHist.map((cfg, idx) =>
          idx !== historyIdx
            ? cfg
            : {
                ...cfg,
                elements: cfg.elements.map((el) =>
                  el.id === id ? ({ ...el, x, y } as BagElement) : el
                ),
              }
        )
      );
    },
    [historyIdx]
  );

  const handleDragElementCommit = useCallback(
    (
      id: string,
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ) => {
      setHistory((prevHist) => {
        const current = prevHist[historyIdx];
        if (!current) return prevHist;
        const now = new Date().toISOString();
        const beforeDrag: BagConfiguration = {
          ...current,
          elements: current.elements.map((el) =>
            el.id === id ? ({ ...el, x: startX, y: startY } as BagElement) : el
          ),
        };
        const afterDrag: BagConfiguration = {
          ...current,
          updatedAt: now,
          elements: current.elements.map((el) =>
            el.id === id ? ({ ...el, x: endX, y: endY } as BagElement) : el
          ),
        };
        const prefix = prevHist.slice(0, historyIdx);
        const updatedHist = [...prefix, beforeDrag, afterDrag].slice(-30);
        setHistoryIdx(updatedHist.length - 1);
        return updatedHist;
      });
    },
    [historyIdx]
  );

  const handleDuplicateElement = (id: string) => {
    const target = config.elements.find((e) => e.id === id);
    if (!target) return;
    const dup: BagElement = {
      ...target,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} (cópia)`,
      x: Math.min(0.32, target.x + 0.06),
      y: Math.max(-0.32, target.y - 0.06),
      zIndex: nextZIndex(),
    };
    commitConfig((prev) => ({ ...prev, elements: [...prev.elements, dup] }));
    setSelectedElementId(dup.id);
  };

  const handleDeleteElement = useCallback(
    (id: string) => {
      commitConfig((prev) => ({
        ...prev,
        elements: prev.elements.filter((e) => e.id !== id),
      }));
      setSelectedElementId((prev) => (prev === id ? null : prev));
    },
    [commitConfig]
  );

  // Atalho de teclado: tecla Delete (ou Backspace fora de campos de texto) remove o elemento selecionado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTextInput =
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable) ||
        (tag === 'input' &&
          !['range', 'color', 'file', 'checkbox', 'radio', 'button', 'submit'].includes(
            (target as HTMLInputElement).type
          ));
      if (isTextInput) return;

      if (selectedElementId) {
        e.preventDefault();
        handleDeleteElement(selectedElementId);
      } else if (drawingSelected) {
        e.preventDefault();
        commitConfig((prev) => ({ ...prev, drawingStrokes: [] }));
        setDrawingSelected(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedElementId, drawingSelected, handleDeleteElement, commitConfig]);

  const handleReorderElement = (id: string, direction: 'up' | 'down') => {
    const sorted = [...config.elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aZ = a.zIndex;
    const bZ = b.zIndex;

    commitConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id === a.id) return { ...el, zIndex: bZ };
        if (el.id === b.id) return { ...el, zIndex: aZ };
        return el;
      }),
    }));
  };

  // --- Save / Preview / Cart ---
  const handleSavePersonalization = () => {
    storageService.saveDraftBag(config);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2600);
  };

  const handleOpenPreview = () => {
    setSelectedElementId(null);
    setDrawingSelected(false);
    window.setTimeout(() => {
      const api = canvasRef.current;
      if (!api) return;
      const front = api.captureSnapshot('front');
      const back = api.captureSnapshot('back');
      const side = api.captureSnapshot('side');
      setPreviewModal({ front, back, side });
    }, 60);
  };

  const handleFinishToCart = () => {
    setSelectedElementId(null);
    setDrawingSelected(false);
    window.setTimeout(() => {
      const preview = canvasRef.current?.captureSnapshot('front') || '';
      onAddToCart(config, preview);
    }, 60);
  };

  const handleCameraPreset = (preset: CameraPreset) => {
    canvasRef.current?.setCameraPreset(preset);
    if (preset === 'front') setActiveSide('front');
    if (preset === 'back') setActiveSide('back');
    setShowViewsMenu(false);
  };

  const selectedElement =
    config.elements.find((e) => e.id === selectedElementId) ?? null;
  const hasRightEditor = Boolean(selectedElement || drawingSelected);

  const filteredPrints =
    printCategory === 'Todas'
      ? PRINT_GALLERY
      : PRINT_GALLERY.filter((p) => p.category === printCategory);

  const isDrawingOnBag = activeTool === 'draw' && drawInteractionMode === 'bag';

  // Keep the 3D bag centered in the unobstructed open space between floating lateral panels
  const optionsPanelW =
    viewportWidth >= 1024
      ? 306
      : viewportWidth >= 768
        ? 264
        : viewportWidth >= 640
          ? 224
          : Math.min(192, Math.max(150, viewportWidth - 132));
  const rightPanelW =
    viewportWidth >= 1024
      ? 264
      : viewportWidth >= 768
        ? 244
        : viewportWidth >= 640
          ? 216
          : Math.min(208, Math.max(150, viewportWidth - 124));
  const leftOcclusion = isNarrowViewport
    ? activeTool
      ? 64 + optionsPanelW + 6
      : 66
    : activeTool
      ? (viewportWidth >= 1024 ? 104 : 92) + optionsPanelW + 12
      : viewportWidth >= 1024
        ? 98
        : 90;
  const rightOcclusion = isNarrowViewport
    ? hasRightEditor
      ? 52 + rightPanelW + 6
      : 50
    : hasRightEditor
      ? (viewportWidth >= 1024 ? 74 : 62) + rightPanelW + 12
      : 68;
  const screenCenterOffsetPx = Math.round((leftOcclusion - rightOcclusion) / 2);

  const tutorialHighlight: TutorialHighlightId | null = tutorialOpen
    ? STUDIO_TUTORIAL_STEPS[tutorialStepIndex]?.highlight ?? null
    : null;

  const handleOpenTutorial = () => {
    if (tutorialOpen) return;
    tutorialSavedToolRef.current = activeTool;
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  };

  const handleChangeTutorialStep = (nextIndex: number) => {
    setTutorialStepIndex(nextIndex);
    const step = STUDIO_TUTORIAL_STEPS[nextIndex];
    if (step?.associatedTool) {
      if (isNarrowViewport) {
        setSelectedElementId(null);
        setDrawingSelected(false);
      }
      setActiveTool(step.associatedTool);
    }
  };

  const handleCloseTutorial = () => {
    setTutorialOpen(false);
    setActiveTool(tutorialSavedToolRef.current);
  };

  const renderToolPanelContent = () => {
    if (!activeTool) return null;

    switch (activeTool) {
      case 'model':
        return (
          <div className="space-y-4">
            <div
              className={`space-y-2 rounded-2xl transition-all ${
                tutorialHighlight === 'tool-model'
                  ? 'ring-2 ring-[#789BAE] bg-[#F8F5EF] p-2'
                  : ''
              }`}
            >
              {(['P', 'M', 'G'] as BagSizeId[]).map((sizeId) => {
                const spec = BAG_SIZES[sizeId];
                const isSelected = config.size === sizeId;
                return (
                  <button
                    key={sizeId}
                    type="button"
                    onClick={() => handleChangeSize(sizeId)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-[#536895]/12 ring-1 ring-[#536895]'
                        : 'bg-[#F4F5F7] hover:bg-[#ECEEF2]'
                    }`}
                  >
                    <div>
                      <p className="text-xs text-[#5A606B] font-medium">
                        Tamanho personalizado
                      </p>
                      <p className="text-sm font-semibold text-[#181A1F] mt-0.5">
                        {spec.name} ({spec.widthCm} × {spec.heightCm} cm)
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-[#536895] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#5A606B] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-[#F4F5F7] px-4 py-3.5 space-y-2">
              <p className="text-xs text-[#5A606B] font-medium">
                Material da ecobag
              </p>
              <p className="text-sm font-semibold text-[#181A1F]">
                Algodão cru natural 280g
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F5F7] px-4 py-3.5 space-y-2.5">
              <p className="text-xs font-medium text-[#5A606B]">
                Lado de visualização e aplicação
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white border border-[#E5E6EA]">
                {(['front', 'back'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => {
                      setActiveSide(side);
                      handleCameraPreset(side);
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      activeSide === side
                        ? 'bg-[#536895] text-white'
                        : 'text-[#5A606B] hover:text-[#181A1F]'
                    }`}
                  >
                    {side === 'front' ? 'Frente' : 'Costas'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'colors':
        return (
          <div className="space-y-4">
            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-xl transition-all ${
                tutorialHighlight === 'tool-colors-handles'
                  ? 'bg-[#F8F5EF] ring-2 ring-[#789BAE]'
                  : 'bg-[#F4F5F7]'
              }`}
            >
              {(
                [
                  { id: 'both', label: 'Tudo' },
                  { id: 'body', label: 'Corpo' },
                  { id: 'handles', label: 'Alças' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setColorTarget(t.id)}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                    tutorialHighlight === 'tool-colors-handles' &&
                    t.id === 'handles'
                      ? 'bg-[#789BAE] text-white ring-2 ring-[#263B47] shadow-sm'
                      : colorTarget === t.id
                        ? 'bg-white text-[#181A1F] shadow-sm'
                        : 'text-[#5A606B] hover:text-[#181A1F]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              className={`grid grid-cols-3 gap-2 rounded-2xl transition-all ${
                tutorialHighlight === 'tool-colors'
                  ? 'ring-2 ring-[#789BAE] bg-[#F8F5EF] p-2'
                  : ''
              }`}
            >
              {COTTON_COLORS.map((c) => {
                const currentHex =
                  colorTarget === 'handles' ? config.handleColor : config.bodyColor;
                const active =
                  currentHex.toLowerCase() === c.hex.toLowerCase() &&
                  (colorTarget !== 'both' || config.unifiedColor);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyColor(c.hex)}
                    className={`flex flex-col items-center p-2.5 rounded-xl transition-all ${
                      active
                        ? 'bg-[#536895]/10 ring-1 ring-[#536895]'
                        : 'bg-[#F4F5F7] hover:bg-[#ECEEF2]'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="mt-1.5 text-[11px] font-medium text-[#181A1F] text-center leading-tight line-clamp-1">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-[#F4F5F7] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-[#5A606B]">
                Cor personalizada
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#181A1F]">
                  {(colorTarget === 'handles'
                    ? config.handleColor
                    : config.bodyColor
                  ).toUpperCase()}
                </span>
                <input
                  type="color"
                  value={
                    colorTarget === 'handles'
                      ? config.handleColor
                      : config.bodyColor
                  }
                  onChange={(e) => applyColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border border-[#DBD6BE] cursor-pointer p-0"
                />
              </div>
            </div>
          </div>
        );

      case 'prints':
        return (
          <div className="space-y-4">
            {/* Caixa de upload inspirada diretamente na imagem de referência */}
            <label
              className={`flex flex-col items-center justify-center gap-3 w-full py-6 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center ${
                tutorialHighlight === 'tool-prints'
                  ? 'border-[#789BAE] bg-[#F8F5EF] ring-2 ring-[#789BAE]'
                  : 'border-[#536895]/35 bg-[#EEF2F6] hover:bg-[#E7EDF4]'
              }`}
            >
              <ImagePlus className="w-7 h-7 text-[#536895]" />
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#536895] text-white text-xs font-semibold shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                Carregar
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPrint(file);
                  e.target.value = '';
                }}
              />
            </label>

            <div className="rounded-xl bg-[#F4F5F7] px-3.5 py-2.5">
              <label className="block text-[11px] font-medium text-[#5A606B] mb-1">
                Categoria da galeria
              </label>
              <select
                value={printCategory}
                onChange={(e) =>
                  setPrintCategory(e.target.value as PrintCategory | 'Todas')
                }
                className="w-full bg-transparent text-xs font-semibold text-[#181A1F] focus:outline-none"
              >
                <option value="Todas">Todas as categorias (18)</option>
                {PRINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {filteredPrints.map((print) => (
                <button
                  key={print.id}
                  type="button"
                  onClick={() =>
                    addPrint(print.name, print.imageUrl, false, print.category)
                  }
                  className="group flex flex-col rounded-xl bg-[#F4F5F7] hover:bg-[#ECEEF2] p-2 transition-all text-left"
                >
                  <div className="aspect-square w-full rounded-lg bg-white p-2 flex items-center justify-center overflow-hidden">
                    <img
                      src={print.imageUrl}
                      alt={print.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="mt-1.5 text-[11px] font-semibold text-[#181A1F] truncate">
                    {print.name}
                  </span>
                  <span className="text-[10px] text-[#5A606B] truncate">
                    {print.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5A606B] mb-1">
                Digite seu texto
              </label>
              <textarea
                rows={2}
                value={newTextValue}
                onChange={(e) => setNewTextValue(e.target.value)}
                placeholder="Escreva uma frase ou iniciais..."
                className="w-full rounded-xl bg-[#F4F5F7] border border-transparent focus:border-[#536895] px-3 py-2.5 text-sm text-[#181A1F] focus:outline-none"
              />
            </div>

            <div className="rounded-xl bg-[#F4F5F7] px-3.5 py-2.5">
              <label className="block text-[11px] font-medium text-[#5A606B] mb-1">
                Fonte
              </label>
              <select
                value={newTextFont}
                onChange={(e) => setNewTextFont(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-[#181A1F] focus:outline-none"
              >
                {STUDIO_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5A606B]">
                Alinhamento
              </span>
              <div className="flex gap-1 p-1 rounded-xl bg-[#F4F5F7]">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setNewTextAlign(a)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      newTextAlign === a
                        ? 'bg-white text-[#536895] shadow-sm'
                        : 'text-[#5A606B]'
                    }`}
                  >
                    {a === 'left' ? 'Esq.' : a === 'center' ? 'Centro' : 'Dir.'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                Cor do texto
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {['#181A1F', '#536895', '#FAF9F5', '#C46D53', '#384D3D', '#C8984C'].map(
                  (hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewTextColor(hex)}
                      className={`w-6 h-6 rounded-full border ${
                        newTextColor === hex
                          ? 'border-[#536895] ring-2 ring-[#536895]/30'
                          : 'border-[#DBD6BE]'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  )
                )}
                <input
                  type="color"
                  value={newTextColor}
                  onChange={(e) => setNewTextColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border border-[#DBD6BE] cursor-pointer p-0"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddText}
              className="w-full py-2.5 px-4 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D] transition-colors"
            >
              Adicionar texto na {activeSide === 'front' ? 'frente' : 'costas'}
            </button>
          </div>
        );

      case 'draw':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F5F7]">
              <button
                type="button"
                onClick={() => setDrawInteractionMode('bag')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  drawInteractionMode === 'bag'
                    ? 'bg-white text-[#536895] shadow-sm'
                    : 'text-[#5A606B]'
                }`}
              >
                Desenhar em 3D
              </button>
              <button
                type="button"
                onClick={() => setDrawInteractionMode('orbit')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  drawInteractionMode === 'orbit'
                    ? 'bg-white text-[#181A1F] shadow-sm'
                    : 'text-[#5A606B]'
                }`}
              >
                Girar bolsa
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsEraser(false)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold ${
                  !isEraser
                    ? 'bg-[#536895]/12 text-[#536895] ring-1 ring-[#536895]'
                    : 'bg-[#F4F5F7] text-[#5A606B]'
                }`}
              >
                <Brush className="w-3.5 h-3.5" /> Pincel
              </button>
              <button
                type="button"
                onClick={() => setIsEraser(true)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold ${
                  isEraser
                    ? 'bg-[#536895]/12 text-[#536895] ring-1 ring-[#536895]'
                    : 'bg-[#F4F5F7] text-[#5A606B]'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Borracha
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#5A606B]">Espessura</span>
                <span className="font-mono text-[#181A1F] tabular-nums">
                  {Math.round(brushSize * 1000)}px
                </span>
              </div>
              <input
                type="range"
                min={0.005}
                max={0.04}
                step={0.001}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-[#536895]"
              />
            </div>

            {!isEraser && (
              <div>
                <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                  Cor do pincel
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {[
                    '#536895',
                    '#181A1F',
                    '#C46D53',
                    '#384D3D',
                    '#C8984C',
                    '#FAF9F5',
                  ].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setBrushColor(hex)}
                      className={`w-6 h-6 rounded-full border ${
                        brushColor === hex
                          ? 'border-[#536895] ring-2 ring-[#536895]/30'
                          : 'border-[#DBD6BE]'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-[#DBD6BE] cursor-pointer p-0"
                  />
                </div>
              </div>
            )}

            <DrawingPad
              side={activeSide}
              bodyColor={config.bodyColor}
              strokes={config.drawingStrokes}
              brushColor={brushColor}
              brushSize={brushSize}
              isEraser={isEraser}
              onAddStroke={handleAddDrawingStroke}
            />

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                className="py-2 rounded-xl bg-[#F4F5F7] text-xs font-medium text-[#181A1F] hover:bg-[#ECEEF2] disabled:opacity-40"
              >
                Desfazer
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={handleRedo}
                className="py-2 rounded-xl bg-[#F4F5F7] text-xs font-medium text-[#181A1F] hover:bg-[#ECEEF2] disabled:opacity-40"
              >
                Refazer
              </button>
              <button
                type="button"
                onClick={handleClearDrawing}
                className="py-2 rounded-xl bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Limpar
              </button>
            </div>
          </div>
        );

      case 'bottons':
        return (
          <div
            className={`space-y-4 rounded-2xl transition-all ${
              tutorialHighlight === 'tool-bottons'
                ? 'ring-2 ring-[#789BAE] bg-[#F8F5EF] p-2'
                : ''
            }`}
          >
            <label className="flex flex-col items-center justify-center gap-2.5 w-full py-5 px-4 rounded-2xl border-2 border-dashed border-[#536895]/35 bg-[#EEF2F6] hover:bg-[#E7EDF4] cursor-pointer transition-colors text-center">
              <BadgePlus className="w-6 h-6 text-[#536895]" />
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#536895] text-white text-xs font-semibold">
                <Upload className="w-3.5 h-3.5" />
                Enviar foto para botton
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadBottonPhoto(file);
                  e.target.value = '';
                }}
              />
            </label>

            <div>
              <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                Formato do botton 3D
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'round', label: 'Redondo', Icon: Circle },
                    { id: 'square', label: 'Quadrado', Icon: Square },
                    { id: 'heart', label: 'Coração', Icon: Heart },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNewBottonShape(id)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium ${
                      newBottonShape === id
                        ? 'bg-[#536895]/12 text-[#536895] ring-1 ring-[#536895]'
                        : 'bg-[#F4F5F7] text-[#5A606B]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                Acabamento
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F5F7]">
                {(
                  [
                    { id: 'glossy', label: 'Brilhante' },
                    { id: 'matte', label: 'Fosco' },
                  ] as const
                ).map((fin) => (
                  <button
                    key={fin.id}
                    type="button"
                    onClick={() => setNewBottonFinish(fin.id)}
                    className={`py-1.5 rounded-lg text-xs font-semibold ${
                      newBottonFinish === fin.id
                        ? 'bg-white text-[#181A1F] shadow-sm'
                        : 'text-[#5A606B]'
                    }`}
                  >
                    {fin.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {BOTTON_TEMPLATES.map((bt) => (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() =>
                    addBotton(
                      bt.name,
                      bt.imageUrl,
                      bt.defaultBorderColor,
                      false
                    )
                  }
                  className="flex flex-col items-center rounded-xl bg-[#F4F5F7] hover:bg-[#ECEEF2] p-2.5 transition-all"
                >
                  <img
                    src={bt.imageUrl}
                    alt={bt.name}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm bg-[#EAE7DC]"
                  />
                  <span className="mt-1.5 text-[11px] font-medium text-[#181A1F] text-center truncate w-full">
                    {bt.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'elements': {
        const sorted = [...config.elements].sort((a, b) => b.zIndex - a.zIndex);
        return (
          <div className="space-y-2.5">
            {config.drawingStrokes.length > 0 && (
              <div
                onClick={() => {
                  setDrawingSelected(true);
                  setSelectedElementId(null);
                }}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                  drawingSelected
                    ? 'bg-[#536895]/12 ring-1 ring-[#536895]'
                    : 'bg-[#F4F5F7] hover:bg-[#ECEEF2]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#181A1F] truncate">
                    Desenho livre
                  </p>
                  <p className="text-[11px] text-[#5A606B]">
                    {config.drawingStrokes.length} traço(s)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      commitConfig((prev) => ({
                        ...prev,
                        drawingVisible: !prev.drawingVisible,
                      }));
                    }}
                    className="p-1.5 rounded-lg text-[#5A606B] hover:bg-white"
                    aria-label="Alternar visibilidade do desenho"
                  >
                    {config.drawingVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearDrawing();
                    }}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                    aria-label="Limpar desenho"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {sorted.length === 0 && config.drawingStrokes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D3D6DC] p-6 text-center text-xs text-[#5A606B]">
                Nenhum elemento aplicado ainda. Adicione estampas, textos,
                desenhos ou bottons.
              </div>
            ) : (
              sorted.map((el) => {
                const isSel = el.id === selectedElementId;
                return (
                  <div
                    key={el.id}
                    onClick={() => {
                      setSelectedElementId(el.id);
                      setDrawingSelected(false);
                    }}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-[#536895]/12 ring-1 ring-[#536895]'
                        : 'bg-[#F4F5F7] hover:bg-[#ECEEF2]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#181A1F] truncate">
                        {el.name}
                      </p>
                      <p className="text-[11px] text-[#5A606B]">
                        {el.type === 'print'
                          ? 'Estampa'
                          : el.type === 'text'
                            ? 'Texto'
                            : 'Botton 3D'}{' '}
                        · {el.side === 'front' ? 'Frente' : 'Costas'}
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleReorderElement(el.id, 'up')}
                        className="p-1 rounded-md text-[#5A606B] hover:bg-white"
                        aria-label="Trazer para frente"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorderElement(el.id, 'down')}
                        className="p-1 rounded-md text-[#5A606B] hover:bg-white"
                        aria-label="Enviar para trás"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateElement(el.id, { visible: !el.visible })
                        }
                        className="p-1 rounded-md text-[#5A606B] hover:bg-white"
                        aria-label="Alternar visibilidade"
                      >
                        {el.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateElement(el.id)}
                        className="p-1 rounded-md text-[#5A606B] hover:bg-white"
                        aria-label="Duplicar elemento"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteElement(el.id)}
                        className="p-1 rounded-md text-red-600 hover:bg-red-50"
                        aria-label="Excluir elemento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#D8DBDF]">
      {/* D. ÁREA CENTRAL DE VISUALIZAÇÃO 3D (Fundo contínuo de ponta a ponta) */}
      <div className="absolute inset-0">
        <BagCanvas3D
          ref={canvasRef}
          config={config}
          selectedElementId={selectedElementId}
          isDrawingOnBag={isDrawingOnBag}
          brushColor={brushColor}
          brushSize={brushSize}
          isEraser={isEraser}
          screenCenterOffsetPx={screenCenterOffsetPx}
          onSelectElement={(id) => {
            setSelectedElementId(id);
            setDrawingSelected(false);
            if (id && isNarrowViewport) {
              setActiveTool(null);
            }
          }}
          onDragElementMove={handleDragElementMove}
          onDragElementCommit={handleDragElementCommit}
          onAddDrawingStroke={handleAddDrawingStroke}
          onFocusSideChange={(side) => setActiveSide(side)}
        />
      </div>

      {/* A. BARRA SUPERIOR FLUTUANTE (Esquerda: Voltar + Marca | Direita: Cápsula de Ações) */}
      <div className="pointer-events-none absolute top-2.5 sm:top-3.5 left-2 sm:left-3.5 right-2 sm:right-3.5 z-20 flex items-center justify-between gap-2 sm:gap-3">
        {/* Pílula esquerda: Voltar e Inside Ecobag */}
        <div className="pointer-events-auto inline-flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-white border border-[#E5E6EA] px-1.5 sm:px-2.5 py-1 sm:py-1.5 shadow-[0_6px_22px_rgba(24,26,31,0.08)]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#181A1F] hover:bg-[#F4F5F7] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <span className="h-4 w-px bg-[#E5E6EA] hidden sm:block" />
          <BrandLogo size="sm" showText={true} className="hidden sm:inline-flex pr-1" />
          <span className="text-xs font-medium text-[#5A606B] hidden md:inline pr-1">
            · Modelo {config.size}
          </span>
        </div>

        {/* Cápsula direita: Desfazer, Refazer, Salvar, Visualizar resultado e Adicionar ao carrinho */}
        <div className="pointer-events-auto inline-flex items-center gap-0.5 sm:gap-1 rounded-2xl bg-white border border-[#E5E6EA] p-1 sm:p-1.5 shadow-[0_6px_22px_rgba(24,26,31,0.08)]">
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            title="Desfazer"
            aria-label="Desfazer"
            className="p-1.5 sm:p-2 rounded-xl text-[#181A1F] hover:bg-[#F4F5F7] disabled:opacity-35 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            title="Refazer"
            aria-label="Refazer"
            className="p-1.5 sm:p-2 rounded-xl text-[#181A1F] hover:bg-[#F4F5F7] disabled:opacity-35 transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="h-5 w-px bg-[#E5E6EA] mx-0.5" />

          <button
            type="button"
            onClick={handleSavePersonalization}
            title="Salvar personalização"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#181A1F] hover:bg-[#F4F5F7] transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[#536895]" />
            <span>{savedToast ? 'Salvo!' : 'Salvar'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPreview}
            title="Visualizar resultado"
            aria-label="Visualizar resultado"
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              tutorialHighlight === 'top-preview'
                ? 'bg-[#789BAE] text-white ring-2 ring-[#263B47] shadow-sm'
                : 'text-[#181A1F] hover:bg-[#F4F5F7]'
            }`}
          >
            <Eye
              className={`w-3.5 h-3.5 ${
                tutorialHighlight === 'top-preview'
                  ? 'text-white'
                  : 'text-[#536895]'
              }`}
            />
            <span className="hidden lg:inline">Visualizar</span>
          </button>

          <button
            type="button"
            onClick={handleFinishToCart}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-white text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap shadow-sm ${
              tutorialHighlight === 'top-finish'
                ? 'bg-[#789BAE] ring-4 ring-[#789BAE]/40'
                : 'bg-[#536895] hover:bg-[#41547D]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>
              {editingCartItemId ? 'Salvar no carrinho' : 'Adicionar ao carrinho'}
            </span>
          </button>
        </div>
      </div>

      {/* B. BARRA VERTICAL FLUTUANTE À ESQUERDA (Lateral fixa em celular, tablet e computador) */}
      <div className="flex flex-col justify-start absolute top-[58px] sm:top-[72px] bottom-2.5 sm:bottom-4 left-2 sm:left-3.5 z-20 w-[56px] sm:w-[72px] lg:w-[78px] pointer-events-none">
        <aside
          aria-label="Ferramentas do estúdio"
          className="pointer-events-auto flex flex-col gap-0.5 sm:gap-1 rounded-2xl bg-white border border-[#E5E6EA] p-1 sm:p-1.5 shadow-[0_8px_28px_rgba(24,26,31,0.08)] overflow-y-auto max-h-full"
        >
          {RAIL_TOOLS.map(({ id, label, Icon }) => {
            const active = activeTool === id;
            const isHighlighted =
              (tutorialHighlight === 'tool-model' && id === 'model') ||
              ((tutorialHighlight === 'tool-colors' ||
                tutorialHighlight === 'tool-colors-handles') &&
                id === 'colors') ||
              (tutorialHighlight === 'tool-prints' && id === 'prints') ||
              (tutorialHighlight === 'tool-bottons' && id === 'bottons');
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectTool(id)}
                className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-2 sm:py-2.5 px-0.5 sm:px-1 rounded-xl text-center transition-all ${
                  isHighlighted
                    ? 'bg-[#789BAE] text-white font-bold ring-2 ring-[#263B47] shadow-sm'
                    : active
                      ? 'bg-[#536895]/18 text-[#41547D] font-semibold'
                      : 'text-[#4B515C] hover:bg-[#F4F5F7] hover:text-[#181A1F]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[9.5px] sm:text-[11px] leading-tight truncate max-w-full">
                  {label}
                </span>
              </button>
            );
          })}
        </aside>
      </div>

      {/* C. PAINEL FLUTUANTE DE OPÇÕES AO LADO DA BARRA ESQUERDA (Celular, tablet e computador) */}
      {activeTool && (
        <aside className="flex flex-col absolute top-[58px] sm:top-[72px] bottom-2.5 sm:bottom-4 left-[64px] sm:left-[92px] lg:left-[104px] w-[min(192px,calc(100vw-132px))] sm:w-[224px] md:w-[264px] lg:w-[306px] z-20 rounded-2xl bg-white border border-[#E5E6EA] shadow-[0_10px_36px_rgba(24,26,31,0.09)] overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3.5 border-b border-[#F0F1F4]">
            <h2 className="text-xs sm:text-sm font-semibold text-[#181A1F] truncate">
              {RAIL_TOOLS.find((t) => t.id === activeTool)?.label}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              aria-label="Recolher painel"
              className="p-1 rounded-lg text-[#5A606B] hover:bg-[#F4F5F7]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 lg:p-4">
            {renderToolPanelContent()}
          </div>
        </aside>
      )}

      {/* E. PAINEL FLUTUANTE "EDITAR ELEMENTO" À DIREITA (Celular, tablet e computador) */}
      {hasRightEditor && (
        <aside className="flex flex-col absolute top-[58px] sm:top-[72px] bottom-[68px] sm:bottom-[72px] right-[52px] sm:right-[62px] lg:right-[74px] w-[min(208px,calc(100vw-124px))] sm:w-[216px] md:w-[244px] lg:w-[264px] z-20 rounded-2xl bg-white border border-[#E5E6EA] shadow-[0_10px_36px_rgba(24,26,31,0.09)] overflow-hidden">
          <ElementEditorPanel
            element={selectedElement}
            drawingSelected={drawingSelected}
            drawingVisible={config.drawingVisible}
            strokeCount={config.drawingStrokes.length}
            onUpdateElement={handleUpdateElement}
            onDuplicateElement={handleDuplicateElement}
            onDeleteElement={handleDeleteElement}
            onReplacePrintImage={handleReplacePrintImage}
            onToggleDrawingVisible={() =>
              commitConfig((prev) => ({
                ...prev,
                drawingVisible: !prev.drawingVisible,
              }))
            }
            onClearDrawing={handleClearDrawing}
            onClose={() => {
              setSelectedElementId(null);
              setDrawingSelected(false);
            }}
          />
        </aside>
      )}

      {/* BARRA VERTICAL FLUTUANTE DE CONTROLES À DIREITA */}
      <div className="absolute top-[58px] sm:top-[74px] right-2 sm:right-3.5 z-20 flex flex-col items-end gap-2">
        <div
          className={`flex flex-col gap-0.5 sm:gap-1 rounded-2xl bg-white border p-1 sm:p-1.5 shadow-[0_8px_28px_rgba(24,26,31,0.08)] transition-all ${
            tutorialHighlight === 'camera-controls' ||
            tutorialHighlight === 'top-preview'
              ? 'border-[#789BAE] ring-4 ring-[#789BAE]/40'
              : 'border-[#E5E6EA]'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setDrawInteractionMode('orbit');
              if (activeTool === 'draw') setActiveTool(null);
            }}
            title="Modo seleção e rotação 3D"
            aria-label="Modo seleção e rotação"
            className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
              !isDrawingOnBag
                ? 'bg-[#EEF2F6] text-[#41547D]'
                : 'text-[#4B515C] hover:bg-[#F4F5F7]'
            }`}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowViewsMenu((v) => !v)}
            title="Ângulos da bolsa (Frente, Costas, Lateral, Topo, Fundo)"
            aria-label="Ângulos da bolsa"
            className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
              showViewsMenu
                ? 'bg-[#EEF2F6] text-[#41547D]'
                : 'text-[#4B515C] hover:bg-[#F4F5F7]'
            }`}
          >
            <Box className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleCameraPreset('reset')}
            title="Centralizar bolsa"
            aria-label="Centralizar bolsa"
            className="p-1.5 sm:p-2 rounded-xl text-[#4B515C] hover:bg-[#F4F5F7] transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.zoomBy(0.84)}
            title="Aproximar"
            aria-label="Aproximar"
            className="p-1.5 sm:p-2 rounded-xl text-[#4B515C] hover:bg-[#F4F5F7] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.zoomBy(1.18)}
            title="Afastar"
            aria-label="Afastar"
            className="p-1.5 sm:p-2 rounded-xl text-[#4B515C] hover:bg-[#F4F5F7] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.rotateBy(-Math.PI / 6)}
            title="Girar para a esquerda"
            aria-label="Girar para a esquerda"
            className="p-1.5 sm:p-2 rounded-xl text-[#4B515C] hover:bg-[#F4F5F7] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.rotateBy(Math.PI / 6)}
            title="Girar para a direita"
            aria-label="Girar para a direita"
            className="p-1.5 sm:p-2 rounded-xl text-[#4B515C] hover:bg-[#F4F5F7] transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Menu compacto de ângulos ao clicar no ícone do cubo */}
        {showViewsMenu && (
          <div className="rounded-2xl bg-white border border-[#E5E6EA] p-1.5 shadow-[0_10px_30px_rgba(24,26,31,0.12)] flex flex-col gap-0.5 min-w-[110px]">
            {(
              [
                { id: 'front', label: 'Frente' },
                { id: 'back', label: 'Costas' },
                { id: 'side', label: 'Lateral' },
                { id: 'top', label: 'Topo' },
                { id: 'bottom', label: 'Fundo' },
              ] as Array<{ id: CameraPreset; label: string }>
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleCameraPreset(v.id)}
                className="px-3 py-1.5 rounded-xl text-left text-xs font-medium text-[#181A1F] hover:bg-[#F4F5F7]"
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isDrawingOnBag && (
        <div className="pointer-events-none absolute bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-[#181A1F]/88 text-white px-3.5 py-1.5 text-xs font-medium shadow-sm whitespace-nowrap">
          Desenho direto ativo · Arraste sobre a bolsa para riscar
        </div>
      )}

      {/* BOTÃO ACESSÍVEL "TUTORIAL" SEMPRE VISÍVEL (Identidade #789BAE + #F8F5EF) */}
      <button
        type="button"
        onClick={() =>
          tutorialOpen ? handleCloseTutorial() : handleOpenTutorial()
        }
        aria-label="Abrir tutorial passo a passo do Studio 3D"
        aria-expanded={tutorialOpen}
        className="fixed bottom-3 right-2.5 sm:bottom-4 sm:right-3.5 z-30 inline-flex items-center gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-[#F8F5EF] border-2 border-[#789BAE] text-[#18242C] text-base sm:text-lg font-bold shadow-[0_10px_28px_rgba(24,36,44,0.16)] hover:bg-[#EFE9DE] transition-all min-h-[48px]"
      >
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#789BAE] text-white flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5" />
        </span>
        <span>Tutorial</span>
      </button>

      {/* TUTORIAL PASSO A PASSO DO STUDIO 3D */}
      <StudioTutorialModal
        isOpen={tutorialOpen}
        stepIndex={tutorialStepIndex}
        onChangeStep={handleChangeTutorialStep}
        onClose={handleCloseTutorial}
      />

      {/* MODAL DE VISUALIZAÇÃO DO RESULTADO */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E6EA] max-w-3xl w-full overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F4]">
              <div>
                <h3 className="text-base font-semibold text-[#181A1F]">
                  Pré-visualização da sua Inside Ecobag
                </h3>
                <p className="text-xs text-[#5A606B]">
                  {BAG_SIZES[config.size].name} · {BAG_SIZES[config.size].summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-2 rounded-xl hover:bg-[#F4F5F7] text-[#5A606B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#EEF0F3]">
              {[
                { title: 'Frente', src: previewModal.front },
                { title: 'Costas', src: previewModal.back },
                { title: 'Lateral', src: previewModal.side },
              ].map((view) => (
                <div
                  key={view.title}
                  className="bg-white rounded-xl border border-[#E5E6EA] p-3 flex flex-col items-center"
                >
                  <img
                    src={view.src}
                    alt={`Vista ${view.title}`}
                    className="w-full aspect-square object-contain rounded-lg bg-[#F4F5F7]"
                  />
                  <span className="mt-2 text-xs font-semibold text-[#181A1F]">
                    {view.title}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[#F0F1F4] flex justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="px-4 py-2 rounded-xl border border-[#E5E6EA] text-xs font-medium text-[#181A1F] hover:bg-[#F4F5F7]"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewModal(null);
                  handleFinishToCart();
                }}
                className="px-4 py-2 rounded-xl bg-[#536895] text-white text-xs font-semibold hover:bg-[#41547D]"
              >
                Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
