"use client";

import { Html, OrbitControls, ContactShadows } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { factoryZones, type ZoneId } from "./demo-data";
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

function Table({ position, size = [2.1, 0.12, 1] }: { position: [number, number, number]; size?: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#597184" roughness={0.72} metalness={0.18} />
      </mesh>
      {[-0.82, 0.82].flatMap((x) => [-0.34, 0.34].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.35, z]}>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
          <meshStandardMaterial color="#243849" metalness={0.55} />
        </mesh>
      )))}
    </group>
  );
}

function SewingStation({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Table position={[0, 0, 0]} size={[1.3, 0.1, 0.72]} />
      <mesh castShadow position={[0.15, 0.99, 0]}>
        <boxGeometry args={[0.5, 0.32, 0.32]} />
        <meshStandardMaterial color="#d8e4e9" roughness={0.36} metalness={0.28} />
      </mesh>
      <mesh castShadow position={[-0.1, 1.2, 0]}>
        <boxGeometry args={[0.08, 0.42, 0.08]} />
        <meshStandardMaterial color="#1f3645" metalness={0.7} />
      </mesh>
      <mesh castShadow position={[-0.1, 1.4, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#1f3645" metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.04, -0.72]}>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
        <meshStandardMaterial color="#243849" />
      </mesh>
    </group>
  );
}

function Worker({ position, color = "#22d3ee" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.38, 0]}>
        <sphereGeometry args={[0.16, 14, 10]} />
        <meshStandardMaterial color="#ba7b57" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.92, 0]}>
        <capsuleGeometry args={[0.21, 0.56, 5, 10]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
      <mesh castShadow position={[-0.11, 0.38, 0]}>
        <boxGeometry args={[0.1, 0.58, 0.12]} />
        <meshStandardMaterial color="#1b2b3a" />
      </mesh>
      <mesh castShadow position={[0.11, 0.38, 0]}>
        <boxGeometry args={[0.1, 0.58, 0.12]} />
        <meshStandardMaterial color="#1b2b3a" />
      </mesh>
    </group>
  );
}

function BuildingShell() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.08, 0]}>
        <boxGeometry args={[15, 0.16, 10]} />
        <meshStandardMaterial color="#122334" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 2.3, -4.9]}>
        <boxGeometry args={[15, 4.7, 0.16]} />
        <meshStandardMaterial color="#152d3f" roughness={0.83} />
      </mesh>
      <mesh receiveShadow position={[-7.4, 2.3, 0]}>
        <boxGeometry args={[0.16, 4.7, 10]} />
        <meshStandardMaterial color="#142b3b" roughness={0.86} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <group key={x}>
          <mesh castShadow position={[x, 2.35, -4.68]}>
            <boxGeometry args={[0.13, 4.55, 0.13]} />
            <meshStandardMaterial color="#3b5568" metalness={0.62} />
          </mesh>
          <mesh position={[x, 4.45, 0]}>
            <boxGeometry args={[0.12, 0.12, 9.4]} />
            <meshStandardMaterial color="#476377" metalness={0.7} />
          </mesh>
        </group>
      ))}
      {[-3.2, 0, 3.2].map((z) => (
        <mesh key={z} position={[0, 4.45, z]}>
          <boxGeometry args={[14.6, 0.1, 0.1]} />
          <meshStandardMaterial color="#476377" metalness={0.7} />
        </mesh>
      ))}
      {[-5, -1.7, 1.7, 5].map((x) => (
        <group key={x} position={[x, 4.1, -0.4]}>
          <mesh>
            <boxGeometry args={[1.8, 0.06, 0.3]} />
            <meshStandardMaterial color="#d7fbff" emissive="#80e8ff" emissiveIntensity={2.3} />
          </mesh>
          <pointLight color="#b9f4ff" intensity={9} distance={6} decay={2} />
        </group>
      ))}
      {[-2.8, 2.2].map((z) => (
        <mesh key={z} position={[0, 0.012, z]}>
          <boxGeometry args={[14, 0.018, 0.045]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ))}
    </group>
  );
}

function CuttingZone() {
  return (
    <group>
      <Table position={[-4.9, 0, -2.25]} size={[3.2, 0.12, 1.35]} />
      {[-5.9, -5.35, -4.8].map((x, index) => (
        <mesh key={x} castShadow position={[x, 1.08, -2.25]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18 + index * 0.015, 0.18 + index * 0.015, 1.08, 18]} />
          <meshStandardMaterial color={["#22d3ee", "#a78bfa", "#fb7185"][index]} roughness={0.72} />
        </mesh>
      ))}
      <mesh castShadow position={[-4.5, 0.92, -2.25]}>
        <boxGeometry args={[0.9, 0.05, 0.95]} />
        <meshStandardMaterial color="#d4f3ed" roughness={0.92} />
      </mesh>
      <Worker position={[-6.4, 0, -1.55]} color="#22d3ee" />
    </group>
  );
}

function SewingZone() {
  const stations = useMemo(() => [
    [-2.6, 0, -0.25], [-0.8, 0, -0.25], [1, 0, -0.25],
    [-2.6, 0, 1.15], [-0.8, 0, 1.15], [1, 0, 1.15],
  ] as Array<[number, number, number]>, []);
  return (
    <group>
      {stations.map((position, index) => <SewingStation key={index} position={position} rotation={index > 2 ? Math.PI : 0} />)}
      <Worker position={[-1.8, 0, 0.45]} color="#34d399" />
      <Worker position={[0.05, 0, 1.85]} color="#a78bfa" />
    </group>
  );
}

function FinishingZone() {
  return (
    <group>
      <Table position={[4.7, 0, -2.55]} size={[2.4, 0.12, 1.1]} />
      <mesh castShadow position={[4.7, 1.12, -2.55]}>
        <boxGeometry args={[0.8, 0.55, 0.55]} />
        <meshStandardMaterial color="#c8d6dd" metalness={0.38} />
      </mesh>
      <mesh position={[4.7, 1.5, -2.55]}>
        <boxGeometry args={[0.32, 0.22, 0.28]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.55} />
      </mesh>
      <Worker position={[6.1, 0, -2.05]} color="#fbbf24" />
    </group>
  );
}

function QualityZone() {
  return (
    <group>
      <Table position={[4.2, 0, 2.2]} size={[2.25, 0.12, 1.2]} />
      <mesh castShadow position={[4.2, 0.86, 2.2]}>
        <boxGeometry args={[1.55, 0.08, 0.72]} />
        <meshStandardMaterial color="#e6eff2" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[5.35, 1.45, 2.2]}>
        <boxGeometry args={[0.08, 1.65, 1.5]} />
        <meshStandardMaterial color="#40596c" metalness={0.45} />
      </mesh>
      <Worker position={[3.1, 0, 2.85]} color="#fb7185" />
    </group>
  );
}

function PackingZone() {
  return (
    <group>
      <mesh receiveShadow position={[-4.45, 0.45, 2.9]}>
        <boxGeometry args={[3.8, 0.3, 0.95]} />
        <meshStandardMaterial color="#354c5f" metalness={0.48} roughness={0.44} />
      </mesh>
      {[-5.75, -4.85, -3.95, -3.05].map((x) => (
        <mesh key={x} castShadow position={[x, 0.87, 2.9]}>
          <boxGeometry args={[0.66, 0.52, 0.64]} />
          <meshStandardMaterial color="#9a6d3f" roughness={0.9} />
        </mesh>
      ))}
      <Worker position={[-5.65, 0, 3.9]} color="#22d3ee" />
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
      <BuildingShell />
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
