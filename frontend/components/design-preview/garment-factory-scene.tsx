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

  useFrame(() => {
    if (!moving.current || !controls.current) return;
    const alpha = reducedMotion ? 1 : 0.075;
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
    />
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
      <Html center position={[0, 2.15, 0]} distanceFactor={10} zIndexRange={[30, 0]}>
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
          {zone.shortLabel}
        </button>
      </Html>
    </group>
  );
}

function FactoryWorld(props: SceneProps & { reducedMotion: boolean }) {
  return (
    <>
      <color attach="background" args={["#071321"]} />
      <fog attach="fog" args={["#071321", 18, 30]} />
      <ambientLight intensity={0.7} color="#8db7c8" />
      <hemisphereLight args={["#baf7ff", "#06101c", 1.35]} />
      <directionalLight position={[6, 11, 8]} intensity={2.6} color="#dcfaff" castShadow shadow-mapSize={[1024, 1024]} />
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
    >
      <FactoryWorld {...props} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
