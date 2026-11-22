"use client";

import { useMemo } from "react";

type Position = [number, number, number];

const metal = "#263e50";
const steel = "#7793a3";
const paleSteel = "#c8d7dd";
const cardboard = "#9d7147";

function Table({
  position,
  size = [2.1, 0.12, 1],
  top = "#607b8d",
}: {
  position: Position;
  size?: Position;
  top?: string;
}) {
  const legX = size[0] / 2 - 0.12;
  const legZ = size[2] / 2 - 0.12;
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={top} roughness={0.58} metalness={0.34} />
      </mesh>
      {[-legX, legX].flatMap((x) =>
        [-legZ, legZ].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, 0.35, z]}>
            <boxGeometry args={[0.09, 0.7, 0.09]} />
            <meshStandardMaterial color={metal} metalness={0.72} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Worker({ position, color = "#22d3ee" }: { position: Position; color?: string }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.38, 0]}>
        <sphereGeometry args={[0.16, 14, 10]} />
        <meshStandardMaterial color="#b97c5b" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.92, 0]}>
        <capsuleGeometry args={[0.21, 0.56, 5, 10]} />
        <meshStandardMaterial color={color} roughness={0.68} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} castShadow position={[x, 0.38, 0]}>
          <boxGeometry args={[0.1, 0.58, 0.12]} />
          <meshStandardMaterial color="#132435" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function FabricRoll({ position, color, radius = 0.22 }: { position: Position; color: string; radius?: number }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, 1.25, 24]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 16]} />
        <meshStandardMaterial color="#decfb9" roughness={0.9} />
      </mesh>
    </group>
  );
}

function StorageRack({ position, colors }: { position: Position; colors: string[] }) {
  return (
    <group position={position}>
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} castShadow position={[x, 1.18, 0]}>
          <boxGeometry args={[0.1, 2.36, 0.72]} />
          <meshStandardMaterial color={metal} metalness={0.72} roughness={0.32} />
        </mesh>
      ))}
      {[0.28, 1.08, 1.88].map((y) => (
        <mesh key={y} castShadow position={[0, y, 0]}>
          <boxGeometry args={[2.15, 0.08, 0.82]} />
          <meshStandardMaterial color={steel} metalness={0.58} roughness={0.36} />
        </mesh>
      ))}
      {colors.map((color, index) => (
        <FabricRoll
          key={`${color}-${index}`}
          position={[-0.58 + (index % 2) * 1.18, 0.58 + Math.floor(index / 2) * 0.8, 0]}
          color={color}
        />
      ))}
    </group>
  );
}

function Chair({ position, rotation = 0 }: { position: Position; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.46]} />
        <meshStandardMaterial color="#244356" roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, 0.8, 0.2]}>
        <boxGeometry args={[0.46, 0.58, 0.08]} />
        <meshStandardMaterial color="#244356" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.44, 10]} />
        <meshStandardMaterial color={metal} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.05, 12]} />
        <meshStandardMaterial color={metal} metalness={0.7} />
      </mesh>
    </group>
  );
}

function ThreadSpool({ position, color }: { position: Position; color: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.075, 0.095, 0.2, 16]} />
        <meshStandardMaterial color={color} roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 10]} />
        <meshStandardMaterial color={steel} metalness={0.65} />
      </mesh>
    </group>
  );
}

function SewingStation({ position, rotation = 0, spool = "#22d3ee" }: { position: Position; rotation?: number; spool?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Table position={[0, 0, 0]} size={[1.25, 0.1, 0.7]} top="#718897" />
      <mesh castShadow position={[0.12, 0.96, 0]}>
        <boxGeometry args={[0.48, 0.28, 0.28]} />
        <meshPhysicalMaterial color="#d8e5e9" roughness={0.3} metalness={0.42} clearcoat={0.25} />
      </mesh>
      <mesh castShadow position={[-0.11, 1.19, 0]}>
        <boxGeometry args={[0.07, 0.42, 0.07]} />
        <meshStandardMaterial color={metal} metalness={0.75} />
      </mesh>
      <mesh castShadow position={[-0.11, 1.38, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.46, 0.045, 0.045]} />
        <meshStandardMaterial color={metal} metalness={0.75} />
      </mesh>
      <ThreadSpool position={[-0.32, 1.08, -0.18]} color={spool} />
      <mesh position={[0, 0.035, -0.52]}>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <meshStandardMaterial color="#152636" metalness={0.48} />
      </mesh>
      <Chair position={[0, 0, -0.72]} />
    </group>
  );
}

function Box({ position, rotation = 0, scale = 1 }: { position: Position; rotation?: number; scale?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.55, 0.62]} />
        <meshStandardMaterial color={cardboard} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.282, 0]}>
        <boxGeometry args={[0.09, 0.012, 0.63]} />
        <meshStandardMaterial color="#d4b279" roughness={0.84} />
      </mesh>
    </group>
  );
}

export function FactoryShell() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[15.6, 0.2, 10.6]} />
        <meshStandardMaterial color="#0b1b29" roughness={0.84} metalness={0.16} />
      </mesh>
      <gridHelper args={[15, 30, "#235065", "#132d3d"]} position={[0, 0.012, 0]} />
      <mesh receiveShadow position={[0, 2.45, -5.15]}>
        <boxGeometry args={[15.6, 5, 0.18]} />
        <meshStandardMaterial color="#102739" roughness={0.76} metalness={0.12} />
      </mesh>
      <mesh receiveShadow position={[-7.7, 2.45, 0]}>
        <boxGeometry args={[0.18, 5, 10.5]} />
        <meshStandardMaterial color="#0f2637" roughness={0.8} />
      </mesh>
      {[-6.2, -3.1, 0, 3.1, 6.2].map((x) => (
        <group key={x}>
          <mesh castShadow position={[x, 2.4, -5]}>
            <boxGeometry args={[0.14, 4.8, 0.16]} />
            <meshStandardMaterial color="#38566a" metalness={0.68} roughness={0.28} />
          </mesh>
          <mesh position={[x, 4.65, 0]}>
            <boxGeometry args={[0.13, 0.13, 10]} />
            <meshStandardMaterial color="#46677b" metalness={0.76} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {[-3.4, 0, 3.4].map((z) => (
        <mesh key={z} position={[0, 4.65, z]}>
          <boxGeometry args={[15.1, 0.11, 0.11]} />
          <meshStandardMaterial color="#46677b" metalness={0.76} roughness={0.25} />
        </mesh>
      ))}
      {[-5.5, -1.85, 1.85, 5.5].map((x) => (
        <group key={x} position={[x, 4.18, -0.45]}>
          <mesh>
            <boxGeometry args={[2, 0.055, 0.26]} />
            <meshStandardMaterial color="#e7fcff" emissive="#62dff3" emissiveIntensity={2.8} />
          </mesh>
          <pointLight color="#baf7ff" intensity={7.5} distance={6.5} decay={2} />
        </group>
      ))}
      {[-3.25, 0.15, 3.45].map((z) => (
        <mesh key={z} position={[0, 0.018, z]}>
          <boxGeometry args={[15, 0.018, 0.035]} />
          <meshBasicMaterial color="#1a6175" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function FabricStorageZone() {
  return (
    <group>
      <StorageRack position={[-5.85, 0, 2.25]} colors={["#19b6cd", "#ef6a88", "#a78bfa", "#d8c55b"]} />
      <StorageRack position={[-5.85, 0, 4.18]} colors={["#3fd39f", "#5b8def", "#e68445", "#d8e1e5"]} />
      <mesh castShadow position={[-4.32, 0.13, 3.25]}>
        <boxGeometry args={[1.08, 0.2, 1.08]} />
        <meshStandardMaterial color="#725038" roughness={0.88} />
      </mesh>
      <FabricRoll position={[-4.32, 0.45, 3.25]} color="#22d3ee" radius={0.27} />
    </group>
  );
}

export function CuttingZone() {
  return (
    <group>
      <Table position={[-4.95, 0, -2.45]} size={[3.35, 0.12, 1.4]} top="#526d7e" />
      {[0, 1, 2, 3].map((layer) => (
        <mesh key={layer} castShadow position={[-5.05, 0.82 + layer * 0.025, -2.45]}>
          <boxGeometry args={[2.65 - layer * 0.08, 0.018, 1.02 - layer * 0.05]} />
          <meshStandardMaterial color={["#1fb4c9", "#d45d79", "#7756a8", "#39a878"][layer]} roughness={0.9} />
        </mesh>
      ))}
      <group position={[-4.25, 0.95, -2.25]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.28, 0.3]} />
          <meshPhysicalMaterial color={paleSteel} metalness={0.58} roughness={0.27} clearcoat={0.22} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 0.3, 16]} />
          <meshStandardMaterial color="#dce8ed" metalness={0.72} />
        </mesh>
      </group>
      <Worker position={[-6.55, 0, -1.6]} color="#22d3ee" />
    </group>
  );
}

export function SewingZone() {
  const stations = useMemo(
    () =>
      [
        [-2.65, 0, -0.55], [-0.95, 0, -0.55], [0.75, 0, -0.55],
        [-2.65, 0, 1.0], [-0.95, 0, 1.0], [0.75, 0, 1.0],
      ] as Position[],
    [],
  );
  const spoolColors = ["#22d3ee", "#fb7185", "#fbbf24", "#34d399", "#a78bfa", "#e2e8f0"];
  return (
    <group>
      {stations.map((position, index) => (
        <SewingStation key={index} position={position} rotation={index > 2 ? Math.PI : 0} spool={spoolColors[index]} />
      ))}
      <Worker position={[-1.82, 0, 0.32]} color="#34d399" />
      <Worker position={[-0.05, 0, 1.78]} color="#a78bfa" />
    </group>
  );
}

export function FinishingZone() {
  return (
    <group>
      <Table position={[4.7, 0, -2.6]} size={[2.5, 0.12, 1.12]} top="#617d8c" />
      <mesh castShadow position={[4.55, 1.03, -2.6]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[1.05, 0.16, 0.62]} />
        <meshPhysicalMaterial color={paleSteel} metalness={0.48} roughness={0.3} clearcoat={0.25} />
      </mesh>
      <mesh castShadow position={[4.55, 1.35, -2.6]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.75, 0.13, 0.5]} />
        <meshStandardMaterial color="#94a9b4" metalness={0.5} roughness={0.28} />
      </mesh>
      <mesh position={[5.55, 1.1, -2.88]}>
        <cylinderGeometry args={[0.12, 0.16, 0.52, 18]} />
        <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[5.2, 1.65, -2.6]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.42, 0.025, 8, 24, Math.PI]} />
        <meshStandardMaterial color={steel} metalness={0.72} />
      </mesh>
      <Worker position={[6.15, 0, -1.82]} color="#fbbf24" />
    </group>
  );
}

export function QualityZone() {
  return (
    <group>
      <Table position={[4.65, 0, 2.45]} size={[2.35, 0.12, 1.25]} top="#6d8794" />
      <mesh castShadow position={[4.48, 0.84, 2.45]}>
        <boxGeometry args={[1.62, 0.035, 0.78]} />
        <meshStandardMaterial color="#dfe9e8" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[5.58, 1.35, 2.45]}>
        <boxGeometry args={[0.08, 1.45, 1.55]} />
        <meshStandardMaterial color={metal} metalness={0.56} roughness={0.3} />
      </mesh>
      <mesh position={[5.5, 1.75, 2.45]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.68, 0.025, 8, 28, Math.PI]} />
        <meshStandardMaterial color="#7edff0" emissive="#22d3ee" emissiveIntensity={0.65} />
      </mesh>
      <mesh position={[4.18, 1.25, 1.95]}>
        <boxGeometry args={[0.42, 0.3, 0.04]} />
        <meshStandardMaterial color="#102536" emissive="#1c8ea5" emissiveIntensity={0.35} />
      </mesh>
      <Worker position={[3.25, 0, 3.05]} color="#fb7185" />
    </group>
  );
}

export function PackingZone() {
  return (
    <group>
      <Table position={[0.35, 0, 3.15]} size={[2.75, 0.12, 1.05]} top="#526d7d" />
      <Box position={[-0.52, 1.13, 3.15]} rotation={0.05} scale={0.86} />
      <Box position={[0.42, 1.11, 3.14]} rotation={-0.08} scale={0.78} />
      <mesh receiveShadow position={[1.75, 0.12, 3.5]}>
        <boxGeometry args={[1.5, 0.2, 1.15]} />
        <meshStandardMaterial color="#725038" roughness={0.9} />
      </mesh>
      <Box position={[1.45, 0.62, 3.32]} rotation={0.12} />
      <Box position={[2.02, 0.62, 3.72]} rotation={-0.1} scale={0.82} />
      <Worker position={[-0.95, 0, 4.0]} color="#22d3ee" />
    </group>
  );
}
