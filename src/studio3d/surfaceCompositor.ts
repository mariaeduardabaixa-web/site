import * as THREE from 'three';
import {
  BagConfiguration,
  BagElement,
  BagSide,
  DrawingStroke,
  PrintElement,
  TextElement,
} from '../types';

const TEX_SIZE = 1024;

export class BagSurfaceCompositor {
  public frontCanvas: HTMLCanvasElement;
  public backCanvas: HTMLCanvasElement;
  public frontTexture: THREE.CanvasTexture;
  public backTexture: THREE.CanvasTexture;

  private frontCtx: CanvasRenderingContext2D;
  private backCtx: CanvasRenderingContext2D;
  private imageCache = new Map<string, HTMLImageElement>();
  private elementBounds = new Map<string, { halfW: number; halfH: number }>();
  private weavePattern: CanvasPattern | null = null;
  private onImageLoadedCallback?: () => void;

  constructor(
    weaveOverlayCanvas: HTMLCanvasElement,
    maxAnisotropy: number,
    onImageLoaded?: () => void
  ) {
    this.onImageLoadedCallback = onImageLoaded;

    this.frontCanvas = document.createElement('canvas');
    this.frontCanvas.width = TEX_SIZE;
    this.frontCanvas.height = TEX_SIZE;
    this.frontCtx = this.frontCanvas.getContext('2d')!;

    this.backCanvas = document.createElement('canvas');
    this.backCanvas.width = TEX_SIZE;
    this.backCanvas.height = TEX_SIZE;
    this.backCtx = this.backCanvas.getContext('2d')!;

    this.weavePattern = this.frontCtx.createPattern(weaveOverlayCanvas, 'repeat');

    this.frontTexture = new THREE.CanvasTexture(this.frontCanvas);
    this.frontTexture.colorSpace = THREE.SRGBColorSpace;
    this.frontTexture.anisotropy = maxAnisotropy;

    this.backTexture = new THREE.CanvasTexture(this.backCanvas);
    this.backTexture.colorSpace = THREE.SRGBColorSpace;
    this.backTexture.anisotropy = maxAnisotropy;
  }

  private getOrLoadImage(url: string): HTMLImageElement | null {
    const cached = this.imageCache.get(url);
    if (cached) {
      return cached.complete && cached.naturalWidth > 0 ? cached : null;
    }
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      this.onImageLoadedCallback?.();
    };
    img.src = url;
    this.imageCache.set(url, img);
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  public render(
    config: BagConfiguration,
    selectedElementId: string | null
  ): void {
    this.renderSide('front', this.frontCtx, config, selectedElementId);
    this.renderSide('back', this.backCtx, config, selectedElementId);
    this.frontTexture.needsUpdate = true;
    this.backTexture.needsUpdate = true;
  }

  private renderSide(
    side: BagSide,
    ctx: CanvasRenderingContext2D,
    config: BagConfiguration,
    selectedElementId: string | null
  ): void {
    // 1. Base cotton dye color
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = config.bodyColor;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Subtle organic dye variation vignette near bottom/edges
    const grad = ctx.createRadialGradient(
      TEX_SIZE * 0.5,
      TEX_SIZE * 0.45,
      TEX_SIZE * 0.15,
      TEX_SIZE * 0.5,
      TEX_SIZE * 0.5,
      TEX_SIZE * 0.72
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.restore();

    // 2. Render drawing strokes for this side (if visible)
    if (config.drawingVisible) {
      const sideStrokes = config.drawingStrokes.filter((s) => s.side === side);
      if (sideStrokes.length > 0) {
        this.renderStrokesLayer(ctx, sideStrokes);
      }
    }

    // 3. Render ordered prints and texts for this side (bottons are real 3D meshes!)
    const sideElements = config.elements
      .filter(
        (el): el is PrintElement | TextElement =>
          el.side === side &&
          el.visible &&
          (el.type === 'print' || el.type === 'text')
      )
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sideElements) {
      if (el.type === 'print') {
        this.drawPrintElement(ctx, el, el.id === selectedElementId);
      } else if (el.type === 'text') {
        this.drawTextElement(ctx, el, el.id === selectedElementId);
      }
    }

    // 4. Multiply subtle cotton twill grain across entire surface so ink sits IN the fabric
    if (this.weavePattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = this.weavePattern;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.restore();
    }
  }

  private renderStrokesLayer(
    ctx: CanvasRenderingContext2D,
    strokes: DrawingStroke[]
  ): void {
    // Draw onto a separate temporary canvas so eraser strokes erase only drawing ink, not fabric color
    const temp = document.createElement('canvas');
    temp.width = TEX_SIZE;
    temp.height = TEX_SIZE;
    const tCtx = temp.getContext('2d')!;

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      tCtx.save();
      tCtx.lineCap = 'round';
      tCtx.lineJoin = 'round';
      tCtx.lineWidth = Math.max(2, stroke.size * TEX_SIZE);
      if (stroke.isEraser) {
        tCtx.globalCompositeOperation = 'destination-out';
        tCtx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.strokeStyle = stroke.color;
      }

      tCtx.beginPath();
      const first = stroke.points[0];
      tCtx.moveTo(first.u * TEX_SIZE, (1 - first.v) * TEX_SIZE);
      if (stroke.points.length === 1) {
        tCtx.lineTo(first.u * TEX_SIZE + 0.1, (1 - first.v) * TEX_SIZE + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          tCtx.lineTo(p.u * TEX_SIZE, (1 - p.v) * TEX_SIZE);
        }
      }
      tCtx.stroke();
      tCtx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  }

  private drawPrintElement(
    ctx: CanvasRenderingContext2D,
    el: PrintElement,
    isSelected: boolean
  ): void {
    const img = this.getOrLoadImage(el.imageUrl);
    const cx = (0.5 + el.x) * TEX_SIZE;
    const cy = (0.5 - el.y) * TEX_SIZE;
    const baseSize = TEX_SIZE * 0.56 * el.scale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);

    let drawW = baseSize;
    let drawH = baseSize;

    if (img) {
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      if (aspect >= 1) {
        drawW = baseSize;
        drawH = baseSize / aspect;
      } else {
        drawH = baseSize;
        drawW = baseSize * aspect;
      }
      ctx.globalAlpha = 0.98;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    this.elementBounds.set(el.id, {
      halfW: Math.max(0.055, drawW / TEX_SIZE / 2),
      halfH: Math.max(0.055, drawH / TEX_SIZE / 2),
    });

    if (isSelected) {
      this.drawSelectionBox(ctx, drawW, drawH);
    }
    ctx.restore();
  }

  private drawTextElement(
    ctx: CanvasRenderingContext2D,
    el: TextElement,
    isSelected: boolean
  ): void {
    const cx = (0.5 + el.x) * TEX_SIZE;
    const cy = (0.5 - el.y) * TEX_SIZE;
    const fontSize = Math.round(76 * el.scale);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.font = `600 ${fontSize}px "${el.fontFamily}", sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textAlign = el.align;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.95;

    const lines = (el.text || ' ').split('\n');
    const lineHeight = fontSize * 1.18;
    const totalH = lines.length * lineHeight;
    let maxW = 0;

    lines.forEach((line, idx) => {
      const metrics = ctx.measureText(line);
      maxW = Math.max(maxW, metrics.width);
      const yOffset = (idx - (lines.length - 1) / 2) * lineHeight;
      const xAnchor =
        el.align === 'left'
          ? -maxW / 2
          : el.align === 'right'
            ? maxW / 2
            : 0;
      ctx.fillText(line, xAnchor, yOffset);
    });

    const boxW = Math.max(80, maxW + 28);
    const boxH = Math.max(60, totalH + 20);
    this.elementBounds.set(el.id, {
      halfW: Math.max(0.06, boxW / TEX_SIZE / 2),
      halfH: Math.max(0.045, boxH / TEX_SIZE / 2),
    });

    if (isSelected) {
      this.drawSelectionBox(ctx, boxW, boxH);
    }
    ctx.restore();
  }

  private drawSelectionBox(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#536895';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    ctx.restore();
  }

  /**
   * Finds which front/back print or text element sits at normalized face UV (u, v)
   * for direct click selection on the 3D bag.
   */
  public hitTestElement(
    elements: BagElement[],
    side: BagSide,
    u: number,
    v: number
  ): BagElement | null {
    const nx = u - 0.5;
    const ny = v - 0.5;
    const candidates = elements
      .filter(
        (el) =>
          el.side === side &&
          el.visible &&
          (el.type === 'print' || el.type === 'text')
      )
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const el of candidates) {
      const bounds = this.elementBounds.get(el.id);
      const halfSpan =
        bounds?.halfW ??
        (el.type === 'print' ? 0.28 * el.scale : 0.24 * el.scale);
      const halfH =
        bounds?.halfH ??
        (el.type === 'print' ? 0.28 * el.scale : 0.12 * el.scale);

      const dx = nx - el.x;
      const dy = ny - el.y;
      // Element canvas rotation is clockwise in canvas Y-down space, which corresponds to -rotation in UV Y-up space
      const rad = (el.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      if (
        Math.abs(localX) <= Math.max(0.06, halfSpan) &&
        Math.abs(localY) <= Math.max(0.05, halfH)
      ) {
        return el;
      }
    }
    return null;
  }

  public dispose(): void {
    this.frontTexture.dispose();
    this.backTexture.dispose();
    this.imageCache.clear();
  }
}
