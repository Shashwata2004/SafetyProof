"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Factory,
  FileCheck2,
  Focus,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  Menu,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EvidenceDonut, ProgressRing, TrendChart } from "./command-charts";
import {
  demoDisclaimer,
  evidenceCategories,
  factoryZones,
  recentEvidence,
  type ZoneId,
} from "./demo-data";
import { PreviewErrorBoundary } from "./preview-error-boundary";
import styles from "./garment-command-center.module.css";

const GarmentFactoryScene = dynamic(() => import("./garment-factory-scene"), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading} role="status">
      <span className={styles.loadingOrb} />
      <strong>Preparing 3D factory floor</strong>
      <small>Loading generated geometry…</small>
    </div>
  ),
});

const navItems = [
  { label: "Command center", icon: LayoutDashboard, active: true },
  { label: "Factories", icon: Factory },
  { label: "Evidence", icon: FileCheck2 },
  { label: "Reviews", icon: ClipboardCheck },
  { label: "Teams", icon: Users },
];

const categoryTone: Record<string, string> = {
  Supported: styles.toneSupported,
  Unresolved: styles.toneUnresolved,
  Contradictory: styles.toneContradictory,
  "Insufficient Evidence": styles.toneInsufficient,
};

export function GarmentCommandCenter() {
  const [selectedZone, setSelectedZone] = useState<ZoneId>("sewing");
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clock, setClock] = useState("--:--");

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const zoneIndex = Number(event.key) - 1;
      if (Number.isInteger(zoneIndex) && factoryZones[zoneIndex]) {
        setSelectedZone(factoryZones[zoneIndex].id);
        return;
      }
      if (event.key === "Escape" || event.key.toLowerCase() === "r") {
        setResetSignal((value) => value + 1);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const activeZone = useMemo(
    () => factoryZones.find((zone) => zone.id === selectedZone) ?? factoryZones[0],
    [selectedZone],
  );

  return (
    <main className={styles.commandCenter}>
      <aside className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""}`} aria-label="Preview navigation">
        <div className={styles.brandMark} aria-label="SafetyProof AI">
          <ShieldCheck aria-hidden="true" />
          <span>SP</span>
        </div>
        <button type="button" className={styles.closeNav} onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X /></button>
        <nav>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={active ? styles.navActive : ""} title={`${label} — preview only`}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button type="button" title="Settings — preview only"><Settings aria-hidden="true" /><span>Settings</span></button>
          <button type="button" title="Help — preview only"><HelpCircle aria-hidden="true" /><span>Help</span></button>
          <div className={styles.avatar} title="Demo reviewer profile">AR</div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button type="button" className={styles.menuButton} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu /></button>
            <div>
              <span className={styles.eyebrow}>SafetyProof AI</span>
              <h1>Garment Factory Command Center</h1>
            </div>
          </div>
          <div className={styles.topbarMeta}>
            <div className={styles.previewPill}><Sparkles aria-hidden="true" /> Design preview</div>
            <div className={styles.factorySelect} title="Illustrative factory identity">
              <Building2 aria-hidden="true" />
              <span><small>DEMO FACTORY</small>Orion Garments Unit 07</span>
              <ChevronRight aria-hidden="true" />
            </div>
            <div className={styles.localClock}><Clock3 aria-hidden="true" /><span><small>LOCAL TIME</small>{clock}</span></div>
            <button type="button" className={styles.iconButton} title="Demo notifications"><Bell aria-hidden="true" /><span>3</span></button>
          </div>
        </header>

        <div className={styles.demoBanner} role="note">
          <span>DEMO DATA</span>
          <p>{demoDisclaimer}</p>
        </div>

        <div className={styles.dashboardGrid}>
          <section className={`${styles.panel} ${styles.overviewPanel}`} aria-labelledby="overview-title">
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>Illustrative review</span><h2 id="overview-title">Evidence overview</h2></div>
              <span className={styles.demoTag}>DEMO DATA</span>
            </div>
            <div className={styles.overviewContent}>
              <ProgressRing value={72} label="coverage" size={124} />
              <div className={styles.metricGrid}>
                <div><strong>6</strong><span>Review zones</span></div>
                <div><strong>20</strong><span>Evidence items</span></div>
                <div><strong>4</strong><span>Open review flags</span></div>
                <div><strong>11</strong><span>Supported items</span></div>
              </div>
            </div>
            <p className={styles.panelNote}><ShieldCheck aria-hidden="true" /> Coverage reflects demo evidence classification, not facility safety.</p>
          </section>

          <section className={`${styles.panel} ${styles.scenePanel}`} aria-labelledby="scene-title">
            <div className={styles.sceneHeader}>
              <div>
                <span className={styles.kicker}>Interactive facility twin</span>
                <h2 id="scene-title">Factory floor</h2>
              </div>
              <div className={styles.sceneActions}>
                <span className={styles.activeZone} aria-live="polite"><MapPin aria-hidden="true" /> {activeZone.label}</span>
                <button type="button" onClick={() => setResetSignal((value) => value + 1)} title="Reset 3D camera"><Focus aria-hidden="true" /> Reset view</button>
              </div>
            </div>
            <div className={styles.canvasFrame}>
              <PreviewErrorBoundary selectedZone={selectedZone} onSelect={setSelectedZone}>
                <GarmentFactoryScene
                  selectedZone={selectedZone}
                  hoveredZone={hoveredZone}
                  resetSignal={resetSignal}
                  onSelect={setSelectedZone}
                  onHover={setHoveredZone}
                />
              </PreviewErrorBoundary>
              <div className={styles.sceneHint}><RefreshCcw aria-hidden="true" /> Drag to orbit · scroll to zoom · keys 1–6 focus zones · R resets</div>
              <div className={styles.sceneDemoBadge}>GENERATED 3D · DEMO LAYOUT</div>
            </div>
            <div className={styles.zoneSelector} role="group" aria-label="Select a factory zone">
              {factoryZones.map((zone) => (
                <button
                  type="button"
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  className={selectedZone === zone.id ? styles.zoneActive : ""}
                  style={{ "--zone-color": zone.accent } as React.CSSProperties}
                  aria-pressed={selectedZone === zone.id}
                  aria-label={`Focus ${zone.label} in the 3D factory`}
                  title={`${zone.label} · keyboard ${factoryZones.indexOf(zone) + 1}`}
                >
                  <span />{zone.shortLabel}
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.analyticsRail} aria-label="Demo analytics">
            <section className={`${styles.panel} ${styles.compactPanel}`}>
              <div className={styles.panelHeading}>
                <div><span className={styles.kicker}>Classification</span><h2>Evidence verification</h2></div>
                <FileCheck2 aria-hidden="true" />
              </div>
              <div className={styles.verificationList}>
                {evidenceCategories.map((item) => (
                  <div key={item.label}>
                    <span className={categoryTone[item.label]}>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <span className={styles.demoTag}>DEMO DATA</span>
            </section>

            <section className={`${styles.panel} ${styles.compactPanel}`}>
              <div className={styles.panelHeading}>
                <div><span className={styles.kicker}>Distribution</span><h2>Evidence status</h2></div>
                <Gauge aria-hidden="true" />
              </div>
              <EvidenceDonut />
              <span className={styles.demoTag}>DEMO DATA</span>
            </section>

            <section className={`${styles.panel} ${styles.compactPanel}`}>
              <div className={styles.panelHeading}>
                <div><span className={styles.kicker}>Seven-day sample</span><h2>Coverage trend</h2></div>
                <Activity aria-hidden="true" />
              </div>
              <TrendChart />
              <div className={styles.trendSummary}><strong>+30%</strong><span>illustrative change</span><em>DEMO DATA</em></div>
            </section>
          </aside>

          <section className={`${styles.panel} ${styles.glancePanel}`}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>Selected zone</span><h2>{activeZone.label}</h2></div>
              <Boxes aria-hidden="true" />
            </div>
            <div className={styles.glanceStats}>
              <div><small>EVIDENCE</small><strong>{activeZone.evidence}</strong><span>demo items</span></div>
              <div><small>OPEN FLAGS</small><strong>{activeZone.openFlags}</strong><span>for review</span></div>
              <div><small>VIEW</small><strong>3D</strong><span>interactive</span></div>
            </div>
            <p>Use the scene markers or keyboard-accessible zone controls to inspect this illustrative layout.</p>
          </section>

          <section className={`${styles.panel} ${styles.statusPanel}`}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>Review readiness</span><h2>Evidence coverage</h2></div>
              <Search aria-hidden="true" />
            </div>
            <div className={styles.miniRings}>
              <ProgressRing value={72} label="overall" size={88} />
              <ProgressRing value={61} label="photos" size={88} color="#34d399" />
              <ProgressRing value={48} label="records" size={88} color="#a78bfa" />
            </div>
            <span className={styles.demoTag}>DEMO DATA · NOT A COMPLIANCE RESULT</span>
          </section>

          <section className={`${styles.panel} ${styles.activityPanel}`}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>Illustrative activity</span><h2>Recent evidence</h2></div>
              <span className={styles.demoTag}>DEMO DATA</span>
            </div>
            <div className={styles.activityList}>
              {recentEvidence.map((item) => (
                <div key={item.title}>
                  <span className={`${styles.activityIcon} ${categoryTone[item.status]}`}><FileCheck2 aria-hidden="true" /></span>
                  <span className={styles.activityCopy}><strong>{item.title}</strong><small>{item.zone} · sample record</small></span>
                  <span className={categoryTone[item.status]}>{item.status}</span>
                  <time>{item.time}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
        <footer className={styles.previewFooter}>Development-only design preview · No production workflows, accounts, or databases are connected.</footer>
      </section>
    </main>
  );
}
