import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/noto-sans-bengali/400.css";
import "./style.css";

export const metadata: Metadata = {
  title: "SafetyProof AI · Evidence workspace",
  description:
    "Cross-checking factory safety reports against their own evidence.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
