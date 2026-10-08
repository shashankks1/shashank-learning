import { useState } from 'react';
import type { ISODate } from '../types';
import { formatDate, formatMinutes, parseISODate, today } from '../lib/dates';

/*
 * Two small, single-hue charts. One series each, so no legend; the card title names it.
 * Both have a per-mark hover/focus tooltip and a visually hidden table for screen readers.
 */

interface HoursPoint {
  weekStart: ISODate;
  minutes: number;
}

export function HoursChart({ series, targetMin: rawMin, targetMax: rawMax }: { series: HoursPoint[]; targetMin: number; targetMax: number }) {
  const [active, setActive] = useState<number | null>(null);
  const targetMin = Math.min(rawMin, rawMax);
  const targetMax = Math.max(rawMin, rawMax);
  const width = 320;
  const height = 132;
  const padTop = 10;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const maxHours = Math.max(targetMax + 1, ...series.map(point => point.minutes / 60));
  const y = (hours: number) => padTop + plotHeight - (hours / maxHours) * plotHeight;
  const slot = width / series.length;
  const barWidth = Math.min(22, slot - 6);

  return (
    <figure className="chart">
      <div className="chart__plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Hours logged per week for the last ${series.length} weeks, against a ${targetMin}–${targetMax} hour target`}>
          {/* target band */}
          <rect x={0} y={y(targetMax)} width={width} height={y(targetMin) - y(targetMax)} className="chart__band" />
          <line x1={0} x2={width} y1={y(0)} y2={y(0)} className="chart__axis" />
          {series.map((point, index) => {
            const hours = point.minutes / 60;
            const x = index * slot + (slot - barWidth) / 2;
            const top = y(hours);
            const barHeight = Math.max(0, y(0) - top);
            const isCurrent = index === series.length - 1;
            return (
              <g key={point.weekStart}>
                {barHeight > 0 && (
                  <path
                    d={roundedTopBar(x, top, barWidth, barHeight, Math.min(4, barHeight))}
                    className={`chart__bar ${isCurrent ? 'is-current' : ''} ${active === index ? 'is-active' : ''}`}
                  />
                )}
                <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" className="chart__tick">
                  {parseISODate(point.weekStart).getDate()}
                </text>
                {/* hit target larger than the mark */}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Week of ${formatDate(point.weekStart)}: ${formatMinutes(point.minutes)}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div className="chart__tooltip" style={{ left: `${((active + 0.5) / series.length) * 100}%` }} role="status">
            <span className="mono-label">Week of {formatDate(series[active].weekStart)}</span>
            <strong>{formatMinutes(series[active].minutes)}</strong>
          </div>
        )}
      </div>
      <figcaption className="chart__caption">
        Weeks starting on the dates shown ({formatDate(series[0].weekStart)} to now). Shaded band: your {targetMin}–{targetMax}h target. Missing it is information, not failure.
      </figcaption>
      <table className="visually-hidden">
        <caption>Hours per week</caption>
        <thead><tr><th>Week of</th><th>Time logged</th></tr></thead>
        <tbody>
          {series.map(point => (
            <tr key={point.weekStart}><td>{formatDate(point.weekStart)}</td><td>{formatMinutes(point.minutes)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function roundedTopBar(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/** Contribution-style grid: columns are weeks (Mon–Sun), darker = more meaningful actions. */
export function ActivityHeatmap({ cells }: { cells: { day: ISODate; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const weeks = Math.ceil(cells.length / 7);
  const size = 11;
  const gap = 2;
  const width = weeks * (size + gap);
  const height = 7 * (size + gap);
  const level = (count: number) => (count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4);
  const todayDate = today();
  const pastCells = cells.filter(cell => cell.day <= todayDate);
  const activeDays = pastCells.filter(cell => cell.count > 0).length;

  return (
    <figure className="chart heatmap">
      <div className="chart__plot heatmap__plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Activity over the last ${weeks} weeks: active on ${activeDays} days`}>
          {cells.map((cell, index) => {
            const column = Math.floor(index / 7);
            const row = index % 7;
            const future = cell.day > todayDate;
            return (
              <rect
                key={cell.day}
                x={column * (size + gap)}
                y={row * (size + gap)}
                width={size}
                height={size}
                rx={2}
                className={`heatmap__cell ${future ? 'is-future' : `level-${level(cell.count)}`} ${active === index ? 'is-active' : ''}`}
                onMouseEnter={() => !future && setActive(index)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        {active !== null && (
          <div
            className="chart__tooltip"
            style={{ left: `${((Math.floor(active / 7) + 0.5) / weeks) * 100}%` }}
            role="status"
          >
            <span className="mono-label">{parseISODate(cells[active].day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <strong>{cells[active].count === 0 ? 'No activity' : `${cells[active].count} action${cells[active].count === 1 ? '' : 's'}`}</strong>
          </div>
        )}
      </div>
      <figcaption className="chart__caption heatmap__legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(step => (
          <span key={step} className={`heatmap__swatch level-${step}`} aria-hidden="true" />
        ))}
        <span>More</span>
        <span className="heatmap__summary">· active on {activeDays} of {pastCells.length} days</span>
      </figcaption>
    </figure>
  );
}
