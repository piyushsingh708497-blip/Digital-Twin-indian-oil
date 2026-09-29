import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Telemetry } from '../../types';
import type { WellComponentId } from './WellSchematic';
import {
  RotateCcw,
  Flame,
  Activity,
  Droplets,
} from 'lucide-react';

interface ThreeWellTwinProps {
  telemetry: Telemetry | null | undefined;
  activeComponent?: WellComponentId;
  onSelectComponent?: (id: WellComponentId) => void;
  isOptimized?: boolean;
  optimizedTelemetry?: Partial<Telemetry> | null;
  height?: string;
  showControlsBar?: boolean;
}

export const ThreeWellTwin: React.FC<ThreeWellTwinProps> = ({
  telemetry,
  activeComponent: _activeComponent = 'reservoir',
  onSelectComponent,
  isOptimized = false,
  optimizedTelemetry = null,
  height = 'h-[520px]',
  showControlsBar = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Layer visibility toggles
  const [showThermal, setShowThermal] = useState(true);
  const [showStress, setShowStress] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [cameraView, setCameraView] = useState<'overview' | 'surface' | 'wellbore' | 'reservoir'>('overview');
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  // References for animation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Animated 3D objects
  const walkingBeamRef = useRef<THREE.Group | null>(null);
  const horseHeadRef = useRef<THREE.Group | null>(null);
  const polishedRodRef = useRef<THREE.Mesh | null>(null);
  const rodStringRef = useRef<THREE.Group | null>(null);
  const pumpPlungerRef = useRef<THREE.Mesh | null>(null);
  const thermalHaloMeshRef = useRef<THREE.Mesh | null>(null);
  const flowParticlesRef = useRef<THREE.Points | null>(null);
  const particlePositionsRef = useRef<Float32Array | null>(null);
  const raycastTargetsRef = useRef<{ mesh: THREE.Object3D; id: WellComponentId }[]>([]);

  // Compute effective telemetry parameters (blending if optimized)
  const spm = isOptimized
    ? (optimizedTelemetry?.srp?.spm ?? 5.5)
    : (telemetry?.srp?.spm ?? 4.5);
  const strokeLength = isOptimized
    ? (optimizedTelemetry?.srp?.strokeLength ?? 3.2)
    : (telemetry?.srp?.strokeLength ?? 2.8);
  const oilRate = isOptimized
    ? (optimizedTelemetry?.surface?.oilRate ?? 99.5)
    : (telemetry?.surface?.oilRate ?? 80.1);
  const rodStressPct = isOptimized
    ? 64.8
    : (telemetry?.srp?.rodLoadMax ? Math.min(100, Math.round((telemetry.srp.rodLoadMax / 85) * 100)) : 84.2);
  const resTemp = isOptimized
    ? 182.0
    : (telemetry?.reservoir?.temperature ?? 148.0);

  // Update thermal halo scale and color based on temperature
  useEffect(() => {
    if (thermalHaloMeshRef.current) {
      const scale = isOptimized ? 1.35 : 1.0;
      thermalHaloMeshRef.current.scale.set(scale, scale, scale);
      const mat = thermalHaloMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.color.setHex(isOptimized ? 0xF97316 : 0xEA580C);
        mat.emissive.setHex(isOptimized ? 0xD97706 : 0x9A3412);
        mat.emissiveIntensity = isOptimized ? 0.7 : 0.4;
      }
    }
  }, [isOptimized, resTemp]);

  // Update rod stress colors
  useEffect(() => {
    if (rodStringRef.current) {
      rodStringRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat) {
            // Gradient: top rods carry highest load
            const segmentStress = rodStressPct * (1 - index * 0.12);
            if (segmentStress > 80) {
              mat.color.setHex(0xDC2626); // Critical / High Stress Red
              mat.emissive.setHex(0x991B1B);
            } else if (segmentStress > 65) {
              mat.color.setHex(0xD97706); // Moderate Stress Amber
              mat.emissive.setHex(0x78350F);
            } else {
              mat.color.setHex(0x16A34A); // Safe / Optimal Stress Green
              mat.emissive.setHex(0x064E3B);
            }
          }
        }
      });
    }
  }, [rodStressPct, isOptimized]);

  // Camera presets
  const setCameraPreset = useCallback((preset: 'overview' | 'surface' | 'wellbore' | 'reservoir') => {
    setCameraView(preset);
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;

    switch (preset) {
      case 'overview':
        camera.position.set(38, 12, 42);
        controls.target.set(0, -18, 0);
        break;
      case 'surface':
        camera.position.set(14, 8, 18);
        controls.target.set(0, 3, 0);
        break;
      case 'wellbore':
        camera.position.set(22, -18, 22);
        controls.target.set(0, -20, 0);
        break;
      case 'reservoir':
        camera.position.set(18, -42, 20);
        controls.target.set(0, -45, 0);
        break;
    }
    controls.update();
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const heightPx = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF4F6F8);
    scene.fog = new THREE.FogExp2(0xF4F6F8, 0.007);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.5, 300);
    camera.position.set(38, 12, 42);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 140;
    controls.minDistance = 6;
    controls.maxPolarAngle = Math.PI / 2 + 0.35; // allow looking slightly from underground
    controls.target.set(0, -18, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.6);
    dirLight.position.set(35, 55, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xE2E8F0, 0.8);
    fillLight.position.set(-25, -20, -25);
    scene.add(fillLight);

    // Light underground glow around reservoir
    const reservoirLight = new THREE.PointLight(0xF59E0B, 2.5, 45);
    reservoirLight.position.set(0, -45, 0);
    scene.add(reservoirLight);

    raycastTargetsRef.current = [];

    // =========================================================================
    // 6. BUILD 3D ASSETS: GROUND & SUBSURFACE STRATA
    // =========================================================================

    // Ground Grid
    const gridHelper = new THREE.GridHelper(50, 25, 0x94A3B8, 0xCBD5E1);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Ground Surface Plane
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Transparent Strata Cutaway Box
    const strataGroup = new THREE.Group();
    scene.add(strataGroup);

    // Layer 1: Alluvium / Surface Sediments (0 to -15m)
    const alluviumGeo = new THREE.BoxGeometry(32, 14, 32);
    const alluviumMat = new THREE.MeshStandardMaterial({
      color: 0xEAD8C0,
      transparent: true,
      opacity: 0.18,
      roughness: 0.9,
    });
    const alluvium = new THREE.Mesh(alluviumGeo, alluviumMat);
    alluvium.position.y = -7;
    strataGroup.add(alluvium);

    // Layer 2: Caprock / Impermeable Shale (-15m to -35m)
    const shaleGeo = new THREE.BoxGeometry(32, 20, 32);
    const shaleMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      transparent: true,
      opacity: 0.22,
      roughness: 0.8,
    });
    const shale = new THREE.Mesh(shaleGeo, shaleMat);
    shale.position.y = -24;
    strataGroup.add(shale);

    // Layer 3: Baghewala Reservoir (Jodhpur Sandstone Formation) (-35m to -55m)
    const sandstoneGeo = new THREE.BoxGeometry(32, 20, 32);
    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xD97706,
      transparent: true,
      opacity: 0.28,
      roughness: 0.75,
    });
    const sandstone = new THREE.Mesh(sandstoneGeo, sandstoneMat);
    sandstone.position.y = -44;
    strataGroup.add(sandstone);

    // Reservoir Formation Layer wireframe boundary
    const sandstoneWireGeo = new THREE.BoxGeometry(32, 20, 32);
    const sandstoneWireMat = new THREE.MeshBasicMaterial({
      color: 0xB45309,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const sandstoneWire = new THREE.Mesh(sandstoneWireGeo, sandstoneWireMat);
    sandstoneWire.position.y = -44;
    strataGroup.add(sandstoneWire);

    // =========================================================================
    // 7. BUILD SURFACE PUMPJACK & WELLHEAD
    // =========================================================================
    const surfaceGroup = new THREE.Group();
    scene.add(surfaceGroup);

    // Concrete Wellhead Cellar Base
    const cellarGeo = new THREE.CylinderGeometry(3.5, 4.0, 0.8, 24);
    const cellarMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.9 });
    const cellar = new THREE.Mesh(cellarGeo, cellarMat);
    cellar.position.y = 0.4;
    cellar.castShadow = true;
    cellar.receiveShadow = true;
    surfaceGroup.add(cellar);

    // Wellhead Christmas Tree Assembly
    const treeGroup = new THREE.Group();
    treeGroup.position.set(0, 0.8, 0);

    // Master Casing Flange
    const flangeGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.5, 16);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const flange = new THREE.Mesh(flangeGeo, steelMat);
    flange.position.y = 0.25;
    treeGroup.add(flange);

    // Wellhead Spool & Valves
    const treeBodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.6, roughness: 0.4 });
    const treeBody = new THREE.Mesh(treeBodyGeo, treeMat);
    treeBody.position.y = 1.35;
    treeGroup.add(treeBody);

    // Flow line tee valve pointing towards pipeline
    const wingValveGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.2, 12);
    const wingValve = new THREE.Mesh(wingValveGeo, steelMat);
    wingValve.rotation.z = Math.PI / 2;
    wingValve.position.set(1.1, 1.6, 0);
    treeGroup.add(wingValve);

    // Surface Flowline running to test separator
    const flowlineGeo = new THREE.CylinderGeometry(0.18, 0.18, 14, 12);
    const flowlineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
    const flowline = new THREE.Mesh(flowlineGeo, flowlineMat);
    flowline.rotation.z = Math.PI / 2;
    flowline.position.set(8.2, 0.5, 0);
    surfaceGroup.add(flowline);

    // Polished Rod Stuffing Box
    const stuffingBoxGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.6, 16);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xD97706, metalness: 0.8, roughness: 0.2 });
    const stuffingBox = new THREE.Mesh(stuffingBoxGeo, brassMat);
    stuffingBox.position.y = 2.45;
    treeGroup.add(stuffingBox);

    surfaceGroup.add(treeGroup);
    raycastTargetsRef.current.push({ mesh: treeGroup, id: 'wellhead' });

    // PUMPJACK SKID & SAMSON POST
    const pumpjackGroup = new THREE.Group();
    pumpjackGroup.position.set(-8, 0, 0);

    // Steel Skid Base
    const skidGeo = new THREE.BoxGeometry(11, 0.4, 3.8);
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7, roughness: 0.4 });
    const skid = new THREE.Mesh(skidGeo, skidMat);
    skid.position.set(0, 0.2, 0);
    skid.castShadow = true;
    pumpjackGroup.add(skid);

    // Electric Drive Motor & Gearbox
    const motorGeo = new THREE.BoxGeometry(2.0, 1.6, 1.8);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x0F766E, metalness: 0.5, roughness: 0.5 }); // Muted industrial green
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(-3.5, 1.1, 0);
    motor.castShadow = true;
    pumpjackGroup.add(motor);

    // Samson Post (A-frame structure supporting walking beam)
    const samsonPostGeo = new THREE.ConeGeometry(2.2, 7.5, 4);
    const industrialGreenMat = new THREE.MeshStandardMaterial({ color: 0x166534, metalness: 0.4, roughness: 0.5 });
    const samsonPost = new THREE.Mesh(samsonPostGeo, industrialGreenMat);
    samsonPost.position.set(1.5, 4.0, 0);
    samsonPost.rotation.y = Math.PI / 4;
    samsonPost.castShadow = true;
    pumpjackGroup.add(samsonPost);

    // Walking Beam Pivot Center Bearing
    const centerBearingGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
    const centerBearing = new THREE.Mesh(centerBearingGeo, steelMat);
    centerBearing.rotation.x = Math.PI / 2;
    centerBearing.position.set(1.5, 7.8, 0);
    pumpjackGroup.add(centerBearing);

    // WALKING BEAM ASSEMBLY (Reciprocating Pivot)
    const beamPivotGroup = new THREE.Group();
    beamPivotGroup.position.set(1.5, 7.8, 0);

    // Walking Beam I-beam
    const beamGeo = new THREE.BoxGeometry(10.5, 0.7, 0.45);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x15803D, metalness: 0.5, roughness: 0.4 });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.set(0, 0, 0);
    beamMesh.castShadow = true;
    beamPivotGroup.add(beamMesh);

    // Horsehead (Curved arc at wellhead end of walking beam)
    const horseheadGroup = new THREE.Group();
    horseheadGroup.position.set(5.2, 0, 0);

    const horseheadPlateGeo = new THREE.BoxGeometry(1.6, 2.8, 0.3);
    const horseheadPlate = new THREE.Mesh(horseheadPlateGeo, beamMat);
    horseheadPlate.position.set(0.6, -0.6, 0);
    horseheadPlate.castShadow = true;
    horseheadGroup.add(horseheadPlate);

    const curvedArcGeo = new THREE.TorusGeometry(1.8, 0.15, 8, 24, Math.PI / 2);
    const curvedArc = new THREE.Mesh(curvedArcGeo, steelMat);
    curvedArc.rotation.z = Math.PI * 0.8;
    curvedArc.position.set(0.2, -0.2, 0);
    horseheadGroup.add(curvedArc);

    beamPivotGroup.add(horseheadGroup);
    horseHeadRef.current = horseheadGroup;

    // Counterweights on backend of walking beam
    const cweightGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.0, 16);
    const cweightMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const cweight = new THREE.Mesh(cweightGeo, cweightMat);
    cweight.rotation.x = Math.PI / 2;
    cweight.position.set(-4.5, -0.4, 0);
    cweight.castShadow = true;
    beamPivotGroup.add(cweight);

    pumpjackGroup.add(beamPivotGroup);
    walkingBeamRef.current = beamPivotGroup;
    surfaceGroup.add(pumpjackGroup);

    raycastTargetsRef.current.push({ mesh: pumpjackGroup, id: 'surface' });

    // POLISHED ROD (Connecting horsehead bridle down through stuffing box into wellbore)
    const polishedRodGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.0, 16);
    const polishedRodMat = new THREE.MeshStandardMaterial({
      color: 0xF1F5F9,
      metalness: 0.95,
      roughness: 0.1,
    });
    const polishedRod = new THREE.Mesh(polishedRodGeo, polishedRodMat);
    polishedRod.position.set(0, 4.5, 0);
    scene.add(polishedRod);
    polishedRodRef.current = polishedRod;

    // =========================================================================
    // 8. SUBSURFACE WELLBORE: CASING & TUBING
    // =========================================================================
    const wellboreGroup = new THREE.Group();
    scene.add(wellboreGroup);

    const WELL_DEPTH = 50; // visual representation of ~1100m well

    // Outer Production Casing (Cutaway / Semi-transparent)
    const casingGeo = new THREE.CylinderGeometry(0.95, 0.95, WELL_DEPTH, 24, 1, true);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const casing = new THREE.Mesh(casingGeo, casingMat);
    casing.position.y = -WELL_DEPTH / 2;
    wellboreGroup.add(casing);

    // Casing Collars every 10 meters for depth context
    for (let y = -5; y >= -WELL_DEPTH + 5; y -= 10) {
      const collarGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.4, 24);
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.6 });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.y = y;
      wellboreGroup.add(collar);
    }

    // Inner Production Tubing String
    const tubingGeo = new THREE.CylinderGeometry(0.48, 0.48, WELL_DEPTH - 2, 20, 1, true);
    const tubingMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      metalness: 0.6,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const tubing = new THREE.Mesh(tubingGeo, tubingMat);
    tubing.position.y = -(WELL_DEPTH - 2) / 2;
    wellboreGroup.add(tubing);

    raycastTargetsRef.current.push({ mesh: wellboreGroup, id: 'wellbore' });
    raycastTargetsRef.current.push({ mesh: tubing, id: 'tubing' });

    // SUCKER ROD STRING (Segmented with Stress Heatmap)
    const rodStringGroup = new THREE.Group();
    const NUM_ROD_SEGMENTS = 8;
    const segmentLength = (WELL_DEPTH - 4) / NUM_ROD_SEGMENTS;

    for (let i = 0; i < NUM_ROD_SEGMENTS; i++) {
      const rodSegGeo = new THREE.CylinderGeometry(0.1, 0.1, segmentLength - 0.2, 12);
      const rodSegMat = new THREE.MeshStandardMaterial({
        color: 0xD97706,
        metalness: 0.7,
        roughness: 0.3,
      });
      const rodSeg = new THREE.Mesh(rodSegGeo, rodSegMat);
      rodSeg.position.y = -(i * segmentLength + segmentLength / 2);
      rodStringGroup.add(rodSeg);
    }
    scene.add(rodStringGroup);
    rodStringRef.current = rodStringGroup;
    raycastTargetsRef.current.push({ mesh: rodStringGroup, id: 'rod_string' });

    // =========================================================================
    // 9. DOWNHOLE SUCKER ROD PUMP & PERFORATED ZONE
    // =========================================================================
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(0, -WELL_DEPTH + 4, 0);

    // Pump Working Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.65, 0.65, 4.5, 20, 1, true);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    pumpGroup.add(barrel);

    // Pump Plunger (reciprocates inside barrel)
    const plungerGeo = new THREE.CylinderGeometry(0.42, 0.42, 2.2, 16);
    const plungerMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.85, roughness: 0.2 });
    const plunger = new THREE.Mesh(plungerGeo, plungerMat);
    plunger.position.y = 0;
    pumpGroup.add(plunger);
    pumpPlungerRef.current = plunger;

    // Standing Valve Assembly (Bottom of pump)
    const sValveGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const sValveMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, metalness: 0.9 });
    const sValve = new THREE.Mesh(sValveGeo, sValveMat);
    sValve.position.y = -2.1;
    pumpGroup.add(sValve);

    scene.add(pumpGroup);
    raycastTargetsRef.current.push({ mesh: pumpGroup, id: 'pump' });

    // Perforations in Casing at Sandface (Small holes where heavy oil enters wellbore)
    const perfGroup = new THREE.Group();
    perfGroup.position.set(0, -WELL_DEPTH + 1, 0);
    for (let ring = 0; ring < 6; ring++) {
      const yOffset = -ring * 0.7;
      for (let hole = 0; hole < 8; hole++) {
        const angle = (hole / 8) * Math.PI * 2 + (ring % 2 ? 0.3 : 0);
        const perfDotGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const perfDotMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const perfDot = new THREE.Mesh(perfDotGeo, perfDotMat);
        perfDot.position.set(Math.cos(angle) * 0.96, yOffset, Math.sin(angle) * 0.96);
        perfGroup.add(perfDot);
      }
    }
    scene.add(perfGroup);
    raycastTargetsRef.current.push({ mesh: perfGroup, id: 'sandface' });

    // THERMAL STEAM CHAMBER HALO (CSS Steam Influence Sphere)
    const haloGeo = new THREE.SphereGeometry(6.5, 24, 24);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xEA580C,
      emissive: 0x9A3412,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.38,
      roughness: 0.6,
      wireframe: false,
    });
    const thermalHalo = new THREE.Mesh(haloGeo, haloMat);
    thermalHalo.position.set(0, -WELL_DEPTH + 2, 0);
    scene.add(thermalHalo);
    thermalHaloMeshRef.current = thermalHalo;
    raycastTargetsRef.current.push({ mesh: thermalHalo, id: 'reservoir' });

    // Depth Markers along wellbore
    const depths = [
      { y: 0, label: 'Surface (0m)' },
      { y: -15, label: '-300m (Caprock)' },
      { y: -35, label: '-750m (Mid Wellbore)' },
      { y: -45, label: '-1100m (Jodhpur Sandstone)' },
    ];
    depths.forEach(({ y }) => {
      const ringGeo = new THREE.RingGeometry(1.6, 1.7, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x94A3B8, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      scene.add(ring);
    });

    // =========================================================================
    // 10. DYNAMIC FLUID FLOW PARTICLES IN TUBING
    // =========================================================================
    const PARTICLE_COUNT = 70;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = Math.random() * 0.32;
      const angle = Math.random() * Math.PI * 2;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = -Math.random() * (WELL_DEPTH - 4);
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    particlePositionsRef.current = particlePositions;

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x15803D, // Oil green flow particles
      size: 0.45,
      transparent: true,
      opacity: 0.75,
    });
    const flowPoints = new THREE.Points(particleGeo, particleMat);
    scene.add(flowPoints);
    flowParticlesRef.current = flowPoints;

    // =========================================================================
    // 11. ANIMATION LOOP: RECIPROCATING SRP & FLOW
    // =========================================================================
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Reciprocating frequency based on current/optimized SPM
      const currentSpm = spm;
      const freq = (currentSpm / 60) * Math.PI * 2;
      const strokeAmp = (strokeLength / 3.0) * 0.16; // angular oscillation amplitude

      // 1. Oscillate walking beam
      if (walkingBeamRef.current) {
        walkingBeamRef.current.rotation.z = Math.sin(time * freq) * strokeAmp;
      }

      // 2. Vertical motion of polished rod & downhole plunger
      const verticalDisplacement = Math.sin(time * freq) * (strokeLength * 0.35);
      if (polishedRodRef.current) {
        polishedRodRef.current.position.y = 4.2 + verticalDisplacement;
      }
      if (rodStringRef.current) {
        rodStringRef.current.position.y = verticalDisplacement;
      }
      if (pumpPlungerRef.current) {
        pumpPlungerRef.current.position.y = verticalDisplacement;
      }

      // 3. Fluid Flow Particles upward motion inside tubing
      if (flowParticlesRef.current && particlePositionsRef.current && showFlow) {
        const positions = flowParticlesRef.current.geometry.attributes.position.array as Float32Array;
        const flowVelocity = (oilRate / 80.0) * 12.0 * delta;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          positions[i * 3 + 1] += flowVelocity;
          if (positions[i * 3 + 1] > 0.5) {
            positions[i * 3 + 1] = -(WELL_DEPTH - 4);
          }
        }
        flowParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // 4. Subtle pulse on thermal halo
      if (thermalHaloMeshRef.current && showThermal) {
        const pulse = 1.0 + Math.sin(time * 1.8) * 0.03;
        const baseScale = isOptimized ? 1.35 : 1.0;
        thermalHaloMeshRef.current.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // =========================================================================
    // 12. RAYCASTING INTERACTIVITY: COMPONENT SELECTION
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const objectsToIntersect = raycastTargetsRef.current.map((t) => t.mesh);
      const intersects = raycaster.intersectObjects(objectsToIntersect, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const match = raycastTargetsRef.current.find(
          (t) => t.mesh === hit || t.mesh.children.includes(hit) || hit.parent === t.mesh
        );
        if (match && onSelectComponent) {
          onSelectComponent(match.id);
        }
      }
    };

    const handlePointerMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const objectsToIntersect = raycastTargetsRef.current.map((t) => t.mesh);
      const intersects = raycaster.intersectObjects(objectsToIntersect, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const match = raycastTargetsRef.current.find(
          (t) => t.mesh === hit || t.mesh.children.includes(hit) || hit.parent === t.mesh
        );
        setHoveredComponent(match ? match.id : null);
        container.style.cursor = 'pointer';
      } else {
        setHoveredComponent(null);
        container.style.cursor = 'default';
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);

    // Resize handling
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update layer visibility dynamically
  useEffect(() => {
    if (thermalHaloMeshRef.current) thermalHaloMeshRef.current.visible = showThermal;
  }, [showThermal]);

  useEffect(() => {
    if (flowParticlesRef.current) flowParticlesRef.current.visible = showFlow;
  }, [showFlow]);

  return (
    <div className={`relative w-full ${height} bg-[#F4F6F8] rounded-md border border-[#E2E8F0] overflow-hidden select-none flex flex-col`}>
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* Top Overlay: Digital Twin State HUD & Badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        {/* Left: Well Info & State Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-2.5 py-1 rounded bg-white/95 backdrop-blur-sm border border-[#E2E8F0] shadow-xs flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOptimized ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
            <span className="text-[11px] font-mono font-bold text-slate-900 tracking-wider">
              {isOptimized ? 'SIMULATED OPTIMIZED TWIN' : 'CURRENT OPERATING TWIN'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {isOptimized ? '(Joint Pareto Forecast)' : '(Live Field Baseline)'}
            </span>
          </div>

          {hoveredComponent && (
            <div className="px-2 py-0.5 rounded bg-slate-900/90 text-white text-[10px] font-mono tracking-wider uppercase border border-slate-700">
              Target: {hoveredComponent.replace('_', ' ')}
            </div>
          )}
        </div>

        {/* Right: Camera Preset Switcher */}
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded p-0.5 shadow-xs pointer-events-auto">
          <button
            onClick={() => setCameraPreset('overview')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              cameraView === 'overview' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Overview (Surface to Formation)"
          >
            Overview
          </button>
          <button
            onClick={() => setCameraPreset('surface')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              cameraView === 'surface' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Surface Wellhead & Pumpjack"
          >
            Surface
          </button>
          <button
            onClick={() => setCameraPreset('wellbore')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              cameraView === 'wellbore' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mid-Depth Wellbore & Tubing"
          >
            Wellbore
          </button>
          <button
            onClick={() => setCameraPreset('reservoir')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              cameraView === 'reservoir' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Downhole Pump & Jodhpur Sandstone"
          >
            Reservoir
          </button>
        </div>
      </div>

      {/* Bottom Floating Toolbar: Layer Toggles & Physics Telemetry Readouts */}
      {showControlsBar && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Layer Visibility Toggles */}
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded p-1 shadow-xs pointer-events-auto">
            <span className="text-[10px] font-mono text-slate-500 uppercase px-1 font-semibold">LAYERS:</span>
            <button
              onClick={() => setShowThermal(!showThermal)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                showThermal
                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
              title="Toggle CSS Steam Thermal Halo"
            >
              <Flame className="w-3 h-3" />
              Thermal
            </button>
            <button
              onClick={() => setShowStress(!showStress)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                showStress
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
              title="Toggle Rod Stress Heatmap"
            >
              <Activity className="w-3 h-3" />
              Stress
            </button>
            <button
              onClick={() => setShowFlow(!showFlow)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                showFlow
                  ? 'bg-blue-50 text-blue-900 border-blue-300 font-semibold'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
              title="Toggle Fluid Production Flow Stream"
            >
              <Droplets className="w-3 h-3" />
              Flow
            </button>
          </div>

          {/* Quick Physics In-situ Badges */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="px-2 py-1 rounded bg-white/95 backdrop-blur-sm border border-[#E2E8F0] shadow-xs flex items-center gap-3 text-[11px] font-mono">
              <div>
                <span className="text-slate-400 text-[9px] block leading-none">RESERVOIR TEMP</span>
                <span className="font-bold text-amber-700">{resTemp.toFixed(1)}°C</span>
              </div>
              <div className="w-[1px] h-5 bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[9px] block leading-none">ROD STRESS</span>
                <span className={`font-bold ${rodStressPct > 80 ? 'text-rose-600' : rodStressPct > 65 ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {rodStressPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-[1px] h-5 bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[9px] block leading-none">OIL RATE</span>
                <span className="font-bold text-emerald-700">{oilRate.toFixed(1)} m³/d</span>
              </div>
              <div className="w-[1px] h-5 bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[9px] block leading-none">PUMP SPEED</span>
                <span className="font-bold text-slate-800">{spm.toFixed(1)} SPM</span>
              </div>
            </div>

            <button
              onClick={() => setCameraPreset('overview')}
              className="p-1.5 rounded bg-white/95 backdrop-blur-sm border border-[#E2E8F0] text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
              title="Reset 3D Camera View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeWellTwin;
