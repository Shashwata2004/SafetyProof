"use client";

import { evidenceCategories, reviewTrend } from "./demo-data";
import styles from "./garment-command-center.module.css";

export function ProgressRing({
  value,
  label,
  size = 112,
  color = "#22d3ee",
}: {
  value: number;
  label: string;
  size?: number;
  color?: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className={styles.ringWrap} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${value}% demo data`}>
        <circle className={styles.ringTrack} cx="50" cy="50" r={radius} />
        <circle
          className={styles.ringValue}
          cx="50"
          cy="50"
          r={radius}
          style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className={styles.ringText}>
        <strong>{value}%</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

export function EvidenceDonut() {
  const total = evidenceCategories.reduce((sum, item) => sum + item.value, 0);
  let accumulated = 0;

  return (
    <div className={styles.donutLayout}>
      <svg className={styles.donut} viewBox="0 0 100 100" role="img" aria-label="Demo evidence category distribution">
        <circle className={styles.donutTrack} cx="50" cy="50" r="36" />
        {evidenceCategories.map((item) => {
          const length = (item.value / total) * 100;
          const offset = -accumulated;
          accumulated += length;
          return (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke={item.color}
              strokeWidth="13"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={offset}
              className={styles.donutSegment}
            >
              <title>{`${item.label}: ${item.value} demo items`}</title>
            </circle>
          );
        })}
        <text x="50" y="47" textAnchor="middle" className={styles.donutNumber}>{total}</text>
        <text x="50" y="60" textAnchor="middle" className={styles.donutLabel}>items</text>
      </svg>
      <div className={styles.legend}>
        {evidenceCategories.map((item) => (
          <div key={item.label} className={styles.legendRow} title={`${item.value} demo evidence items`}>
            <span className={styles.legendDot} style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart() {
  const width = 300;
  const height = 94;
  const min = 35;
  const max = 80;
  const points = reviewTrend
    .map((value, index) => {
      const x = 8 + (index / (reviewTrend.length - 1)) * (width - 16);
      const y = height - 8 - ((value - min) / (max - min)) * (height - 20);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={styles.trendWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Demo review coverage trend from 42 to 72 percent">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="8" x2="292" y1="76" y2="76" className={styles.chartGrid} />
        <line x1="8" x2="292" y1="44" y2="44" className={styles.chartGrid} />
        <polygon points={`8,86 ${points} 292,86`} fill="url(#trend-fill)" />
        <polyline points={points} className={styles.trendLine} />
        {reviewTrend.map((value, index) => {
          const [x, y] = points.split(" ")[index].split(",");
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3" className={styles.trendPoint}><title>{`Day ${index + 1}: ${value}% demo coverage`}</title></circle>;
        })}
      </svg>
      <div className={styles.chartAxis}><span>MON</span><span>WED</span><span>FRI</span><span>SUN</span></div>
    </div>
  );
}
