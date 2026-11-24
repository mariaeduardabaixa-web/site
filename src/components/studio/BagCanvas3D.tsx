import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BagConfiguration,
  BagElement,
  BagSide,
  BottonElement,
  DrawingStroke,
} from '../../types';
import { createCottonTextures } from '../../studio3d/cottonTextures';
import {
  EcobagModelHandles,
  SIZE_TO_WORLD_DIMENSIONS,
} from '../../studio3d/ecobagModelAdapter';
import {
  createBotton3DMesh,
  ProceduralCottonEcobagProvider,
} from '../../studio3d/proceduralEcobag';
import { BagSurfaceCompositor } from '../../studio3d/surfaceCompositor';

export type CameraPreset = 'front' | 'back' | 'side' | 'top' | 'bottom' | 'reset';

export interface BagCanvas3DHandle {
  setCameraPreset: (preset: CameraPreset) => void;
  zoomBy: (factor: number) => void;
  rotateBy: (deltaAzimuthRad: number) => void;
  captureSnapshot: (preset?: CameraPreset) => string;
}

interface BagCanvas3DProps {
  config: BagConfiguration;
  selectedElementId: string | null;
  isDrawingOnBag: boolean;
  brushColor: string;
  brushSize: number;
  isEraser: boolean;
  /** Positive shifts bag right on screen (compensating for open left panel). */
  screenCenterOffsetPx?: number;
  onSelectElement: (id: string | null) => void;
  onDragElementMove: (id: string, x: number, y: number) => void;
  onDragElementCommit: (
    id: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => void;
  onAddDrawingStroke: (stroke: DrawingStroke) => void;
  onFocusSideChange?: (side: BagSide) => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _pointer = new THREE.Vector2();

export const BagCanvas3D = forwardRef<BagCanvas3DHandle, BagCanvas3DProps>(
  (
    {
      config,
      selectedElementId,
      isDrawingOnBag,
      brushColor,
      brushSize,
      isEraser,
      screenCenterOffsetPx = 0,
      onSelectElement,
      onDragElementMove,
      onDragElementCommit,
      onAddDrawingStroke,
      onFocusSideChange,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [contextLost, setContextLost] = useState(false);

    // Keep latest props in refs so WebGL scene never tears down on UI updates
    const configRef = useRef(config);
    configRef.current = config;
    const selectedIdRef = useRef(selectedElementId);
    selectedIdRef.current = selectedElementId;
    const drawFlagRef = useRef(isDrawingOnBag);
    drawFlagRef.current = isDrawingOnBag;
    const brushRef = useRef({ color: brushColor, size: brushSize, isEraser });
    brushRef.current = { color: brushColor, size: brushSize, isEraser };
    const offsetPxRef = useRef(screenCenterOffsetPx);
    offsetPxRef.current = screenCenterOffsetPx;
    const callbacksRef = useRef({
      onSelectElement,
      onDragElementMove,
      onDragElementCommit,
      onAddDrawingStroke,
      onFocusSideChange,
    });
    callbacksRef.current = {
      onSelectElement,
      onDragElementMove,
      onDragElementCommit,
      onAddDrawingStroke,
      onFocusSideChange,
    };

    const sceneApiRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      compositor: BagSurfaceCompositor;
      provider: ProceduralCottonEcobagProvider;
      modelHandles: EcobagModelHandles | null;
      currentSize: string;
      requestRender: () => void;
      rebuildForSize: (size: BagConfiguration['size']) => Promise<void>;
      syncVisuals: () => void;
      setPreset: (preset: CameraPreset, immediate?: boolean) => void;
      zoomBy: (factor: number) => void;
      rotateBy: (deltaAzimuthRad: number) => void;
      applyViewportOffset: () => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      setCameraPreset: (preset) => {
        sceneApiRef.current?.setPreset(preset, false);
      },
      zoomBy: (factor) => {
        sceneApiRef.current?.zoomBy(factor);
      },
      rotateBy: (deltaAzimuthRad) => {
        sceneApiRef.current?.rotateBy(deltaAzimuthRad);
      },
      captureSnapshot: (preset = 'front') => {
        const api = sceneApiRef.current;
        if (!api) return '';
        const prevPos = api.camera.position.clone();
        const prevTarget = api.controls.target.clone();

        api.camera.clearViewOffset();
        api.camera.updateProjectionMatrix();
        api.setPreset(preset, true);
        api.controls.update();
        api.renderer.render(api.scene, api.camera);
        const dataUrl = api.renderer.domElement.toDataURL('image/png');

        api.camera.position.copy(prevPos);
        api.controls.target.copy(prevTarget);
        api.applyViewportOffset();
        api.controls.update();
        api.requestRender();
        return dataUrl;
      },
    }));

    // Initialize Three.js WebGL scene once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = (() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      );
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';

      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.25;
      pmremGenerator.dispose();

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      camera.position.set(0.45, 3.7, 13.4);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = 4.5;
      controls.maxDistance = 22.0;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI - 0.12;
      controls.target.set(0, 3.24, 0);

      // Calibrated 3-Point Studio Lighting Rig (soft matte cotton folds without harsh sheen)
      const hemi = new THREE.HemisphereLight(0xf8f9fc, 0xd4ccbc, 0.54);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.06);
      keyLight.position.set(5.2, 9.5, 7.2);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 28;
      keyLight.shadow.camera.left = -5.5;
      keyLight.shadow.camera.right = 5.5;
      keyLight.shadow.camera.top = 8.5;
      keyLight.shadow.camera.bottom = -2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xf2f6ff, 0.34);
      fillLight.position.set(-6.2, 4.5, 5.2);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
      rimLight.position.set(0.4, 6.2, -7.2);
      scene.add(rimLight);

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const cottonTextures = createCottonTextures(maxAniso);

      // Ground contact shadow disc + shadow catcher plane
      const shadowDiscGeo = new THREE.PlaneGeometry(7.2, 4.6);
      const shadowDiscMat = new THREE.MeshBasicMaterial({
        map: cottonTextures.contactShadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      });
      const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.001;
      scene.add(shadowDisc);

      const floorGeo = new THREE.PlaneGeometry(24, 24);
      const floorMat = new THREE.ShadowMaterial({ opacity: 0.14 });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      let frameId = 0;
      let renderBusy = false;
      let renderDirty = false;
      let isDisposed = false;

      // Smooth damped camera preset state
      let animTargetPos: THREE.Vector3 | null = null;
      let animTargetLook: THREE.Vector3 | null = null;
      let lastTime = performance.now();

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      const requestRender = () => {
        if (isDisposed) return;
        if (renderBusy) {
          renderDirty = true;
          return;
        }
        renderBusy = true;
        frameId = requestAnimationFrame(() => {
          if (isDisposed) return;
          renderDirty = false;
          const now = performance.now();
          const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
          lastTime = now;

          let needsAnotherFrame = false;

          if (animTargetPos && animTargetLook) {
            camera.position.x = THREE.MathUtils.damp(
              camera.position.x,
              animTargetPos.x,
              7,
              dt
            );
            camera.position.y = THREE.MathUtils.damp(
              camera.position.y,
              animTargetPos.y,
              7,
              dt
            );
            camera.position.z = THREE.MathUtils.damp(
              camera.position.z,
              animTargetPos.z,
              7,
              dt
            );
            controls.target.x = THREE.MathUtils.damp(
              controls.target.x,
              animTargetLook.x,
              7,
              dt
            );
            controls.target.y = THREE.MathUtils.damp(
              controls.target.y,
              animTargetLook.y,
              7,
              dt
            );
            controls.target.z = THREE.MathUtils.damp(
              controls.target.z,
              animTargetLook.z,
              7,
              dt
            );

            if (
              camera.position.distanceTo(animTargetPos) < 0.02 &&
              controls.target.distanceTo(animTargetLook) < 0.02
            ) {
              camera.position.copy(animTargetPos);
              controls.target.copy(animTargetLook);
              animTargetPos = null;
              animTargetLook = null;
            } else {
              needsAnotherFrame = true;
            }
          }

          controls.update();
          renderer.render(scene, camera);

          const done = () => {
            renderBusy = false;
            if (renderDirty || needsAnotherFrame) {
              requestRender();
            }
          };
          if (isSoftwareGl) afterDraw(done);
          else done();
        });
      };

      const compositor = new BagSurfaceCompositor(
        cottonTextures.weaveOverlayCanvas,
        maxAniso,
        () => {
          syncVisuals();
        }
      );

      const provider = new ProceduralCottonEcobagProvider(cottonTextures);
      let modelHandles: EcobagModelHandles | null = null;
      let currentSize = '';
      let bottonsKey = '';

      const syncBottons = () => {
        if (!modelHandles) return;
        const cfg = configRef.current;
        const bottons = cfg.elements.filter(
          (el): el is BottonElement => el.type === 'botton' && el.visible
        );
        const nextKey = JSON.stringify({
          size: cfg.size,
          selectedId: selectedIdRef.current,
          bottons: bottons.map((b) => ({
            id: b.id,
            x: b.x,
            y: b.y,
            scale: b.scale,
            rotation: b.rotation,
            shape: b.shape,
            finish: b.finish,
            borderColor: b.borderColor,
            showBorder: b.showBorder,
            imageUrl: b.imageUrl,
            side: b.side,
          })),
        });
        if (nextKey === bottonsKey) return;
        bottonsKey = nextKey;

        const containerGroup = modelHandles.bottonsContainer;
        while (containerGroup.children.length > 0) {
          const child = containerGroup.children.pop()!;
          child.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.geometry.dispose();
              if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
              else m.material.dispose();
            }
          });
        }

        const dim = SIZE_TO_WORLD_DIMENSIONS[cfg.size];
        for (const botton of bottons) {
          const sample = modelHandles.sampleSurfacePoint(
            botton.side,
            botton.x,
            botton.y
          );
          const meshGroup = createBotton3DMesh(
            botton,
            sample,
            dim.width,
            () => requestRender(),
            botton.id === selectedIdRef.current
          );
          containerGroup.add(meshGroup);
        }
      };

      const syncVisuals = () => {
        if (!modelHandles) return;
        const cfg = configRef.current;
        compositor.render(cfg, selectedIdRef.current);
        modelHandles.updateMaterials({
          bodyColor: cfg.bodyColor,
          handleColor: cfg.handleColor,
          frontTexture: compositor.frontTexture,
          backTexture: compositor.backTexture,
        });
        syncBottons();
        requestRender();
      };

      const rebuildForSize = async (size: BagConfiguration['size']) => {
        if (currentSize === size && modelHandles) return;
        currentSize = size;
        bottonsKey = '';

        if (modelHandles) {
          scene.remove(modelHandles.root);
          modelHandles.dispose();
          modelHandles = null;
        }

        const handles = await provider.build(size);
        if (isDisposed) {
          handles.dispose();
          return;
        }
        modelHandles = handles;
        scene.add(handles.root);

        const dim = SIZE_TO_WORLD_DIMENSIONS[size];
        const totalH = dim.height + dim.handleDrop;
        shadowDisc.scale.set(dim.width / 3.7, dim.depth / 0.96, 1);
        controls.target.set(0, totalH * 0.48, 0);
        syncVisuals();
      };

      const setPreset = (preset: CameraPreset, immediate = false) => {
        const dim = SIZE_TO_WORLD_DIMENSIONS[configRef.current.size];
        const totalH = dim.height + dim.handleDrop;
        const centerY = totalH * 0.48;
        const dist = totalH * 1.98;
        let pos = new THREE.Vector3(0.45, centerY + 0.45, dist);
        const target = new THREE.Vector3(0, centerY, 0);

        if (preset === 'front') {
          pos = new THREE.Vector3(0, centerY + 0.25, dist);
          callbacksRef.current.onFocusSideChange?.('front');
        } else if (preset === 'back') {
          pos = new THREE.Vector3(0, centerY + 0.25, -dist);
          callbacksRef.current.onFocusSideChange?.('back');
        } else if (preset === 'side') {
          pos = new THREE.Vector3(dist * 0.95, centerY + 0.3, 1.4);
        } else if (preset === 'top') {
          pos = new THREE.Vector3(0, totalH + dist * 0.65, 2.2);
        } else if (preset === 'bottom') {
          pos = new THREE.Vector3(0, -dist * 0.42, dist * 0.68);
        }

        if (immediate) {
          animTargetPos = null;
          animTargetLook = null;
          camera.position.copy(pos);
          controls.target.copy(target);
          controls.update();
          requestRender();
        } else {
          animTargetPos = pos;
          animTargetLook = target;
          requestRender();
        }
      };

      const zoomBy = (factor: number) => {
        animTargetPos = null;
        animTargetLook = null;
        _vec3A.copy(camera.position).sub(controls.target);
        const currentLen = _vec3A.length();
        const nextLen = THREE.MathUtils.clamp(
          currentLen * factor,
          controls.minDistance,
          controls.maxDistance
        );
        _vec3A.setLength(nextLen);
        camera.position.copy(controls.target).add(_vec3A);
        controls.update();
        requestRender();
      };

      const rotateBy = (deltaAzimuthRad: number) => {
        animTargetPos = null;
        animTargetLook = null;
        _vec3A.copy(camera.position).sub(controls.target);
        _vec3A.applyAxisAngle(THREE.Object3D.DEFAULT_UP, deltaAzimuthRad);
        camera.position.copy(controls.target).add(_vec3A);
        controls.update();
        requestRender();
      };

      let viewportW = width;
      let viewportH = height;

      const applyViewportOffset = () => {
        const px = offsetPxRef.current;
        if (Math.abs(px) < 1 || viewportW < 200) {
          camera.clearViewOffset();
        } else {
          // Shifting the view window left (-px) moves the projected bag right (+px)
          camera.setViewOffset(
            viewportW,
            viewportH,
            -px,
            0,
            viewportW,
            viewportH
          );
        }
        camera.updateProjectionMatrix();
      };

      // --- Raycasting for Element Direct Dragging & 3D Bag Surface Drawing ---
      const raycaster = new THREE.Raycaster();
      const dragPlane = new THREE.Plane();
      const dragPlaneHit = new THREE.Vector3();
      let activeStroke: DrawingStroke | null = null;
      let isPointerDownForDraw = false;
      let pointerDownPos = { x: 0, y: 0 };
      let dragState: {
        elementId: string;
        side: BagSide;
        startX: number;
        startY: number;
        lastX: number;
        lastY: number;
        offsetX: number;
        offsetY: number;
        moved: boolean;
        pointerId: number;
      } | null = null;

      const getPointerNdc = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      };

      const projectPointerToSideUV = (
        clientX: number,
        clientY: number,
        side: BagSide
      ): { u: number; v: number } | null => {
        if (!modelHandles) return null;
        getPointerNdc(clientX, clientY);
        raycaster.setFromCamera(_pointer, camera);

        const targetMesh =
          side === 'back'
            ? modelHandles.backCanvasMesh
            : modelHandles.frontCanvasMesh;
        const hits = raycaster.intersectObject(targetMesh, false);
        if (hits.length > 0 && hits[0].uv) {
          return { u: hits[0].uv.x, v: hits[0].uv.y };
        }

        // Fallback plane projection if dragging slightly beyond the curved bag silhouette
        const dim = SIZE_TO_WORLD_DIMENSIONS[configRef.current.size];
        const planeZ = side === 'front' ? dim.depth * 0.42 : -dim.depth * 0.42;
        dragPlane.set(new THREE.Vector3(0, 0, side === 'front' ? 1 : -1), -planeZ);
        if (raycaster.ray.intersectPlane(dragPlane, dragPlaneHit)) {
          const localX = side === 'front' ? dragPlaneHit.x : -dragPlaneHit.x;
          return {
            u: THREE.MathUtils.clamp(0.5 + localX / dim.width, 0.05, 0.95),
            v: THREE.MathUtils.clamp(dragPlaneHit.y / dim.height, 0.05, 0.95),
          };
        }
        return null;
      };

      const hitTestAtPointer = (
        clientX: number,
        clientY: number
      ): { element: BagElement; hitUV: { u: number; v: number } } | null => {
        if (!modelHandles) return null;
        getPointerNdc(clientX, clientY);
        raycaster.setFromCamera(_pointer, camera);

        // Intersect bottons and panels together so hits are depth-sorted from the camera
        // (prevents clicking through the front panel onto a botton on the back side)
        const targets: THREE.Object3D[] = [
          ...modelHandles.bottonsContainer.children,
          modelHandles.frontCanvasMesh,
          modelHandles.backCanvasMesh,
        ];
        const hits = raycaster.intersectObjects(targets, true);
        if (hits.length === 0) return null;

        const firstHit = hits[0];
        const bottonId = firstHit.object.userData.elementId as string | undefined;
        if (bottonId) {
          const found = configRef.current.elements.find((el) => el.id === bottonId);
          if (found) {
            const uv = projectPointerToSideUV(clientX, clientY, found.side) ?? {
              u: 0.5 + found.x,
              v: 0.5 + found.y,
            };
            return { element: found, hitUV: uv };
          }
        }

        if (
          (firstHit.object === modelHandles.frontCanvasMesh ||
            firstHit.object === modelHandles.backCanvasMesh) &&
          firstHit.uv
        ) {
          const side: BagSide =
            firstHit.object === modelHandles.backCanvasMesh ? 'back' : 'front';
          const hitEl = compositor.hitTestElement(
            configRef.current.elements,
            side,
            firstHit.uv.x,
            firstHit.uv.y
          );
          if (hitEl) {
            return {
              element: hitEl,
              hitUV: { u: firstHit.uv.x, v: firstHit.uv.y },
            };
          }
        }

        return null;
      };

      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        if (!modelHandles) return;

        // Freehand 3D drawing mode takes priority
        if (drawFlagRef.current) {
          getPointerNdc(e.clientX, e.clientY);
          raycaster.setFromCamera(_pointer, camera);
          const hits = raycaster.intersectObjects(
            [modelHandles.frontCanvasMesh, modelHandles.backCanvasMesh],
            false
          );

          if (hits.length > 0 && hits[0].uv) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            isPointerDownForDraw = true;
            controls.enabled = false;
            const hitMesh = hits[0].object;
            const side: BagSide =
              hitMesh === modelHandles.backCanvasMesh ? 'back' : 'front';
            activeStroke = {
              id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              side,
              points: [{ u: hits[0].uv.x, v: hits[0].uv.y }],
              color: brushRef.current.color,
              size: brushRef.current.size,
              isEraser: brushRef.current.isEraser,
            };
            const previewCfg: BagConfiguration = {
              ...configRef.current,
              drawingStrokes: [...configRef.current.drawingStrokes, activeStroke],
            };
            compositor.render(previewCfg, selectedIdRef.current);
            requestRender();
          }
          return;
        }

        // Direct element selection & drag (bag itself remains stationary)
        const hit = hitTestAtPointer(e.clientX, e.clientY);
        if (hit) {
          // Stop OrbitControls from receiving this pointerdown so camera doesn't orbit while dragging an item
          e.stopPropagation();
          e.stopImmediatePropagation();
          controls.enabled = false;
          try {
            renderer.domElement.setPointerCapture(e.pointerId);
          } catch {
            // ignore on synthetic events
          }
          renderer.domElement.style.cursor = 'grabbing';
          callbacksRef.current.onSelectElement(hit.element.id);

          dragState = {
            elementId: hit.element.id,
            side: hit.element.side,
            startX: hit.element.x,
            startY: hit.element.y,
            lastX: hit.element.x,
            lastY: hit.element.y,
            offsetX: hit.element.x - (hit.hitUV.u - 0.5),
            offsetY: hit.element.y - (hit.hitUV.v - 0.5),
            moved: false,
            pointerId: e.pointerId,
          };
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (isPointerDownForDraw && activeStroke && modelHandles) {
          getPointerNdc(e.clientX, e.clientY);
          raycaster.setFromCamera(_pointer, camera);
          const targetMesh =
            activeStroke.side === 'back'
              ? modelHandles.backCanvasMesh
              : modelHandles.frontCanvasMesh;
          const hits = raycaster.intersectObject(targetMesh, false);
          if (hits.length > 0 && hits[0].uv) {
            const last = activeStroke.points[activeStroke.points.length - 1];
            const dx = hits[0].uv.x - last.u;
            const dy = hits[0].uv.y - last.v;
            if (dx * dx + dy * dy > 0.00003) {
              activeStroke.points.push({ u: hits[0].uv.x, v: hits[0].uv.y });
              const previewCfg: BagConfiguration = {
                ...configRef.current,
                drawingStrokes: [...configRef.current.drawingStrokes, activeStroke],
              };
              compositor.render(previewCfg, selectedIdRef.current);
              requestRender();
            }
          }
          return;
        }

        if (dragState && modelHandles) {
          const uv = projectPointerToSideUV(e.clientX, e.clientY, dragState.side);
          if (!uv) return;
          const rawX = uv.u - 0.5 + dragState.offsetX;
          const rawY = uv.v - 0.5 + dragState.offsetY;
          const nextX =
            Math.round(THREE.MathUtils.clamp(rawX, -0.36, 0.36) * 1000) / 1000;
          const nextY =
            Math.round(THREE.MathUtils.clamp(rawY, -0.36, 0.36) * 1000) / 1000;

          if (Math.hypot(nextX - dragState.lastX, nextY - dragState.lastY) > 0.001) {
            dragState.moved = true;
            dragState.lastX = nextX;
            dragState.lastY = nextY;
            callbacksRef.current.onDragElementMove(dragState.elementId, nextX, nextY);
          }
          return;
        }

        // Hover cursor hint over draggable elements (only when pointer is over the canvas)
        if (drawFlagRef.current) {
          renderer.domElement.style.cursor = 'crosshair';
        } else if (e.target === renderer.domElement) {
          const hoverHit = hitTestAtPointer(e.clientX, e.clientY);
          renderer.domElement.style.cursor = hoverHit ? 'grab' : 'default';
        }
      };

      const finishPointer = (e: PointerEvent) => {
        if (isPointerDownForDraw) {
          isPointerDownForDraw = false;
          controls.enabled = true;
          if (activeStroke && activeStroke.points.length > 0) {
            callbacksRef.current.onAddDrawingStroke(activeStroke);
          }
          activeStroke = null;
          return;
        }

        if (dragState) {
          const finished = dragState;
          dragState = null;
          controls.enabled = true;
          try {
            if (renderer.domElement.hasPointerCapture(finished.pointerId)) {
              renderer.domElement.releasePointerCapture(finished.pointerId);
            }
          } catch {
            // ignore
          }
          renderer.domElement.style.cursor = 'grab';
          if (finished.moved) {
            callbacksRef.current.onDragElementCommit(
              finished.elementId,
              finished.startX,
              finished.startY,
              finished.lastX,
              finished.lastY
            );
          }
          return;
        }

        // Simple click on empty bag/background deselects the active element
        const moveDist = Math.hypot(
          e.clientX - pointerDownPos.x,
          e.clientY - pointerDownPos.y
        );
        if (
          moveDist <= 6 &&
          !drawFlagRef.current &&
          e.target === renderer.domElement &&
          selectedIdRef.current
        ) {
          callbacksRef.current.onSelectElement(null);
        }
      };

      const onControlsStart = () => {
        animTargetPos = null;
        animTargetLook = null;
      };

      const onControlsChange = () => {
        // Detect whether camera is mostly looking at front or back
        _vec3B.copy(camera.position).sub(controls.target);
        if (Math.abs(_vec3B.z) > 1.5) {
          callbacksRef.current.onFocusSideChange?.(_vec3B.z >= 0 ? 'front' : 'back');
        }
        requestRender();
      };

      controls.addEventListener('start', onControlsStart);
      controls.addEventListener('change', onControlsChange);
      renderer.domElement.addEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finishPointer);
      window.addEventListener('pointercancel', finishPointer);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const handleContextRestored = () => {
        setContextLost(false);
        requestRender();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener(
        'webglcontextrestored',
        handleContextRestored
      );

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(100, entry.contentRect.width);
          const h = Math.max(100, entry.contentRect.height);
          viewportW = w;
          viewportH = h;
          camera.aspect = w / h;
          applyViewportOffset();
          renderer.setSize(w, h, false);
          requestRender();
        }
      });
      resizeObserver.observe(container);

      sceneApiRef.current = {
        renderer,
        scene,
        camera,
        controls,
        compositor,
        provider,
        modelHandles,
        currentSize,
        requestRender,
        rebuildForSize,
        syncVisuals,
        setPreset,
        zoomBy,
        rotateBy,
        applyViewportOffset,
      };

      // Initial build
      rebuildForSize(configRef.current.size).then(() => {
        setPreset('reset', true);
        if (!isSoftwareGl) {
          renderer.compile(scene, camera);
        }
        requestRender();
      });

      return () => {
        isDisposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        controls.removeEventListener('start', onControlsStart);
        controls.removeEventListener('change', onControlsChange);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown, {
          capture: true,
        });
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finishPointer);
        window.removeEventListener('pointercancel', finishPointer);
        renderer.domElement.removeEventListener(
          'webglcontextlost',
          handleContextLost
        );
        renderer.domElement.removeEventListener(
          'webglcontextrestored',
          handleContextRestored
        );
        controls.dispose();
        modelHandles?.dispose();
        compositor.dispose();
        cottonTextures.dispose();
        shadowDiscGeo.dispose();
        shadowDiscMat.dispose();
        floorGeo.dispose();
        floorMat.dispose();
        envTex.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        sceneApiRef.current = null;
      };
    }, []);

    // Sync configuration changes without tearing down WebGL
    useEffect(() => {
      const api = sceneApiRef.current;
      if (!api) return;
      api.applyViewportOffset();
      api.rebuildForSize(config.size).then(() => {
        api.syncVisuals();
      });
    }, [config, selectedElementId, screenCenterOffsetPx]);

    return (
      <div className="relative w-full h-full overflow-hidden select-none bg-[linear-gradient(180deg,#E5E7EA_0%,#D8DBDF_58%,#CDCFD3_100%)]">
        <div ref={mountRef} className="w-full h-full" />

        {contextLost && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#FAF9F5]/95 p-6 text-center">
            <div className="max-w-sm rounded-xl border border-[#DBD6BE] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#181A1F]">
                Visualização 3D pausada
              </p>
              <p className="mt-1 text-xs text-[#5A606B]">
                O contexto gráfico está sendo restaurado automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

BagCanvas3D.displayName = 'BagCanvas3D';
