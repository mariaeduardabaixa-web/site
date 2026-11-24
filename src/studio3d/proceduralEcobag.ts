import * as THREE from 'three';
import { BagSide, BagSizeId, BottonElement } from '../types';
import { CottonTextureBundle } from './cottonTextures';
import {
  EcobagDimensions,
  EcobagModelHandles,
  IEcobagModelProvider,
  SIZE_TO_WORLD_DIMENSIONS,
  SurfacePointSample,
} from './ecobagModelAdapter';

/**
 * Evaluates a sculpted, relaxed natural cotton canvas tote surface point for front/back
 * panels, with soft corner slouch folds, slim tapered top opening, and folded top hem.
 */
function evaluatePanelPoint(
  dim: EcobagDimensions,
  side: BagSide,
  u: number, // [0..1] left -> right from viewer facing that side
  v: number // [0..1] bottom -> top
): THREE.Vector3 {
  const halfD = dim.depth * 0.5;

  // Tucked bottom corners -> soft lower slouch bulge -> gently wider open top rim
  const bottomCornerTuck = Math.pow(Math.max(0, 1 - v / 0.13), 1.7) * 0.055;
  const lowerSlouchBulge = Math.exp(-Math.pow((v - 0.14) / 0.11, 2)) * 0.025;
  const topFlare = Math.pow(v, 0.85) * 0.125;
  const widthFactor = 0.895 - bottomCornerTuck + lowerSlouchBulge + topFlare;

  // Local X relative to the facing side
  const localX = (u - 0.5) * dim.width * widthFactor;
  const worldX = side === 'front' ? localX : -localX;

  // Gentle organic top-rim dip between handle anchors & softly tucked bottom corners
  const midDist = Math.abs(u - 0.5);
  const centerSag = Math.exp(-Math.pow((u - 0.5) / 0.14, 2)) * 0.022;
  const cornerDroop =
    Math.pow(Math.max(0, (midDist - 0.32) / 0.18), 1.6) * 0.012;
  const topYContour = 1 - Math.pow(v, 3) * (centerSag + cornerDroop);
  const bottomCornerLift =
    Math.pow(Math.max(0, 1 - v / 0.08), 1.6) *
    Math.pow(midDist * 2, 2.6) *
    0.014;
  const worldY = Math.max(0, (v * topYContour + bottomCornerLift) * dim.height);

  // Tote depth profile: fuller in lower-mid body, slim tapered top rim, rounded side edges
  const belly = Math.sin(v * Math.PI) * 0.13;
  const lowerFullness = Math.exp(-Math.pow((v - 0.22) / 0.22, 2)) * 0.18;
  const edgeWrap = Math.pow(
    Math.max(0, 1 - Math.pow(Math.abs(u - 0.5) * 2, 2.35)),
    0.65
  );
  const edgeBase = 0.12 + 0.88 * edgeWrap;
  const topPinch = 1 - Math.pow(Math.max(0, (v - 0.7) / 0.3), 1.45) * 0.74;

  // Organic cloth drape & corner folds (zero amplitude at u=0 / u=1 so side seams stay sealed)
  const seamEnvelope = Math.sin(u * Math.PI);
  const leftCornerFold =
    Math.exp(-Math.pow((u - 0.13 - v * 0.2) / 0.085, 2)) *
    Math.exp(-Math.pow((v - 0.16) / 0.17, 2)) *
    0.036;
  const rightCornerFold =
    Math.exp(-Math.pow((u - 0.87 + v * 0.2) / 0.085, 2)) *
    Math.exp(-Math.pow((v - 0.16) / 0.17, 2)) *
    -0.03;
  const handleTensionFold =
    Math.sin((u - 0.5) * Math.PI * 3.8 + 0.35) *
    0.017 *
    Math.pow(v, 1.35) *
    (1 - Math.abs(u - 0.5) * 1.45);
  const lowerEdgeDimple =
    Math.sin(u * Math.PI * 3.0) * 0.015 * Math.exp(-Math.pow(v / 0.2, 2));

  // Subtle folded top hem band ridge
  const hemStep = THREE.MathUtils.smoothstep(v, 0.905, 0.935) * 0.011;

  const zMag =
    halfD * (0.72 + belly + lowerFullness) * edgeBase * topPinch +
    (leftCornerFold + rightCornerFold + handleTensionFold + lowerEdgeDimple) *
      seamEnvelope +
    hemStep;

  const worldZ = side === 'front' ? zMag : -zMag;
  return new THREE.Vector3(worldX, worldY, worldZ);
}

function buildPanelGeometry(
  dim: EcobagDimensions,
  side: BagSide,
  segU = 48,
  segV = 52
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const p = evaluatePanelPoint(dim, side, u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segU + 1) + iu;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeTangents();
  return geo;
}

/**
 * Builds slim, rounded side seams & soft boxed base connecting Front and Back panels.
 */
function buildGussetAndBottomGeometry(
  dim: EcobagDimensions,
  segV = 52,
  segDepth = 12
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const appendStrip = (
    cols: number,
    rows: number,
    pointFn: (c: number, r: number) => THREE.Vector3,
    flipWinding = false
  ) => {
    const baseIdx = positions.length / 3;
    for (let r = 0; r <= rows; r++) {
      const vr = r / rows;
      for (let c = 0; c <= cols; c++) {
        const uc = c / cols;
        const pt = pointFn(uc, vr);
        positions.push(pt.x, pt.y, pt.z);
        uvs.push(uc, vr);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = baseIdx + r * (cols + 1) + c;
        const b = a + 1;
        const d = baseIdx + (r + 1) * (cols + 1) + c + 1;
        const e = baseIdx + (r + 1) * (cols + 1) + c;
        if (!flipWinding) {
          indices.push(a, b, d);
          indices.push(a, d, e);
        } else {
          indices.push(a, d, b);
          indices.push(a, e, d);
        }
      }
    }
  };

  // Right side seam / slim fold (x > 0): connects Front right (u=1) to Back left (u=0)
  appendStrip(segDepth, segV, (uc, vr) => {
    const pFront = evaluatePanelPoint(dim, 'front', 1, vr);
    const pBack = evaluatePanelPoint(dim, 'back', 0, vr);
    const p = new THREE.Vector3().lerpVectors(pFront, pBack, uc);
    // Subtle outward stitched edge cushion with gentle inward center crease
    const round = Math.sin(uc * Math.PI) * 0.032 * (1 - vr * 0.45);
    const midDip = Math.exp(-Math.pow((uc - 0.5) / 0.16, 2)) * 0.024 * (0.4 + 0.6 * vr);
    p.x += round - midDip;
    return p;
  });

  // Left side seam / slim fold (x < 0): connects Back right (u=1) to Front left (u=0)
  appendStrip(segDepth, segV, (uc, vr) => {
    const pBack = evaluatePanelPoint(dim, 'back', 1, vr);
    const pFront = evaluatePanelPoint(dim, 'front', 0, vr);
    const p = new THREE.Vector3().lerpVectors(pBack, pFront, uc);
    const round = Math.sin(uc * Math.PI) * 0.032 * (1 - vr * 0.45);
    const midDip = Math.exp(-Math.pow((uc - 0.5) / 0.16, 2)) * 0.024 * (0.4 + 0.6 * vr);
    p.x -= round - midDip;
    return p;
  });

  // Soft rested bottom base (v=0): connects Front bottom to Back bottom
  appendStrip(32, segDepth, (uc, vr) => {
    const pFront = evaluatePanelPoint(dim, 'front', uc, 0);
    const pBack = evaluatePanelPoint(dim, 'back', 1 - uc, 0);
    const p = new THREE.Vector3().lerpVectors(pFront, pBack, vr);
    p.y = Math.min(p.y, 0.004);
    return p;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeTangents();
  return geo;
}

/**
 * Builds the top folded cotton cuff & hollow inner cavity visible from above.
 */
function buildInnerLiningAndCuff(dim: EcobagDimensions): {
  cuffGeo: THREE.BufferGeometry;
  liningGeo: THREE.BufferGeometry;
} {
  const perimeterPts: THREE.Vector3[] = [];
  const stepsSide = 34;
  const stepsGusset = 8;

  // Front top edge (left to right)
  for (let i = 0; i < stepsSide; i++) {
    perimeterPts.push(evaluatePanelPoint(dim, 'front', i / stepsSide, 1));
  }
  // Right edge top
  for (let i = 0; i < stepsGusset; i++) {
    const pF = evaluatePanelPoint(dim, 'front', 1, 1);
    const pB = evaluatePanelPoint(dim, 'back', 0, 1);
    const t = i / stepsGusset;
    const p = new THREE.Vector3().lerpVectors(pF, pB, t);
    p.x += Math.sin(t * Math.PI) * 0.014;
    perimeterPts.push(p);
  }
  // Back top edge
  for (let i = 0; i < stepsSide; i++) {
    perimeterPts.push(evaluatePanelPoint(dim, 'back', i / stepsSide, 1));
  }
  // Left edge top
  for (let i = 0; i < stepsGusset; i++) {
    const pB = evaluatePanelPoint(dim, 'back', 1, 1);
    const pF = evaluatePanelPoint(dim, 'front', 0, 1);
    const t = i / stepsGusset;
    const p = new THREE.Vector3().lerpVectors(pB, pF, t);
    p.x -= Math.sin(t * Math.PI) * 0.014;
    perimeterPts.push(p);
  }

  const N = perimeterPts.length;
  const cuffPositions: number[] = [];
  const cuffUvs: number[] = [];
  const cuffIndices: number[] = [];
  const thickness = 0.022;
  const cuffDepth = 0.24;

  // Outer-top -> rim-top -> inner-rim -> inner-cuff-bottom
  const rings = 4;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i <= N; i++) {
      const p = perimeterPts[i % N];
      const inward = new THREE.Vector3(-p.x, 0, -p.z).normalize();
      const pt = p.clone();
      if (r === 0) {
        pt.y -= cuffDepth * 0.08;
        pt.addScaledVector(inward, -0.005);
      } else if (r === 1) {
        pt.y += 0.016;
        pt.addScaledVector(inward, thickness * 0.22);
      } else if (r === 2) {
        pt.y += 0.012;
        pt.addScaledVector(inward, thickness);
      } else {
        pt.y -= cuffDepth;
        pt.addScaledVector(inward, thickness * 1.12);
      }
      cuffPositions.push(pt.x, pt.y, pt.z);
      cuffUvs.push(i / N, r / (rings - 1));
    }
  }

  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < N; i++) {
      const a = r * (N + 1) + i;
      const b = a + 1;
      const c = (r + 1) * (N + 1) + i;
      const d = c + 1;
      cuffIndices.push(a, b, d);
      cuffIndices.push(a, d, c);
    }
  }

  const cuffGeo = new THREE.BufferGeometry();
  cuffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cuffPositions, 3));
  cuffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cuffUvs, 2));
  cuffGeo.setIndex(cuffIndices);
  cuffGeo.computeVertexNormals();

  // Inner cotton cavity wall descending inside the bag
  const liningPositions: number[] = [];
  const liningUvs: number[] = [];
  const liningIndices: number[] = [];
  const liningRows = 8;

  for (let r = 0; r <= liningRows; r++) {
    const t = r / liningRows;
    for (let i = 0; i <= N; i++) {
      const p = perimeterPts[i % N];
      const inward = new THREE.Vector3(-p.x, 0, -p.z).normalize();
      const pt = p.clone();
      pt.y = THREE.MathUtils.lerp(p.y - cuffDepth * 0.8, 0.08, t);
      pt.addScaledVector(inward, thickness * 1.18 + t * 0.025);
      liningPositions.push(pt.x, pt.y, pt.z);
      liningUvs.push(i / N, t);
    }
  }

  for (let r = 0; r < liningRows; r++) {
    for (let i = 0; i < N; i++) {
      const a = r * (N + 1) + i;
      const b = a + 1;
      const c = (r + 1) * (N + 1) + i;
      const d = c + 1;
      liningIndices.push(a, d, b);
      liningIndices.push(a, c, d);
    }
  }

  const liningGeo = new THREE.BufferGeometry();
  liningGeo.setAttribute('position', new THREE.Float32BufferAttribute(liningPositions, 3));
  liningGeo.setAttribute('uv', new THREE.Float32BufferAttribute(liningUvs, 2));
  liningGeo.setIndex(liningIndices);
  liningGeo.computeVertexNormals();

  return { cuffGeo, liningGeo };
}

/**
 * Sweeps a twist-free, uniform-width flat cotton webbing cross-section along a symmetric,
 * smoothly rounded tote handle arch with natural flush stitched attachment tabs.
 */
function buildCottonHandleGeometry(
  dim: EcobagDimensions,
  sideSign: 1 | -1
): THREE.BufferGeometry {
  const side: BagSide = sideSign > 0 ? 'front' : 'back';
  const uLeftAnchor = 0.315;
  const uRightAnchor = 0.685;
  const uLeftWorld = sideSign > 0 ? uLeftAnchor : uRightAnchor;
  const uRightWorld = sideSign > 0 ? uRightAnchor : uLeftAnchor;

  const strapW = dim.width * 0.08;
  const strapT = 0.042;
  const baseSurfaceOffset = strapT * 0.48 + 0.008;

  const pRimL = evaluatePanelPoint(dim, side, uLeftWorld, 1.0);
  const pRimR = evaluatePanelPoint(dim, side, uRightWorld, 1.0);
  const anchorX = (Math.abs(pRimL.x) + Math.abs(pRimR.x)) * 0.5;
  const rimY = (pRimL.y + pRimR.y) * 0.5;
  const rimZ = (pRimL.z + pRimR.z) * 0.5;

  // Balanced, realistic tote handle drop and broad rounded semi-elliptical top arch (zero pointed apex)
  const archDrop = dim.handleDrop * 0.82;
  const crownRadiusX = anchorX * 0.84;
  const crownRadiusY = crownRadiusX * 1.18;
  const legRise = Math.max(0.4, archDrop - crownRadiusY);
  const apexZ = rimZ + sideSign * 0.075;

  const pathPts: THREE.Vector3[] = [];
  const smoothstep01 = (t: number) => t * t * (3 - 2 * t);

  // 1. Left stitched attachment tab flush against top hem (v: 0.892 -> 1.00)
  const tabSteps = 10;
  const vTabStart = 0.892;
  for (let i = 0; i < tabSteps; i++) {
    const t = i / tabSteps;
    const v = THREE.MathUtils.lerp(vTabStart, 1.0, t);
    const p = evaluatePanelPoint(dim, side, uLeftWorld, v);
    const edgeFeather = THREE.MathUtils.smoothstep(t, 0.0, 0.22);
    const zOff = baseSurfaceOffset * (0.45 + 0.55 * edgeFeather);
    // Keep left & right anchor X symmetrically aligned into the rising strap
    p.x = THREE.MathUtils.lerp(p.x, -anchorX, t * 0.35);
    p.z += sideSign * zOff;
    pathPts.push(p);
  }

  // 2. Left leg rising smoothly with vertical entry & exit tangents (C1 continuous)
  const legSteps = 26;
  for (let i = 0; i < legSteps; i++) {
    const t = i / legSteps;
    const s = smoothstep01(t);
    const x = -THREE.MathUtils.lerp(anchorX, crownRadiusX, s);
    const y = rimY + legRise * t;
    const z = THREE.MathUtils.lerp(
      rimZ + sideSign * baseSurfaceOffset,
      THREE.MathUtils.lerp(rimZ + sideSign * baseSurfaceOffset, apexZ, 0.65),
      s
    );
    pathPts.push(new THREE.Vector3(x, y, z));
  }

  // 3. Smooth, rounded top shoulder arch (theta: 0 -> PI)
  const crownSteps = 52;
  const zCrownStart = THREE.MathUtils.lerp(
    rimZ + sideSign * baseSurfaceOffset,
    apexZ,
    0.65
  );
  for (let i = 0; i <= crownSteps; i++) {
    const theta = (i / crownSteps) * Math.PI;
    const x = -crownRadiusX * Math.cos(theta);
    const y = rimY + legRise + crownRadiusY * Math.sin(theta);
    const z = THREE.MathUtils.lerp(zCrownStart, apexZ, Math.sin(theta));
    pathPts.push(new THREE.Vector3(x, y, z));
  }

  // 4. Right leg descending symmetrically to top hem
  for (let i = 1; i <= legSteps; i++) {
    const t = 1 - i / legSteps;
    const s = smoothstep01(t);
    const x = THREE.MathUtils.lerp(anchorX, crownRadiusX, s);
    const y = rimY + legRise * t;
    const z = THREE.MathUtils.lerp(
      rimZ + sideSign * baseSurfaceOffset,
      zCrownStart,
      s
    );
    pathPts.push(new THREE.Vector3(x, y, z));
  }

  // 5. Right stitched attachment tab flush against top hem (v: 1.00 -> 0.892)
  for (let i = 1; i <= tabSteps; i++) {
    const t = 1 - i / tabSteps;
    const v = THREE.MathUtils.lerp(vTabStart, 1.0, t);
    const p = evaluatePanelPoint(dim, side, uRightWorld, v);
    const edgeFeather = THREE.MathUtils.smoothstep(t, 0.0, 0.22);
    const zOff = baseSurfaceOffset * (0.45 + 0.55 * edgeFeather);
    p.x = THREE.MathUtils.lerp(p.x, anchorX, t * 0.35);
    p.z += sideSign * zOff;
    pathPts.push(p);
  }

  // Substantial, smoothly rounded woven cotton webbing cross-section (16 points)
  const hw = strapW * 0.5;
  const ht = strapT * 0.5;
  const profile: Array<[number, number]> = [];
  const profileSegs = 16;
  for (let k = 0; k < profileSegs; k++) {
    const ang = (k / profileSegs) * Math.PI * 2;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    // Superellipse (n = 3.2) creates flat webbing faces with soft rounded textile edges
    const sx = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.62) * hw;
    const sy = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.72) * ht;
    profile.push([sx, sy]);
  }

  const ringLen = profile.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const refNormal = new THREE.Vector3(0, 0, sideSign);
  const widthDir = new THREE.Vector3();
  const thickDir = new THREE.Vector3();
  const vert = new THREE.Vector3();

  let cumArcLen = 0;
  for (let s = 0; s < pathPts.length; s++) {
    const pt = pathPts[s];
    if (s > 0) {
      cumArcLen += pt.distanceTo(pathPts[s - 1]);
    }
    const prev = pathPts[Math.max(0, s - 1)];
    const next = pathPts[Math.min(pathPts.length - 1, s + 1)];
    tangent.subVectors(next, prev).normalize();

    // Keeping refNormal strictly along ±Z ensures uniform widthDir across tabs, legs, and crown
    widthDir.crossVectors(refNormal, tangent).normalize();
    thickDir.crossVectors(tangent, widthDir).normalize();

    // Smoothly taper thickness only at the very bottom stitched seam edge (s=0 and s=last)
    const tabEndTaper =
      s === 0 || s === pathPts.length - 1
        ? 0.65
        : s === 1 || s === pathPts.length - 2
          ? 0.88
          : 1.0;

    for (let k = 0; k <= ringLen; k++) {
      const [px, py] = profile[k % ringLen];
      vert
        .copy(pt)
        .addScaledVector(widthDir, px)
        .addScaledVector(thickDir, py * tabEndTaper);
      positions.push(vert.x, vert.y, vert.z);
      uvs.push(k / ringLen, cumArcLen * 0.9);
    }
  }

  for (let s = 0; s < pathPts.length - 1; s++) {
    for (let k = 0; k < ringLen; k++) {
      const a = s * (ringLen + 1) + k;
      const b = a + 1;
      const c = (s + 1) * (ringLen + 1) + k;
      const d = c + 1;
      indices.push(a, d, c);
      indices.push(a, b, d);
    }
  }

  // Cleanly cap both finished stitched tab ends (outward normals)
  const capEnd = (ringStartIdx: number, centerPos: THREE.Vector3, flip: boolean) => {
    const centerIdx = positions.length / 3;
    positions.push(centerPos.x, centerPos.y, centerPos.z);
    uvs.push(0.5, 0.5);
    for (let k = 0; k < ringLen; k++) {
      const a = ringStartIdx + k;
      const b = ringStartIdx + k + 1;
      if (!flip) indices.push(centerIdx, b, a);
      else indices.push(centerIdx, a, b);
    }
  };
  capEnd(0, pathPts[0], false);
  capEnd((pathPts.length - 1) * (ringLen + 1), pathPts[pathPts.length - 1], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds subtle tonal cotton stitching lines along the folded top hem and handle X-boxes.
 */
function buildStitchingGeometry(dim: EcobagDimensions): THREE.BufferGeometry {
  const segPts: number[] = [];

  const pushDashedCurve = (pts: THREE.Vector3[]) => {
    for (let i = 0; i < pts.length - 1; i += 2) {
      segPts.push(pts[i].x, pts[i].y, pts[i].z);
      segPts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  };

  const pushDashedSegment = (a: THREE.Vector3, b: THREE.Vector3, steps = 8) => {
    for (let i = 0; i < steps; i += 2) {
      const t0 = i / steps;
      const t1 = Math.min(1, (i + 1) / steps);
      segPts.push(
        THREE.MathUtils.lerp(a.x, b.x, t0),
        THREE.MathUtils.lerp(a.y, b.y, t0),
        THREE.MathUtils.lerp(a.z, b.z, t0),
        THREE.MathUtils.lerp(a.x, b.x, t1),
        THREE.MathUtils.lerp(a.y, b.y, t1),
        THREE.MathUtils.lerp(a.z, b.z, t1)
      );
    }
  };

  (['front', 'back'] as BagSide[]).forEach((side) => {
    const sign = side === 'front' ? 1 : -1;

    // Top folded hem stitch seam
    [0.922].forEach((vRow) => {
      const rowPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const p = evaluatePanelPoint(dim, side, i / 72, vRow);
        p.z += sign * 0.005;
        rowPts.push(p);
      }
      pushDashedCurve(rowPts);
    });

    // Symmetric handle X-box reinforcement stitches directly on the strap attachment tabs
    const anchorU = [0.315, 0.685];
    anchorU.forEach((uCenter) => {
      const boxHalfU = 0.031;
      const boxTopV = 0.986;
      const boxBotV = 0.902;
      const zPush = sign * (0.042 * 0.98 + 0.01);
      const corners = [
        evaluatePanelPoint(dim, side, uCenter - boxHalfU, boxTopV),
        evaluatePanelPoint(dim, side, uCenter + boxHalfU, boxTopV),
        evaluatePanelPoint(dim, side, uCenter + boxHalfU, boxBotV),
        evaluatePanelPoint(dim, side, uCenter - boxHalfU, boxBotV),
      ].map((p) => {
        p.z += zPush;
        return p;
      });
      for (let c = 0; c < 4; c++) {
        pushDashedSegment(corners[c], corners[(c + 1) % 4], 8);
      }
      pushDashedSegment(corners[0], corners[2], 10);
      pushDashedSegment(corners[1], corners[3], 10);
    });
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(segPts, 3));
  return geo;
}

interface CachedBottonTex {
  texture: THREE.CanvasTexture;
  loaded: boolean;
  listeners: Set<() => void>;
}

const bottonTextureCache = new Map<string, CachedBottonTex>();

function getBottonFaceTexture(
  imageUrl: string,
  onLoaded: () => void
): THREE.CanvasTexture {
  const existing = bottonTextureCache.get(imageUrl);
  if (existing) {
    if (!existing.loaded) {
      existing.listeners.add(onLoaded);
    }
    return existing.texture;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Soft neutral cotton-pearl base while image decodes
  ctx.fillStyle = '#EAE7DC';
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const entry: CachedBottonTex = {
    texture,
    loaded: false,
    listeners: new Set([onLoaded]),
  };
  bottonTextureCache.set(imageUrl, entry);

  const img = new Image();
  if (!imageUrl.startsWith('data:')) {
    img.crossOrigin = 'anonymous';
  }
  img.onload = () => {
    const iw = img.naturalWidth || size;
    const ih = img.naturalHeight || size;
    const scale = Math.max(size / iw, size / ih);
    const drawW = iw * scale;
    const drawH = ih * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#FAF9F5';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    texture.needsUpdate = true;
    entry.loaded = true;
    entry.listeners.forEach((cb) => cb());
    entry.listeners.clear();
  };
  img.src = imageUrl;

  return texture;
}

/**
 * Creates a physical 3D botton (pin badge) with extruded thickness, metallic/enamel border,
 * and matte or glossy domed artwork face.
 */
export function createBotton3DMesh(
  botton: BottonElement,
  sample: SurfacePointSample,
  bagWidth: number,
  onLoaded: () => void,
  isSelected = false
): THREE.Group {
  const group = new THREE.Group();
  group.name = `botton_${botton.id}`;
  group.userData.elementId = botton.id;

  const radius = Math.max(0.11, Math.min(0.45, bagWidth * 0.075 * botton.scale));
  const thickness = 0.036;
  const bevelThickness = 0.012;

  const makeShape = (r: number): THREE.Shape => {
    const s = new THREE.Shape();
    if (botton.shape === 'round') {
      s.absarc(0, 0, r, 0, Math.PI * 2, false);
    } else if (botton.shape === 'square') {
      const cr = r * 0.24;
      const hw = r * 0.92;
      s.moveTo(-hw + cr, -hw);
      s.lineTo(hw - cr, -hw);
      s.quadraticCurveTo(hw, -hw, hw, -hw + cr);
      s.lineTo(hw, hw - cr);
      s.quadraticCurveTo(hw, hw, hw - cr, hw);
      s.lineTo(-hw + cr, hw);
      s.quadraticCurveTo(-hw, hw, -hw, hw - cr);
      s.lineTo(-hw, -hw + cr);
      s.quadraticCurveTo(-hw, -hw, -hw + cr, -hw);
    } else {
      // Heart shape centered around (0,0)
      const k = r * 0.062;
      s.moveTo(0, -13 * k);
      s.bezierCurveTo(14 * k, -3 * k, 18 * k, 10 * k, 9 * k, 15 * k);
      s.bezierCurveTo(3 * k, 18 * k, 0, 12 * k, 0, 9 * k);
      s.bezierCurveTo(0, 12 * k, -3 * k, 18 * k, -9 * k, 15 * k);
      s.bezierCurveTo(-18 * k, 10 * k, -14 * k, -3 * k, 0, -13 * k);
    }
    return s;
  };

  // 1. Metallic rim / back shell
  const backShape = makeShape(radius);
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 32,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: botton.showBorder ? botton.borderColor : '#C7CBD1',
    metalness: botton.showBorder ? 0.22 : 0.72,
    roughness: botton.showBorder ? 0.35 : 0.25,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  backMesh.userData.elementId = botton.id;
  group.add(backMesh);

  // 2. Front graphic cap (slightly inset when border is shown)
  const capRadius = botton.showBorder ? radius * 0.87 : radius * 0.96;
  const capShape = makeShape(capRadius);
  const capGeo = new THREE.ShapeGeometry(capShape, 32);

  // Normalize UVs [0..1] across the cap shape so any image or photo fits cleanly
  capGeo.computeBoundingBox();
  const bb = capGeo.boundingBox!;
  const sizeX = Math.max(0.0001, bb.max.x - bb.min.x);
  const sizeY = Math.max(0.0001, bb.max.y - bb.min.y);
  const posAttr = capGeo.attributes.position;
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvArr[i * 2] = (posAttr.getX(i) - bb.min.x) / sizeX;
    uvArr[i * 2 + 1] = (posAttr.getY(i) - bb.min.y) / sizeY;
  }
  capGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

  const tex = getBottonFaceTexture(botton.imageUrl, onLoaded);

  const isGlossy = botton.finish === 'glossy';
  const capMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex,
    roughness: isGlossy ? 0.24 : 0.78,
    metalness: 0.02,
    clearcoat: isGlossy ? 0.45 : 0.03,
    clearcoatRoughness: isGlossy ? 0.18 : 0.65,
    reflectivity: isGlossy ? 0.5 : 0.15,
    envMapIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.position.z = thickness + bevelThickness + 0.006;
  capMesh.userData.elementId = botton.id;
  group.add(capMesh);

  // Optional UCLA blue halo ring when selected
  if (isSelected) {
    const ringGeo = new THREE.RingGeometry(radius * 1.12, radius * 1.24, 40);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#536895',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.z = 0.005;
    ringMesh.userData.elementId = botton.id;
    group.add(ringMesh);
  }

  // Orient group flush with the sculpted cotton surface while keeping upright (+Y) strictly locked
  group.position.copy(sample.position).addScaledVector(sample.normal, 0.01);
  const zAxis = sample.normal.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(worldUp, zAxis);
  if (xAxis.lengthSq() < 1e-6) {
    xAxis.set(1, 0, 0);
  } else {
    xAxis.normalize();
  }
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  group.quaternion.setFromRotationMatrix(basis);

  return group;
}

export class ProceduralCottonEcobagProvider implements IEcobagModelProvider {
  readonly id = 'procedural-v1' as const;
  private textures: CottonTextureBundle;

  constructor(textures: CottonTextureBundle) {
    this.textures = textures;
  }

  async build(size: BagSizeId): Promise<EcobagModelHandles> {
    const dim = SIZE_TO_WORLD_DIMENSIONS[size];
    const root = new THREE.Group();
    root.name = `procedural_ecobag_${size}`;

    // Front & back customizable panels
    const frontGeo = buildPanelGeometry(dim, 'front');
    const backGeo = buildPanelGeometry(dim, 'back');

    const frontMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.0,
      normalMap: this.textures.normalMap,
      normalScale: new THREE.Vector2(0.26, 0.26),
      roughnessMap: this.textures.roughnessMap,
      envMapIntensity: 0.24,
      sheen: 0.16,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color('#F3EDE2'),
    });

    const backMat = frontMat.clone();

    const frontCanvasMesh = new THREE.Mesh(frontGeo, frontMat);
    frontCanvasMesh.name = 'body_front';
    frontCanvasMesh.castShadow = true;
    frontCanvasMesh.receiveShadow = true;

    const backCanvasMesh = new THREE.Mesh(backGeo, backMat);
    backCanvasMesh.name = 'body_back';
    backCanvasMesh.castShadow = true;
    backCanvasMesh.receiveShadow = true;

    // Gussets & bottom base
    const gussetGeo = buildGussetAndBottomGeometry(dim);
    const bodySolidMat = new THREE.MeshPhysicalMaterial({
      color: '#DBD6BE',
      roughness: 0.96,
      metalness: 0.0,
      normalMap: this.textures.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: this.textures.roughnessMap,
      envMapIntensity: 0.24,
      sheen: 0.16,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color('#F3EDE2'),
    });
    const gussetMesh = new THREE.Mesh(gussetGeo, bodySolidMat);
    gussetMesh.name = 'body_gusset';
    gussetMesh.castShadow = true;
    gussetMesh.receiveShadow = true;

    // Folded cuff & inner cavity lining
    const { cuffGeo, liningGeo } = buildInnerLiningAndCuff(dim);
    const cuffMesh = new THREE.Mesh(cuffGeo, bodySolidMat);
    cuffMesh.castShadow = true;
    cuffMesh.receiveShadow = true;

    const liningMat = new THREE.MeshStandardMaterial({
      color: '#BEB8A0',
      roughness: 0.97,
      metalness: 0.0,
      normalMap: this.textures.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
      envMapIntensity: 0.2,
    });
    const liningMesh = new THREE.Mesh(liningGeo, liningMat);
    liningMesh.receiveShadow = true;

    // Handles (separate material so handles can have a distinct color!)
    const handleMat = new THREE.MeshPhysicalMaterial({
      color: '#DBD6BE',
      roughness: 0.94,
      metalness: 0.0,
      normalMap: this.textures.normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughnessMap: this.textures.roughnessMap,
      envMapIntensity: 0.24,
      sheen: 0.16,
      sheenRoughness: 0.94,
      sheenColor: new THREE.Color('#F3EDE2'),
    });
    const frontHandleGeo = buildCottonHandleGeometry(dim, 1);
    const backHandleGeo = buildCottonHandleGeometry(dim, -1);
    const frontHandleMesh = new THREE.Mesh(frontHandleGeo, handleMat);
    frontHandleMesh.castShadow = true;
    frontHandleMesh.receiveShadow = true;
    const backHandleMesh = new THREE.Mesh(backHandleGeo, handleMat);
    backHandleMesh.castShadow = true;
    backHandleMesh.receiveShadow = true;

    // Subtle tonal cotton stitching lines
    const stitchGeo = buildStitchingGeometry(dim);
    const stitchMat = new THREE.LineBasicMaterial({
      color: '#C2B7A3',
      transparent: true,
      opacity: 0.34,
    });
    const stitchLines = new THREE.LineSegments(stitchGeo, stitchMat);

    // Physical 3D bottons container
    const bottonsContainer = new THREE.Group();
    bottonsContainer.name = 'bottons_container';

    root.add(
      frontCanvasMesh,
      backCanvasMesh,
      gussetMesh,
      cuffMesh,
      liningMesh,
      frontHandleMesh,
      backHandleMesh,
      stitchLines,
      bottonsContainer
    );

    const bodyMeshes = [frontCanvasMesh, backCanvasMesh, gussetMesh, cuffMesh];
    const handleMeshes = [frontHandleMesh, backHandleMesh];

    // Surface point & macro-smoothed normal evaluator for placing 3D bottons flush against the bag
    const sampleSurfacePoint = (
      side: BagSide,
      normX: number,
      normY: number
    ): SurfacePointSample => {
      const u = THREE.MathUtils.clamp(0.5 + normX, 0.08, 0.92);
      const v = THREE.MathUtils.clamp(0.5 + normY, 0.08, 0.89);
      const p = evaluatePanelPoint(dim, side, u, v);
      const eps = 0.06;
      const pU1 = evaluatePanelPoint(dim, side, Math.max(0.02, u - eps), v);
      const pU2 = evaluatePanelPoint(dim, side, Math.min(0.98, u + eps), v);
      const pV1 = evaluatePanelPoint(dim, side, u, Math.max(0.02, v - eps));
      const pV2 = evaluatePanelPoint(dim, side, u, Math.min(0.98, v + eps));
      const tangentU = pU2.sub(pU1);
      const tangentV = pV2.sub(pV1);
      const normal = new THREE.Vector3().crossVectors(tangentU, tangentV).normalize();
      // Ensure normal points outward from the selected side
      if ((side === 'front' && normal.z < 0) || (side === 'back' && normal.z > 0)) {
        normal.negate();
      }
      return { position: p, normal };
    };

    return {
      root,
      bodyMeshes,
      handleMeshes,
      frontCanvasMesh,
      backCanvasMesh,
      bottonsContainer,
      sampleSurfacePoint,
      updateMaterials: ({ bodyColor, handleColor, frontTexture, backTexture }) => {
        frontMat.map = frontTexture;
        frontMat.needsUpdate = true;
        backMat.map = backTexture;
        backMat.needsUpdate = true;

        bodySolidMat.color.set(bodyColor);
        const liningCol = new THREE.Color(bodyColor).multiplyScalar(0.84);
        liningMat.color.copy(liningCol);
        handleMat.color.set(handleColor);

        // Self-colored tonal stitching subtle to fabric luminance
        const baseStitch = new THREE.Color(handleColor);
        const lum = baseStitch.getHSL({ h: 0, s: 0, l: 0 }).l;
        if (lum < 0.35) {
          stitchMat.color.copy(baseStitch).lerp(new THREE.Color('#FFFFFF'), 0.24);
        } else {
          stitchMat.color.copy(baseStitch).lerp(new THREE.Color('#4A3F32'), 0.22);
        }
      },
      dispose: () => {
        [
          frontGeo,
          backGeo,
          gussetGeo,
          cuffGeo,
          liningGeo,
          frontHandleGeo,
          backHandleGeo,
          stitchGeo,
        ].forEach((g) => g.dispose());
        [frontMat, backMat, bodySolidMat, liningMat, handleMat, stitchMat].forEach(
          (m) => m.dispose()
        );
      },
    };
  }
}
