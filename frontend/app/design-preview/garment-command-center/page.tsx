import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GarmentCommandCenter } from "@/components/design-preview/garment-command-center";

export const metadata: Metadata = {
  title: "Garment Factory Command Center · Design Preview",
  description: "Development-only interactive 3D interface preview for SafetyProof AI.",
  robots: { index: false, follow: false },
};

export default function GarmentCommandCenterPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GarmentCommandCenter />;
}
