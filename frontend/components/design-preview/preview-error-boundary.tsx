"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box } from "lucide-react";
import { factoryZones, type ZoneId } from "./demo-data";
import styles from "./garment-command-center.module.css";

export class PreviewErrorBoundary extends Component<
  { children: ReactNode; selectedZone: ZoneId; onSelect: (zone: ZoneId) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D design preview unavailable", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={styles.webglFallback} role="status">
        <Box aria-hidden="true" />
        <strong>3D preview is unavailable in this browser.</strong>
        <p>The zone navigator remains available.</p>
        <div className={styles.fallbackZones}>
          {factoryZones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className={zone.id === this.props.selectedZone ? styles.fallbackActive : ""}
              onClick={() => this.props.onSelect(zone.id)}
            >
              {zone.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
}
