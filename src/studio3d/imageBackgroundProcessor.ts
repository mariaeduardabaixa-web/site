export interface ProcessedImageResult {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  backgroundRemoved: boolean;
}

function colorDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Removes uniform or smoothly shaded studio backgrounds from an RGBA pixel buffer
 * via border-connected flood fill + soft edge feathering + color decontamination,
 * so the bag's chosen color and cotton weave appear as the photo's background.
 */
export function processImageBufferForBagBackground(
  srcData: Uint8ClampedArray,
  w: number,
  h: number
): ProcessedImageResult {
  const total = w * h;
  const out = new Uint8ClampedArray(srcData);

  if (w < 4 || h < 4) {
    return { width: w, height: h, data: out, backgroundRemoved: false };
  }

  // 1. Gather perimeter pixels (outer 2px ring) to inspect transparency & background color
  const borderIndices: number[] = [];
  let transparentBorderCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 2 || x >= w - 2 || y < 2 || y >= h - 2) {
        const idx = y * w + x;
        borderIndices.push(idx);
        if (out[idx * 4 + 3] < 245) {
          transparentBorderCount++;
        }
      }
    }
  }

  // Image already has a transparent outer background -> preserve as-is
  if (transparentBorderCount / Math.max(1, borderIndices.length) >= 0.25) {
    return { width: w, height: h, data: out, backgroundRemoved: false };
  }

  // 2. Quantize border colors into 16-step buckets to find the dominant background color
  const buckets = new Map<
    number,
    { count: number; sumR: number; sumG: number; sumB: number }
  >();
  for (const idx of borderIndices) {
    const p = idx * 4;
    const br = out[p] >> 4;
    const bg = out[p + 1] >> 4;
    const bb = out[p + 2] >> 4;
    const key = (br << 8) | (bg << 4) | bb;
    const entry = buckets.get(key);
    if (entry) {
      entry.count++;
      entry.sumR += out[p];
      entry.sumG += out[p + 1];
      entry.sumB += out[p + 2];
    } else {
      buckets.set(key, { count: 1, sumR: out[p], sumG: out[p + 1], sumB: out[p + 2] });
    }
  }

  let bestKey = 0;
  let bestClusterScore = -1;
  for (const [key] of buckets) {
    const kr = (key >> 8) & 0xf;
    const kg = (key >> 4) & 0xf;
    const kb = key & 0xf;
    let score = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dg = -1; dg <= 1; dg++) {
        for (let db = -1; db <= 1; db++) {
          const nr = kr + dr;
          const ng = kg + dg;
          const nb = kb + db;
          if (nr < 0 || nr > 15 || ng < 0 || ng > 15 || nb < 0 || nb > 15) continue;
          const nKey = (nr << 8) | (ng << 4) | nb;
          const found = buckets.get(nKey);
          if (found) score += found.count;
        }
      }
    }
    if (score > bestClusterScore) {
      bestClusterScore = score;
      bestKey = key;
    }
  }

  const bestR = (bestKey >> 8) & 0xf;
  const bestG = (bestKey >> 4) & 0xf;
  const bestB = bestKey & 0xf;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumCount = 0;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dg = -1; dg <= 1; dg++) {
      for (let db = -1; db <= 1; db++) {
        const nr = bestR + dr;
        const ng = bestG + dg;
        const nb = bestB + db;
        if (nr < 0 || nr > 15 || ng < 0 || ng > 15 || nb < 0 || nb > 15) continue;
        const found = buckets.get((nr << 8) | (ng << 4) | nb);
        if (found) {
          sumR += found.sumR;
          sumG += found.sumG;
          sumB += found.sumB;
          sumCount += found.count;
        }
      }
    }
  }

  const bgR = sumR / Math.max(1, sumCount);
  const bgG = sumG / Math.max(1, sumCount);
  const bgB = sumB / Math.max(1, sumCount);

  // Measure how consistently the perimeter matches this dominant background color
  let matchCount = 0;
  let distAccum = 0;
  for (const idx of borderIndices) {
    const p = idx * 4;
    const d = colorDist(out[p], out[p + 1], out[p + 2], bgR, bgG, bgB);
    if (d <= 48) {
      matchCount++;
      distAccum += d;
    }
  }

  const borderMatchRatio = matchCount / Math.max(1, borderIndices.length);
  if (borderMatchRatio < 0.45) {
    // Busy full-bleed scene photo without a consistent outer background
    return { width: w, height: h, data: out, backgroundRemoved: false };
  }

  const borderSpread = distAccum / Math.max(1, matchCount);
  const isFlatDigitalBg = borderSpread < 5.0 && borderMatchRatio >= 0.84;
  const maxGlobalDist = isFlatDigitalBg
    ? Math.max(24, Math.min(38, 22 + borderSpread * 2.5))
    : Math.max(46, Math.min(78, 44 + borderSpread * 2.2));
  const maxStepDist = isFlatDigitalBg ? 24 : 15;

  // 3. Edge-connected 4-neighbor BFS flood fill
  const visited = new Uint8Array(total);
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (out[p + 3] < 20) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[tail++] = idx;
      return;
    }
    const d = colorDist(out[p], out[p + 1], out[p + 2], bgR, bgG, bgB);
    if (d <= maxGlobalDist) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  if (tail === 0) {
    return { width: w, height: h, data: out, backgroundRemoved: false };
  }

  const dx4 = [1, -1, 0, 0];
  const dy4 = [0, 0, 1, -1];

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    const p = idx * 4;
    const cr = out[p];
    const cg = out[p + 1];
    const cb = out[p + 2];

    for (let k = 0; k < 4; k++) {
      const nx = x + dx4[k];
      const ny = y + dy4[k];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;
      const np = nIdx * 4;

      if (out[np + 3] < 20) {
        visited[nIdx] = 1;
        isBg[nIdx] = 1;
        queue[tail++] = nIdx;
        continue;
      }

      const nr = out[np];
      const ng = out[np + 1];
      const nb = out[np + 2];
      const dGlobal = colorDist(nr, ng, nb, bgR, bgG, bgB);
      if (dGlobal > maxGlobalDist) continue;
      const dStep = colorDist(nr, ng, nb, cr, cg, cb);
      if (dStep > maxStepDist) continue;

      visited[nIdx] = 1;
      isBg[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }

  // 4. For crisp digital graphics/logos on flat backgrounds, also clear enclosed background loops
  if (isFlatDigitalBg) {
    const holeVisited = new Uint8Array(total);
    const compQueue = new Int32Array(total);
    for (let startIdx = 0; startIdx < total; startIdx++) {
      if (isBg[startIdx] || holeVisited[startIdx]) continue;
      const sp = startIdx * 4;
      if (colorDist(out[sp], out[sp + 1], out[sp + 2], bgR, bgG, bgB) > 14) {
        continue;
      }

      let cHead = 0;
      let cTail = 0;
      compQueue[cTail++] = startIdx;
      holeVisited[startIdx] = 1;
      let validHole = true;
      let sumD = 0;
      let maxD = 0;

      while (cHead < cTail) {
        const cur = compQueue[cHead++];
        const cp = cur * 4;
        const d = colorDist(out[cp], out[cp + 1], out[cp + 2], bgR, bgG, bgB);
        sumD += d;
        if (d > maxD) maxD = d;
        if (d > 24 || cTail > total * 0.18) {
          validHole = false;
        }

        const cx = cur % w;
        const cy = (cur - cx) / w;
        for (let k = 0; k < 4; k++) {
          const nx = cx + dx4[k];
          const ny = cy + dy4[k];
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (isBg[nIdx] || holeVisited[nIdx]) continue;
          const np = nIdx * 4;
          const nd = colorDist(out[np], out[np + 1], out[np + 2], bgR, bgG, bgB);
          if (nd <= 24) {
            holeVisited[nIdx] = 1;
            compQueue[cTail++] = nIdx;
          }
        }
      }

      if (validHole && cTail > 0 && sumD / cTail <= 14 && maxD <= 24) {
        for (let i = 0; i < cTail; i++) {
          isBg[compQueue[i]] = 1;
        }
      }
    }
  }

  // 5. Apply transparency + anti-aliased edge feathering + background color decontamination
  let bgPixelsCleared = 0;
  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      out[i * 4 + 3] = 0;
      bgPixelsCleared++;
    }
  }

  if (bgPixelsCleared === 0 || bgPixelsCleared >= total * 0.995) {
    // Safety guard: never wipe out the entire image
    return { width: w, height: h, data: new Uint8ClampedArray(srcData), backgroundRemoved: false };
  }

  const rampLow = isFlatDigitalBg ? 8 : 12;
  const rampHigh = isFlatDigitalBg ? 32 : 42;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (isBg[idx]) continue;

      // Check if this foreground pixel is directly adjacent to cleared background
      let adjBgR = 0;
      let adjBgG = 0;
      let adjBgB = 0;
      let adjBgCount = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (isBg[nIdx]) {
            const np = nIdx * 4;
            adjBgR += srcData[np];
            adjBgG += srcData[np + 1];
            adjBgB += srcData[np + 2];
            adjBgCount++;
          }
        }
      }

      if (adjBgCount === 0) continue;

      const localBgR = adjBgR / adjBgCount;
      const localBgG = adjBgG / adjBgCount;
      const localBgB = adjBgB / adjBgCount;

      const p = idx * 4;
      const pr = out[p];
      const pg = out[p + 1];
      const pb = out[p + 2];
      const d = colorDist(pr, pg, pb, localBgR, localBgG, localBgB);

      if (d <= rampLow) {
        out[p + 3] = 0;
      } else if (d < rampHigh) {
        const factor = (d - rampLow) / (rampHigh - rampLow);
        const nextAlpha = Math.round(out[p + 3] * factor);
        out[p + 3] = nextAlpha;

        // De-halo RGB away from the removed background color
        const inv = 1 - factor;
        const denom = Math.max(0.28, factor);
        out[p] = Math.min(255, Math.max(0, Math.round((pr - localBgR * inv) / denom)));
        out[p + 1] = Math.min(
          255,
          Math.max(0, Math.round((pg - localBgG * inv) / denom))
        );
        out[p + 2] = Math.min(
          255,
          Math.max(0, Math.round((pb - localBgB * inv) / denom))
        );
      }
    }
  }

  return { width: w, height: h, data: out, backgroundRemoved: true };
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem enviada'));
    img.src = dataUrl;
  });
}

/**
 * Prepares an uploaded customer image for placement on the ecobag:
 * removes uniform/studio outer backgrounds cleanly so the chosen bag color
 * becomes the photo's background, and trims excess empty transparent margins.
 */
export async function prepareUploadedPhotoForBag(
  dataUrl: string,
  mimeType?: string
): Promise<string> {
  if (mimeType === 'image/svg+xml' || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }

  try {
    const img = await loadHtmlImage(dataUrl);
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return dataUrl;

    const maxDim = 900;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const processed = processImageBufferForBagBackground(imgData.data, w, h);

    if (!processed.backgroundRemoved) {
      // Still return resized image if oversized so bag texture & saves stay fast
      return scale < 1 ? canvas.toDataURL('image/png') : dataUrl;
    }

    const outImageData = new ImageData(
      new Uint8ClampedArray(processed.data),
      w,
      h
    );
    ctx.putImageData(outImageData, 0, 0);

    // Trim excessive empty transparent padding (keeping a clean 4px margin)
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    const d = processed.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return dataUrl;
    }

    const pad = 4;
    const cx0 = Math.max(0, minX - pad);
    const cy0 = Math.max(0, minY - pad);
    const cw = Math.min(w - cx0, maxX - minX + 1 + pad * 2);
    const ch = Math.min(h - cy0, maxY - minY + 1 + pad * 2);

    const trimCanvas = document.createElement('canvas');
    trimCanvas.width = cw;
    trimCanvas.height = ch;
    const trimCtx = trimCanvas.getContext('2d');
    if (!trimCtx) return canvas.toDataURL('image/png');

    trimCtx.drawImage(canvas, cx0, cy0, cw, ch, 0, 0, cw, ch);
    return trimCanvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}
