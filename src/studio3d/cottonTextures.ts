import * as THREE from 'three';

export interface CottonTextureBundle {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  weaveOverlayCanvas: HTMLCanvasElement;
  contactShadowTexture: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates seamless procedural cotton canvas twill weave textures
 * (normal map, roughness map, and overlay grain) with zero external 404 assets.
 */
export function createCottonTextures(maxAnisotropy: number): CottonTextureBundle {
  const size = 256;

  // 1. Heightfield for fine 280g natural cotton canvas plain/twill weave
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin((x / size) * Math.PI * 80);
      const weft = Math.sin((y / size) * Math.PI * 80);
      const twill = Math.sin(((x + y) / size) * Math.PI * 40);
      const microNoise =
        (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      height[y * size + x] =
        0.5 +
        0.16 * warp * weft +
        0.1 * twill +
        0.04 * (Math.abs(microNoise) - 0.5);
    }
  }

  // 2. Normal Map Canvas (Linear space)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(size, size);

  const strength = 1.45;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;

      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * size + x) * 4;
      nImg.data[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(7, 7);
  normalMap.anisotropy = maxAnisotropy;

  // 3. Roughness Map Canvas (Linear space, velvety matte cotton 0.88 - 0.97)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const val = Math.round(224 + height[i] * 24);
    const idx = i * 4;
    rImg.data[idx] = val;
    rImg.data[idx + 1] = val;
    rImg.data[idx + 2] = val;
    rImg.data[idx + 3] = 255;
  }
  rCtx.putImageData(rImg, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(7, 7);
  roughnessMap.anisotropy = maxAnisotropy;

  // 4. Subtle weave overlay canvas for composited print textures
  const weaveOverlayCanvas = document.createElement('canvas');
  weaveOverlayCanvas.width = size;
  weaveOverlayCanvas.height = size;
  const wCtx = weaveOverlayCanvas.getContext('2d')!;
  const wImg = wCtx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const lum = Math.round(240 + (height[i] - 0.5) * 20);
    const idx = i * 4;
    wImg.data[idx] = lum;
    wImg.data[idx + 1] = lum - 1;
    wImg.data[idx + 2] = lum - 2;
    wImg.data[idx + 3] = 255;
  }
  wCtx.putImageData(wImg, 0, 0);

  // 5. Soft studio floor contact shadow texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 512;
  shadowCanvas.height = 512;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(256, 256, 24, 256, 256, 248);
  grad.addColorStop(0, 'rgba(24, 26, 31, 0.34)');
  grad.addColorStop(0.42, 'rgba(24, 26, 31, 0.16)');
  grad.addColorStop(0.75, 'rgba(24, 26, 31, 0.04)');
  grad.addColorStop(1, 'rgba(24, 26, 31, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 512, 512);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);

  return {
    normalMap,
    roughnessMap,
    weaveOverlayCanvas,
    contactShadowTexture,
    dispose: () => {
      normalMap.dispose();
      roughnessMap.dispose();
      contactShadowTexture.dispose();
    },
  };
}
