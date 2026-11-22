"use client";

import { Html, OrbitControls, ContactShadows } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { factoryZones, type ZoneId } from "./demo-data";
import {
  CuttingZone,
  FabricStorageZone,
  FactoryShell,
  FinishingZone,
  PackingZone,
  QualityZone,
  SewingZone,
} from "./factory-models";
import styles from "./garment-command-center.module.css";

type SceneProps = {
  selectedZone: ZoneId;
  hoveredZone: ZoneId | null;
  resetSignal: number;
  onSelect: (zone: ZoneId) => void;
  onHover: (zone: ZoneId | null) => void;
};

const overviewCamera = new THREE.Vector3(9.8, 9.2, 13.8);
const overviewTarget = new THREE.Vector3(0, 0.2, 0);

function CameraRig({ selectedZone, resetSignal, reducedMotion }: Pick<SceneProps, "selectedZone" | "resetSignal"> & { reducedMotion: boolean }) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const destination = useRef(overviewCamera.clone());
  const target = useRef(overviewTarget.clone());
  const moving = useRef(true);

  useEffect(() => {
    const zone = factoryZones.find((item) => item.id === selectedZone);
    if (!zone) return;
    destination.current.set(...zone.camera);
    target.current.set(zone.position[0], 0.3, zone.position[2]);
    moving.current = true;
  }, [selectedZone]);

  useEffect(() => {
    destination.current.copy(overviewCamera);
    target.current.copy(overviewTarget);
    moving.current = true;
  }, [resetSignal]);

  useFrame((_, delta) => {
    if (!moving.current || !controls.current) return;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.2);
    camera.position.lerp(destination.current, alpha);
    controls.current.target.lerp(target.current, alpha);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.04 && controls.current.target.distanceTo(target.current) < 0.04) {
      moving.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      enablePan={false}
      minDistance={7}
      maxDistance={22}
      minPolarAngle={0.48}
      maxPolarAngle={1.28}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={1.25}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}

const zoneFootprints: Record<ZoneId, [number, number]> = {
  storage: [3.1, 2.75],
  cutting: [3.65, 2.6],
  sewing: [5.45, 3.45],
  finishing: [3.05, 2.55],
  quality: [3.05, 2.55],
  packing: [3.45, 2.5],
};

function ZoneBoundary({ zone, active }: { zone: (typeof factoryZones)[number]; active: boolean }) {
  const [width, depth] = zoneFootprints[zone.id];
  const opacity = active ? 0.58 : 0.18;
  return (
    <group position={[0, -0.37, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={zone.accent} transparent opacity={active ? 0.075 : 0.022} depthWrite={false} />
      </mesh>
      {[-depth / 2, depth / 2].map((z) => (
        <mesh key={`z-${z}`} position={[0, 0.012, z]}>
          <boxGeometry args={[width, 0.022, 0.035]} />
          <meshBasicMaterial color={zone.accent} transparent opacity={opacity} />
        </mesh>
      ))}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={`x-${x}`} position={[x, 0.012, 0]}>
          <boxGeometry args={[0.035, 0.022, depth]} />
          <meshBasicMaterial color={zone.accent} transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}


function ZoneHotspot({ zone, selected, hovered, onSelect, onHover }: {
  zone: (typeof factoryZones)[number];
  selected: boolean;
  hovered: boolean;
  onSelect: (zone: ZoneId) => void;
  onHover: (zone: ZoneId | null) => void;
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(zone.id);
  };
  return (
    <group position={zone.position}>
      <ZoneBoundary zone={zone} active={selected || hovered} />
      <mesh
        position={[0, 0.72, 0]}
        onClick={handleClick}
        onPointerEnter={(event) => { event.stopPropagation(); onHover(zone.id); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { onHover(null); document.body.style.cursor = "default"; }}
      >
        <boxGeometry args={[2.7, 1.7, 2.1]} />
        <meshBasicMaterial color={zone.accent} transparent opacity={selected ? 0.11 : hovered ? 0.065 : 0.008} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.018, 0]}>
        <ringGeometry args={[0.48, 0.56, 32]} />
        <meshBasicMaterial color={zone.accent} transparent opacity={selected ? 0.95 : 0.34} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.05, 8]} />
        <meshBasicMaterial color={zone.accent} transparent opacity={selected || hovered ? 0.6 : 0.2} />
      </mesh>
      <Html center position={[0, 2.32, 0]} distanceFactor={10} zIndexRange={[30, 0]}>
        <button
          type="button"
          onClick={() => onSelect(zone.id)}
          onMouseEnter={() => onHover(zone.id)}
          onMouseLeave={() => onHover(null)}
          className={`${styles.sceneMarker} ${selected ? styles.sceneMarkerActive : ""}`}
          style={{ "--zone-color": zone.accent } as React.CSSProperties}
          aria-label={`Focus 3D view on ${zone.label}`}
        >
          <span />
          <span className={styles.markerCopy}>
            {zone.shortLabel}
            {(selected || hovered) && <small>{zone.evidence} demo evidence items</small>}
          </span>
        </button>
      </Html>
    </group>
  );
}

function FactoryWorld(props: SceneProps & { reducedMotion: boolean }) {
  return (
    <>
      <color attach="background" args={["#071321"]} />
      <fog attach="fog" args={["#071321", 17, 31]} />
      <ambientLight intensity={0.38} color="#7aa9bd" />
      <hemisphereLight args={["#baf7ff", "#030912", 1.05]} />
      <directionalLight
        position={[7, 11, 8]}
        intensity={2.35}
        color="#dcfaff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <spotLight position={[-6, 7, 4]} target-position={[-3, 0, 0]} color="#22d3ee" intensity={22} angle={0.48} penumbra={0.8} distance={17} />
      <spotLight position={[7, 6, 2]} target-position={[4, 0, 0]} color="#a78bfa" intensity={15} angle={0.5} penumbra={0.85} distance={15} />
      <FactoryShell />
      <FabricStorageZone />
      <CuttingZone />
      <SewingZone />
      <FinishingZone />
      <QualityZone />
      <PackingZone />
      {factoryZones.map((zone) => (
        <ZoneHotspot
          key={zone.id}
          zone={zone}
          selected={props.selectedZone === zone.id}
          hovered={props.hoveredZone === zone.id}
          onSelect={props.onSelect}
          onHover={props.onHover}
        />
      ))}
      <ContactShadows position={[0, 0.015, 0]} opacity={0.48} scale={17} blur={2.6} far={10} />
      <CameraRig selectedZone={props.selectedZone} resetSignal={props.resetSignal} reducedMotion={props.reducedMotion} />
    </>
  );
}

export default function GarmentFactoryScene(props: SceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      camera={{ position: overviewCamera.toArray(), fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onPointerMissed={() => props.onHover(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <FactoryWorld {...props} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
