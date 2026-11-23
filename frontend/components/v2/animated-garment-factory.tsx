"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "./theme-provider";
import { FactoryErrorBoundary } from "./factory-error-boundary";

function Smoke({ dark, animate }: { dark: boolean; animate: boolean }) {
  const puffs = useRef<Array<THREE.Mesh | null>>([]);
  const seeds = useMemo(
    () => Array.from({ length: 9 }, (_, index) => ({ phase: index / 9, drift: 0.7 + (index % 3) * 0.18 })),
    [],
  );

  useFrame((state) => {
    const elapsed = animate ? state.clock.elapsedTime : 0;
    puffs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const seed = seeds[index];
      const progress = (elapsed * 0.12 + seed.phase) % 1;
      mesh.position.set(
        2.25 + Math.sin(progress * Math.PI * 2 + index) * 0.16 * seed.drift,
        3.7 + progress * 3.25,
        -0.55 + Math.cos(progress * 4 + index) * 0.09,
      );
      const scale = 0.18 + progress * 0.58;
      mesh.scale.setScalar(scale);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.24;
    });
  });

  return (
    <group aria-label="Decorative chimney smoke">
      {seeds.map((seed, index) => (
        <mesh key={seed.phase} ref={(mesh) => { puffs.current[index] = mesh; }}>
          <sphereGeometry args={[0.72, 12, 10]} />
          <meshBasicMaterial
            color={dark ? "#b7bfd0" : "#e2e3e8"}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function WindowRow({ y }: { y: number }) {
  return (
    <group position={[0, y, 2.04]}>
      {[-2.8, -1.7, -0.6, 0.6, 1.7, 2.8].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.7, 0.62, 0.06]} />
            <meshStandardMaterial color="#19354d" metalness={0.32} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.58, 0.5, 0.02]} />
            <meshStandardMaterial color="#a9e9f3" emissive="#66d9e8" emissiveIntensity={0.62} roughness={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FactoryBuilding({ dark, animate }: { dark: boolean; animate: boolean }) {
  const building = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!animate || !building.current) return;
    building.current.rotation.y = -0.1 + Math.sin(state.clock.elapsedTime * 0.22) * 0.025;
  });

  return (
    <group ref={building} rotation={[0, -0.1, 0]} position={[0, -0.35, 0]}>
      <mesh castShadow receiveShadow position={[0, 1.6, 0]}>
        <boxGeometry args={[8, 3.3, 4]} />
        <meshStandardMaterial color={dark ? "#26364a" : "#e5ded6"} roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh castShadow position={[0, 3.35, 0]}>
        <boxGeometry args={[8.25, 0.22, 4.25]} />
        <meshStandardMaterial color={dark ? "#111c2b" : "#3d4857"} roughness={0.5} metalness={0.28} />
      </mesh>
      <mesh castShadow position={[-2.65, 0.85, 2.08]}>
        <boxGeometry args={[1.35, 1.75, 0.14]} />
        <meshStandardMaterial color="#17263a" roughness={0.46} />
      </mesh>
      <mesh position={[-2.65, 1.05, 2.17]}>
        <boxGeometry args={[0.48, 0.85, 0.04]} />
        <meshStandardMaterial color="#7dd3df" emissive="#2fb7ca" emissiveIntensity={0.35} />
      </mesh>
      <mesh castShadow position={[2.55, 0.72, 2.08]}>
        <boxGeometry args={[2.2, 1.45, 0.14]} />
        <meshStandardMaterial color="#26384a" roughness={0.55} metalness={0.26} />
      </mesh>
      {[-0.68, 0, 0.68].map((x) => (
        <mesh key={x} position={[2.55 + x, 0.72, 2.17]}>
          <boxGeometry args={[0.055, 1.25, 0.03]} />
          <meshStandardMaterial color="#718092" metalness={0.55} />
        </mesh>
      ))}
      <WindowRow y={1.35} />
      <WindowRow y={2.35} />
      <group position={[0, 2.72, 2.16]}>
        <mesh>
          <boxGeometry args={[2.8, 0.58, 0.12]} />
          <meshStandardMaterial color="#17263a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[2.56, 0.38, 0.025]} />
          <meshStandardMaterial color="#f7a4b6" emissive="#f44f86" emissiveIntensity={0.28} />
        </mesh>
      </group>
      <mesh castShadow position={[2.25, 4.18, -0.55]}>
        <cylinderGeometry args={[0.35, 0.44, 1.9, 18]} />
        <meshStandardMaterial color="#59687a" roughness={0.46} metalness={0.52} />
      </mesh>
      <mesh position={[2.25, 5.13, -0.55]}>
        <torusGeometry args={[0.36, 0.065, 8, 20]} />
        <meshStandardMaterial color="#8391a1" metalness={0.62} />
      </mesh>
      <mesh castShadow position={[-2.1, 3.83, -0.7]}>
        <boxGeometry args={[1.45, 0.72, 1.2]} />
        <meshStandardMaterial color="#4b5b6e" roughness={0.48} metalness={0.35} />
      </mesh>
      <Smoke dark={dark} animate={animate} />
    </group>
  );
}

function FactoryScene({ dark, animate }: { dark: boolean; animate: boolean }) {
  return (
    <>
      <color attach="background" args={[dark ? "#171c3d" : "#7257d8"]} />
      <fog attach="fog" args={[dark ? "#171c3d" : "#7257d8", 18, 32]} />
      <ambientLight intensity={dark ? 0.72 : 0.95} color={dark ? "#8ca8d8" : "#d9e6ff"} />
      <hemisphereLight args={[dark ? "#d7ddff" : "#fff4f1", "#1b1935", dark ? 1.25 : 1.5]} />
      <directionalLight position={[7, 11, 8]} intensity={dark ? 2.8 : 3.3} color="#fff3ec" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5, 4, 5]} intensity={18} distance={16} color="#f89bb4" />
      <pointLight position={[5, 3, 4]} intensity={15} distance={14} color="#72dce8" />
      <FactoryBuilding dark={dark} animate={animate} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]}>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color={dark ? "#111827" : "#d8d1cb"} roughness={0.95} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.69, 4.1]}>
        <planeGeometry args={[10, 2.4]} />
        <meshStandardMaterial color={dark ? "#263447" : "#7a8190"} roughness={0.88} />
      </mesh>
      <ContactShadows position={[0, -0.68, 0]} opacity={dark ? 0.5 : 0.36} scale={15} blur={2.5} far={9} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minDistance={10}
        maxDistance={20}
        minPolarAngle={0.72}
        maxPolarAngle={1.25}
        autoRotate={animate}
        autoRotateSpeed={0.28}
      />
    </>
  );
}

export function AnimatedGarmentFactory({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const animate = visible && !reducedMotion;
  return (
    <FactoryErrorBoundary>
      <div className={`animated-factory ${compact ? "compact" : ""}`}>
        <Canvas
          aria-label="Animated exterior of a garment factory with decorative chimney smoke"
          dpr={[1, 1.5]}
          frameloop={animate ? "always" : "demand"}
          shadows="percentage"
          camera={{ position: compact ? [10.5, 6.2, 13.5] : [10, 6, 13], fov: compact ? 36 : 34, near: 0.1, far: 60 }}
          gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = theme === "dark" ? 1.14 : 1.22;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <FactoryScene dark={theme === "dark"} animate={animate} />
        </Canvas>
        <span className="factory-disclaimer">Decorative 3D illustration · not environmental data</span>
      </div>
    </FactoryErrorBoundary>
  );
}
