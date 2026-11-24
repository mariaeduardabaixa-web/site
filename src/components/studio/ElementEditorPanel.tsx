import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Eye,
  EyeOff,
  Heart,
  ImagePlus,
  RotateCw,
  Square,
  Circle,
  Trash2,
  X,
} from 'lucide-react';
import { COTTON_COLORS, STUDIO_FONTS } from '../../data/catalog';
import {
  BagElement,
  BottonFinish,
  BottonShape,
} from '../../types';

interface ElementEditorPanelProps {
  element: BagElement | null;
  drawingSelected: boolean;
  drawingVisible: boolean;
  strokeCount: number;
  onUpdateElement: (id: string, patch: Partial<BagElement>) => void;
  onDuplicateElement: (id: string) => void;
  onDeleteElement: (id: string) => void;
  onReplacePrintImage: (id: string, file: File) => void;
  onToggleDrawingVisible: () => void;
  onClearDrawing: () => void;
  onClose: () => void;
}

export const ElementEditorPanel: React.FC<ElementEditorPanelProps> = ({
  element,
  drawingSelected,
  drawingVisible,
  strokeCount,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onReplacePrintImage,
  onToggleDrawingVisible,
  onClearDrawing,
  onClose,
}) => {
  if (!element && !drawingSelected) return null;

  return (
    <div className="flex flex-col h-full bg-white text-[#181A1F]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E2D8]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#181A1F] truncate">
            Editar elemento
          </h3>
          <p className="text-xs text-[#5A606B] truncate">
            {drawingSelected
              ? 'Desenho livre'
              : element?.type === 'print'
                ? 'Estampa'
                : element?.type === 'text'
                  ? 'Texto personalizado'
                  : 'Botton 3D'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel de edição"
          className="p-1.5 rounded-lg text-[#5A606B] hover:bg-[#F2EFE4] hover:text-[#181A1F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {drawingSelected ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF9F5] border border-[#E5E2D8] p-3 text-xs text-[#5A606B]">
              {strokeCount}{' '}
              {strokeCount === 1 ? 'traço aplicado' : 'traços aplicados'} na superfície da bolsa.
            </div>
            <button
              type="button"
              onClick={onToggleDrawingVisible}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#DBD6BE] text-xs font-medium text-[#181A1F] hover:bg-[#FAF9F5] transition-colors"
            >
              {drawingVisible ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Ocultar desenho
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Mostrar desenho
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClearDrawing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir desenho
            </button>
          </div>
        ) : (
          element && (
            <>
              {/* Lado da bolsa */}
              <div>
                <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                  Lado da bolsa
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F2EFE4]">
                  {(['front', 'back'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => onUpdateElement(element.id, { side })}
                      className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        element.side === side
                          ? 'bg-white text-[#181A1F] shadow-sm'
                          : 'text-[#5A606B] hover:text-[#181A1F]'
                      }`}
                    >
                      {side === 'front' ? 'Frente' : 'Costas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Propriedades específicas de Texto */}
              {element.type === 'text' && (
                <div className="space-y-3 pt-1 border-t border-[#E5E2D8]">
                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Texto
                    </label>
                    <textarea
                      rows={2}
                      value={element.text}
                      onChange={(e) =>
                        onUpdateElement(element.id, { text: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-sm text-[#181A1F] focus:outline-none focus:border-[#536895]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1">
                      Fonte
                    </label>
                    <select
                      value={element.fontFamily}
                      onChange={(e) =>
                        onUpdateElement(element.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] px-3 py-2 text-xs text-[#181A1F] focus:outline-none focus:border-[#536895]"
                    >
                      {STUDIO_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                      Alinhamento
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F2EFE4]">
                      {(
                        [
                          { id: 'left', Icon: AlignLeft },
                          { id: 'center', Icon: AlignCenter },
                          { id: 'right', Icon: AlignRight },
                        ] as const
                      ).map(({ id, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            onUpdateElement(element.id, { align: id })
                          }
                          className={`flex items-center justify-center py-1.5 rounded-lg transition-colors ${
                            element.align === id
                              ? 'bg-white text-[#536895] shadow-sm'
                              : 'text-[#5A606B] hover:text-[#181A1F]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                      Cor do texto
                    </label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {['#181A1F', '#536895', '#FAF9F5', '#C46D53', '#384D3D', '#C8984C'].map(
                        (hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() =>
                              onUpdateElement(element.id, { color: hex })
                            }
                            aria-label={`Cor ${hex}`}
                            className={`w-6 h-6 rounded-full border transition-transform ${
                              element.color.toLowerCase() === hex.toLowerCase()
                                ? 'border-[#536895] ring-2 ring-[#536895]/30 scale-110'
                                : 'border-[#DBD6BE]'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        )
                      )}
                      <input
                        type="color"
                        value={element.color}
                        onChange={(e) =>
                          onUpdateElement(element.id, { color: e.target.value })
                        }
                        aria-label="Escolher cor personalizada"
                        className="w-7 h-7 rounded-lg border border-[#DBD6BE] cursor-pointer bg-transparent p-0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Propriedades específicas de Estampa */}
              {element.type === 'print' && (
                <div className="pt-1 border-t border-[#E5E2D8]">
                  <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[#DBD6BE] bg-[#FAF9F5] text-xs font-medium text-[#181A1F] hover:border-[#536895] cursor-pointer transition-colors">
                    <ImagePlus className="w-3.5 h-3.5 text-[#536895]" />
                    Substituir imagem
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onReplacePrintImage(element.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Propriedades específicas de Botton */}
              {element.type === 'botton' && (
                <div className="space-y-3 pt-1 border-t border-[#E5E2D8]">
                  <div>
                    <label className="block text-xs font-medium text-[#5A606B] mb-1.5">
                      Formato
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'round', label: 'Redondo', Icon: Circle },
                          { id: 'square', label: 'Quadrado', Icon: Square },
                          { id: 'heart', label: 'Coração', Icon: Heart },
                        ] as Array<{
                          id: BottonShape;
                          label: string;
                          Icon: React.ComponentType<{ className?: string }>;
                        }>
                      ).map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            onUpdateElement(element.id, { shape: id })
                          }
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-medium transition-colors ${
                            element.shape === id
                              ? 'border-[#536895] bg-[#536895]/8 text-[#536895]'
                              : 'border-[#E5E2D8] text-[#5A606B] hover:border-[#DBD6BE]'
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
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F2EFE4]">
                      {(
                        [
                          { id: 'matte', label: 'Fosco' },
                          { id: 'glossy', label: 'Brilhante' },
                        ] as Array<{ id: BottonFinish; label: string }>
                      ).map((fin) => (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() =>
                            onUpdateElement(element.id, { finish: fin.id })
                          }
                          className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            element.finish === fin.id
                              ? 'bg-white text-[#181A1F] shadow-sm'
                              : 'text-[#5A606B] hover:text-[#181A1F]'
                          }`}
                        >
                          {fin.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#5A606B]">
                        Borda visível
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateElement(element.id, {
                            showBorder: !element.showBorder,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          element.showBorder
                            ? 'bg-[#536895] text-white'
                            : 'bg-[#F2EFE4] text-[#5A606B]'
                        }`}
                      >
                        {element.showBorder ? 'Ativa' : 'Sem borda'}
                      </button>
                    </div>

                    {element.showBorder && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {COTTON_COLORS.slice(0, 7).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              onUpdateElement(element.id, { borderColor: c.hex })
                            }
                            aria-label={`Borda ${c.name}`}
                            className={`w-5 h-5 rounded-full border ${
                              element.borderColor.toLowerCase() ===
                              c.hex.toLowerCase()
                                ? 'border-[#536895] ring-2 ring-[#536895]/30'
                                : 'border-[#DBD6BE]'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                        <input
                          type="color"
                          value={element.borderColor}
                          onChange={(e) =>
                            onUpdateElement(element.id, {
                              borderColor: e.target.value,
                            })
                          }
                          className="w-6 h-6 rounded border border-[#DBD6BE] cursor-pointer p-0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Controles de Posição, Tamanho e Rotação */}
              <div className="space-y-3 pt-2 border-t border-[#E5E2D8]">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#5A606B] font-medium">
                      Posição horizontal
                    </span>
                    <span className="font-mono text-[#181A1F] tabular-nums">
                      {Math.round(element.x * 100)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.36}
                    max={0.36}
                    step={0.01}
                    value={element.x}
                    onChange={(e) =>
                      onUpdateElement(element.id, { x: Number(e.target.value) })
                    }
                    className="w-full accent-[#536895]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#5A606B] font-medium">
                      Posição vertical
                    </span>
                    <span className="font-mono text-[#181A1F] tabular-nums">
                      {Math.round(element.y * 100)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.36}
                    max={0.36}
                    step={0.01}
                    value={element.y}
                    onChange={(e) =>
                      onUpdateElement(element.id, { y: Number(e.target.value) })
                    }
                    className="w-full accent-[#536895]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#5A606B] font-medium">Tamanho</span>
                    <span className="font-mono text-[#181A1F] tabular-nums">
                      {Math.round(element.scale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={1.45}
                    step={0.02}
                    value={element.scale}
                    onChange={(e) =>
                      onUpdateElement(element.id, {
                        scale: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#536895]"
                  />
                </div>

                {element.type !== 'botton' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#5A606B] font-medium flex items-center gap-1">
                        <RotateCw className="w-3 h-3" /> Rotação
                      </span>
                      <span className="font-mono text-[#181A1F] tabular-nums">
                        {element.rotation}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={element.rotation}
                      onChange={(e) =>
                        onUpdateElement(element.id, {
                          rotation: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#536895]"
                    />
                  </div>
                )}
              </div>

              {/* Ações: Duplicar e Excluir */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5E2D8]">
                <button
                  type="button"
                  onClick={() => onDuplicateElement(element.id)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[#DBD6BE] text-xs font-medium text-[#181A1F] hover:bg-[#FAF9F5] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[#536895]" />
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteElement(element.id)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};
