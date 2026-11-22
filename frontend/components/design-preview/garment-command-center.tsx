"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
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
import { reviewStatus } from "@/lib/review";
import { EvidenceDonut, ProgressRing, TrendChart } from "./command-charts";
import {
  demoDisclaimer,
  evidenceCategories,
  factoryZones,
  recentEvidence,
  type ZoneId,
} from "./demo-data";
import { PreviewErrorBoundary } from "./preview-error-boundary";
import {
  evidenceStatusCounts,
  groupEvidenceByZone,
  officialEvidenceStatus,
} from "./evidence-intelligence";
import { useEvidenceIntelligence } from "./use-evidence-intelligence";
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
  const intelligence = useEvidenceIntelligence();
  const [selectedZone, setSelectedZone] = useState<ZoneId>("sewing");
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [evidenceScope, setEvidenceScope] = useState<"zone" | "unassigned">("zone");
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
  const groupedEvidence = useMemo(
    () => groupEvidenceByZone(intelligence.results),
    [intelligence.results],
  );
  const statusSummary = useMemo(
    () => evidenceStatusCounts(intelligence.results),
    [intelligence.results],
  );
  const zoneCounts = useMemo(
    () =>
      Object.fromEntries(
        factoryZones.map((zone) => [zone.id, groupedEvidence.byZone[zone.id].length]),
      ) as Record<ZoneId, number>,
    [groupedEvidence],
  );
  const realData = intelligence.realMode;
  const demoMode = intelligence.accountState === "signed-out";
  const evidenceLoading =
    intelligence.accountState === "restoring" ||
    intelligence.accountState === "loading" ||
    intelligence.evidenceState === "loading";
  const selectedEvidence =
    evidenceScope === "unassigned"
      ? groupedEvidence.unassigned
      : groupedEvidence.byZone[selectedZone];
  const openFlags = intelligence.results.filter(
    (result) =>
      result.outcome !== "supported" && reviewStatus(result) === "Pending review",
  ).length;
  const mappedZones = factoryZones.filter((zone) => zoneCounts[zone.id] > 0).length;
  const selectZone = (zone: ZoneId) => {
    setSelectedZone(zone);
    setEvidenceScope("zone");
  };
  const reviewHref = (resultId: string) => {
    if (!intelligence.selectedCaseId || !intelligence.run) return "/";
    const params = new URLSearchParams({
      case: intelligence.selectedCaseId,
      view: "review",
      run: intelligence.run.id,
      item: resultId,
    });
    return `/?${params}`;
  };

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
            <div className={styles.previewPill}>
              <Sparkles aria-hidden="true" />
              {realData ? "Authorized evidence" : demoMode ? "Design preview" : "Connecting data"}
            </div>
            {realData ? (
              <div className={styles.realSelectors} aria-label="Authorized factory and case selection">
                <label>
                  <Building2 aria-hidden="true" />
                  <span>Factory</span>
                  <select
                    value={intelligence.selectedFactory}
                    onChange={(event) => {
                      intelligence.setSelectedFactory(event.target.value);
                      intelligence.setSelectedCaseId("");
                    }}
                    disabled={!intelligence.factories.length}
                  >
                    {intelligence.factories.map((factory) => <option key={factory}>{factory}</option>)}
                  </select>
                </label>
                <label>
                  <ClipboardCheck aria-hidden="true" />
                  <span>Case</span>
                  <select
                    value={intelligence.selectedCaseId}
                    onChange={(event) => intelligence.setSelectedCaseId(event.target.value)}
                    disabled={!intelligence.factoryCases.length}
                  >
                    {intelligence.factoryCases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <div className={styles.factorySelect} title="Illustrative factory identity">
                <Building2 aria-hidden="true" />
                <span><small>DEMO FACTORY</small>Orion Garments Unit 07</span>
                <ChevronRight aria-hidden="true" />
              </div>
            )}
            <div className={styles.localClock}><Clock3 aria-hidden="true" /><span><small>LOCAL TIME</small>{clock}</span></div>
            <button type="button" className={styles.iconButton} title="Demo notifications"><Bell aria-hidden="true" /><span>3</span></button>
          </div>
        </header>

        <div className={`${styles.demoBanner} ${realData ? styles.realBanner : ""}`} role="note">
          <span>{realData ? "AUTHORIZED DATA" : demoMode ? "DEMO DATA" : "DATA STATUS"}</span>
          <p>
            {realData
              ? intelligence.dossier
                ? `${intelligence.dossier.case.title} · Evidence classifications are documentary findings, not a factory safety certification.`
                : intelligence.cases.length
                  ? "Loading the selected authorized case…"
                  : "No authorized cases are available for this account."
              : demoMode
                ? demoDisclaimer
                : intelligence.error || "Restoring the authenticated evidence session…"}
          </p>
        </div>

        <div className={styles.dashboardGrid}>
          <section className={`${styles.panel} ${styles.overviewPanel}`} aria-labelledby="overview-title">
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>Illustrative review</span><h2 id="overview-title">Evidence overview</h2></div>
              <span className={styles.demoTag}>DEMO DATA</span>
            </div>
            <div className={styles.overviewContent}>
              <ProgressRing
                value={realData && intelligence.results.length
                  ? Math.round((statusSummary.classified / intelligence.results.length) * 100)
                  : demoMode ? 72 : undefined}
                label={realData ? "classified" : "coverage"}
                size={124}
              />
              <div className={styles.metricGrid}>
                <div><strong>{realData ? mappedZones : demoMode ? 6 : "—"}</strong><span>{realData ? "Mapped zones" : "Review zones"}</span></div>
                <div><strong>{realData ? intelligence.results.length : demoMode ? 20 : "—"}</strong><span>Evidence items</span></div>
                <div><strong>{realData ? openFlags : demoMode ? 4 : "—"}</strong><span>Open review flags</span></div>
                <div><strong>{realData ? statusSummary.counts.Supported : demoMode ? 12 : "—"}</strong><span>Supported items</span></div>
              </div>
            </div>
            <p className={styles.panelNote}><ShieldCheck aria-hidden="true" /> {realData ? "Classified is the share of results with one of the four supported evidence categories; it is not a safety score." : "Coverage reflects demo evidence classification, not facility safety."}</p>
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
                  zoneCounts={realData ? zoneCounts : undefined}
                  onSelect={selectZone}
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
                  onClick={() => selectZone(zone.id)}
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
              {realData && (
                <button
                  type="button"
                  onClick={() => setEvidenceScope("unassigned")}
                  className={evidenceScope === "unassigned" ? styles.zoneActive : styles.unassignedZone}
                  aria-pressed={evidenceScope === "unassigned"}
                >
                  <AlertTriangle aria-hidden="true" /> Unassigned {groupedEvidence.unassigned.length}
                </button>
              )}
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
                    <div className={styles.verificationBar} aria-hidden="true">
                      <i
                        style={{
                          width: `${(item.value / 20) * 100}%`,
                          background: item.color,
                        }}
                      />
                    </div>
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
            {realData ? (
              <>
                <div className={styles.glanceStats}>
                  <div><small>EVIDENCE</small><strong>{selectedEvidence.length}</strong><span>authorized items</span></div>
                  <div><small>LOCATION</small><strong>{evidenceScope === "unassigned" ? "—" : "Exact"}</strong><span>{evidenceScope === "unassigned" ? "not mapped" : "explicit match"}</span></div>
                  <div><small>RUN</small><strong>{intelligence.run ? "Ready" : "N/A"}</strong><span>{intelligence.run?.status || "no results"}</span></div>
                </div>
                <div className={styles.evidenceCards} aria-live="polite">
                  {evidenceLoading ? (
                    <p className={styles.zoneSummary}>Loading authorized evidence…</p>
                  ) : selectedEvidence.length ? selectedEvidence.slice(0, 5).map((result) => {
                    const status = officialEvidenceStatus(result.outcome);
                    return (
                      <a key={result.id} href={reviewHref(result.id)} className={styles.evidenceCard}>
                        <span className={status ? categoryTone[status] : styles.toneUnavailable}>{status || "Not available"}</span>
                        <b dir="auto">{result.claim.source.quote}</b>
                        <small>{result.claim.source.document} · page {result.claim.source.page}</small>
                        <em>{reviewStatus(result)} · Open source review</em>
                      </a>
                    );
                  }) : (
                    <p className={styles.zoneSummary}>No findings in this snapshot have an explicit {evidenceScope === "unassigned" ? "zone location" : activeZone.label + " location"}.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.glanceStats}>
                  <div><small>EVIDENCE</small><strong>{activeZone.evidence}</strong><span>demo items</span></div>
                  <div><small>OPEN FLAGS</small><strong>{activeZone.openFlags}</strong><span>for review</span></div>
                  <div><small>VIEW</small><strong>3D</strong><span>interactive</span></div>
                </div>
                <p className={styles.zoneSummary}>{activeZone.summary}</p>
                <div className={styles.equipmentList} aria-label={`${activeZone.label} demo equipment`}>
                  {activeZone.equipment.map((item) => <span key={item}>{item}</span>)}
                </div>
              </>
            )}
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
        <footer className={styles.previewFooter}>Design-preview analytics are illustrative and isolated from production verification workflows.</footer>
      </section>
    </main>
  );
}
