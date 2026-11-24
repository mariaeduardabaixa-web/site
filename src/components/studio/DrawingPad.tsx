import React, { useEffect, useRef } from 'react';
import { BagSide, DrawingStroke } from '../../types';

interface DrawingPadProps {
  side: BagSide;
  bodyColor: string;
  strokes: DrawingStroke[];
  brushColor: string;
  brushSize: number;
  isEraser: boolean;
  onAddStroke: (stroke: DrawingStroke) => void;
}

/**
 * Interactive 2D precision drawing pad synchronized directly onto the 3D ecobag face.
 */
export const DrawingPad: React.FC<DrawingPadProps> = ({
  side,
  bodyColor,
  strokes,
  brushColor,
  brushSize,
  isEraser,
  onAddStroke,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const isDownRef = useRef(false);

  const renderCanvas = (extraStroke?: DrawingStroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle fabric background
    ctx.fillStyle = bodyColor;
    ctx.fillRect(0, 0, w, h);

    // Render strokes for active side onto an offscreen layer so eraser only clears ink
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tCtx = temp.getContext('2d')!;

    const list = [
      ...strokes.filter((s) => s.side === side),
      ...(extraStroke ? [extraStroke] : []),
    ];

    for (const s of list) {
      if (s.points.length === 0) continue;
      tCtx.save();
      tCtx.lineCap = 'round';
      tCtx.lineJoin = 'round';
      tCtx.lineWidth = Math.max(2, s.size * w);
      if (s.isEraser) {
        tCtx.globalCompositeOperation = 'destination-out';
        tCtx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.strokeStyle = s.color;
      }
      tCtx.beginPath();
      const first = s.points[0];
      tCtx.moveTo(first.u * w, (1 - first.v) * h);
      for (let i = 1; i < s.points.length; i++) {
        tCtx.lineTo(s.points[i].u * w, (1 - s.points[i].v) * h);
      }
      if (s.points.length === 1) {
        tCtx.lineTo(first.u * w + 0.2, (1 - first.v) * h + 0.2);
      }
      tCtx.stroke();
      tCtx.restore();
    }

    ctx.drawImage(temp, 0, 0);
  };

  useEffect(() => {
    renderCanvas(null);
  }, [strokes, side, bodyColor]);

  const getUv = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return { u, v };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDownRef.current = true;
    const pt = getUv(e.clientX, e.clientY);
    currentStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      side,
      points: [pt],
      color: brushColor,
      size: brushSize,
      isEraser,
    };
    renderCanvas(currentStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDownRef.current || !currentStrokeRef.current) return;
    const pt = getUv(e.clientX, e.clientY);
    currentStrokeRef.current.points.push(pt);
    renderCanvas(currentStrokeRef.current);
  };

  const handlePointerUp = () => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      onAddStroke(currentStrokeRef.current);
    }
    currentStrokeRef.current = null;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-[#5A606B]">
        <span>Prancheta rápida ({side === 'front' ? 'Frente' : 'Costas'})</span>
        <span>Sincronizado em 3D</span>
      </div>
      <canvas
        ref={canvasRef}
        width={260}
        height={290}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full aspect-[260/290] rounded-xl border border-[#DBD6BE] cursor-crosshair touch-none shadow-inner"
      />
    </div>
  );
};
