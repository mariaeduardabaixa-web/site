import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BagSide, BagSizeId } from '../types';

export interface EcobagDimensions {
  width: number;
  height: number;
  depth: number;
  handleDrop: number;
}

export interface SurfacePointSample {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface EcobagModelHandles {
  root: THREE.Group;
  bodyMeshes: THREE.Mesh[];
  handleMeshes: THREE.Mesh[];
  frontCanvasMesh: THREE.Mesh;
  backCanvasMesh: THREE.Mesh;
  bottonsContainer: THREE.Group;
  sampleSurfacePoint: (side: BagSide, normX: number, normY: number) => SurfacePointSample;
  updateMaterials: (params: {
    bodyColor: string;
    handleColor: string;
    frontTexture: THREE.Texture;
    backTexture: THREE.Texture;
  }) => void;
  dispose: () => void;
}

export interface IEcobagModelProvider {
  readonly id: 'procedural-v1' | 'glb-official';
  build(size: BagSizeId, maxAnisotropy: number): Promise<EcobagModelHandles>;
}

export const SIZE_TO_WORLD_DIMENSIONS: Record<BagSizeId, EcobagDimensions> = {
  P: { width: 3.0, height: 3.1, depth: 0.78, handleDrop: 2.35 },
  M: { width: 3.7, height: 3.8, depth: 0.96, handleDrop: 2.95 },
  G: { width: 4.3, height: 4.4, depth: 1.12, handleDrop: 3.35 },
};

/**
 * Adaptador preparado para substituir o modelo provisório pelo arquivo .GLB
 * oficial da Inside Ecobag sem alterar nenhuma ferramenta do estúdio 3D.
 * Contrato esperado de nomes no GLB:
 *  - body_front (UV [0..1] da face frontal)
 *  - body_back (UV [0..1] da face traseira)
 *  - body_gusset (laterais, fundo e interior)
 *  - handles (alças)
 */
export class GlbEcobagProvider implements IEcobagModelProvider {
  readonly id = 'glb-official' as const;
  private glbUrl: string;

  constructor(glbUrl: string) {
    this.glbUrl = glbUrl;
  }

  async build(size: BagSizeId): Promise<EcobagModelHandles> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(this.glbUrl);
    const root = gltf.scene;
    const dim = SIZE_TO_WORLD_DIMENSIONS[size];
    const scaleFactor = dim.height / 4.0;
    root.scale.setScalar(scaleFactor);

    const bodyMeshes: THREE.Mesh[] = [];
    const handleMeshes: THREE.Mesh[] = [];
    let frontCanvasMesh: THREE.Mesh | null = null;
    let backCanvasMesh: THREE.Mesh | null = null;

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.name.includes('handle')) {
          handleMeshes.push(mesh);
        } else {
          bodyMeshes.push(mesh);
        }
        if (mesh.name === 'body_front') frontCanvasMesh = mesh;
        if (mesh.name === 'body_back') backCanvasMesh = mesh;
      }
    });

    const bottonsContainer = new THREE.Group();
    bottonsContainer.name = 'bottons_container';
    root.add(bottonsContainer);

    const fallbackMesh = bodyMeshes[0] ?? new THREE.Mesh();

    return {
      root,
      bodyMeshes,
      handleMeshes,
      frontCanvasMesh: frontCanvasMesh ?? fallbackMesh,
      backCanvasMesh: backCanvasMesh ?? fallbackMesh,
      bottonsContainer,
      sampleSurfacePoint: (side, normX, normY) => ({
        position: new THREE.Vector3(
          (side === 'front' ? 1 : -1) * normX * dim.width,
          dim.height * 0.5 + normY * dim.height,
          (side === 'front' ? 1 : -1) * (dim.depth * 0.5 + 0.02)
        ),
        normal: new THREE.Vector3(0, 0, side === 'front' ? 1 : -1),
      }),
      updateMaterials: ({ bodyColor, handleColor, frontTexture, backTexture }) => {
        bodyMeshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && mat.color) mat.color.set(bodyColor);
        });
        handleMeshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && mat.color) mat.color.set(handleColor);
        });
        if (frontCanvasMesh) {
          const mat = frontCanvasMesh.material as THREE.MeshStandardMaterial;
          mat.map = frontTexture;
          mat.needsUpdate = true;
        }
        if (backCanvasMesh) {
          const mat = backCanvasMesh.material as THREE.MeshStandardMaterial;
          mat.map = backTexture;
          mat.needsUpdate = true;
        }
      },
      dispose: () => {
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
            else m.material.dispose();
          }
        });
      },
    };
  }
}
