"use client";

import { useState, type CSSProperties } from "react";
import { useWidth } from "@/lib/hooks";
import { Bullet } from "./ui";

/** Tope "redondo" para el eje: 1, 2, 2.5, 5 x 10^n. */
function niceMax(max: number) {
  if (!(max > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * pow) return step * pow;
  }
  return 10 * pow;
}

const tone = (name: string) => `var(--c-${name})`;

/* ------------------------------------------------------------------ */
/* Barras agrupadas: dos series por periodo                            */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  a: number;
  b: number;
}

export function Bars({
  data,
  aLabel,
  bLabel,
  aTone,
  bTone,
  format,
  axisFormat,
  height = 210,
  title,
}: {
  data: BarDatum[];
  aLabel: string;
  bLabel: string;
  aTone: string;
  bTone: string;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  height?: number;
  title: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 4, t: 8, b: 24 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const top = niceMax(Math.max(1, ...data.flatMap((d) => [d.a, d.b])));
  const band = data.length ? w / data.length : 0;
  const bar = Math.max(4, Math.min(24, (band - 14) / 2));
  const y = (v: number) => pad.t + h - (v / top) * h;
  const ticks = [0, 0.5, 1].map((t) => t * top);
  const shape = (x: number, v: number) => {
    const yy = y(v);
    const r = Math.min(4, bar / 2, Math.max(0, pad.t + h - yy));
    return `M${x},${pad.t + h}V${yy + r}q0,${-r} ${r},${-r}h${bar - 2 * r}q${r},0 ${r},${r}V${pad.t + h}Z`;
  };

  return (
    <div>
      <div className="legend mb-2">
        <span>
          <i style={{ "--tone": tone(aTone) } as CSSProperties} />
          {aLabel}
        </span>
        <span>
          <i style={{ "--tone": tone(bTone) } as CSSProperties} />
          {bLabel}
        </span>
      </div>
      <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
        {width > 0 ? (
          <svg height={height} role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="chart-grid" x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} />
                <text className="chart-axis" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
                  {axisFormat(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.l + band * i + band / 2;
              return (
                <g key={d.label + i}>
                  <path d={shape(cx - bar - 1, d.a)} fill={tone(aTone)} opacity={hover == null || hover === i ? 1 : 0.45} />
                  <path d={shape(cx + 1, d.b)} fill={tone(bTone)} opacity={hover == null || hover === i ? 1 : 0.45} />
                  <text className="chart-axis" x={cx} y={height - 6} textAnchor="middle">
                    {d.label}
                  </text>
                  <rect
                    x={pad.l + band * i}
                    y={pad.t}
                    width={band}
                    height={h + pad.b}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: ${aLabel} ${format(d.a)}, ${bLabel} ${format(d.b)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        {hover != null && data[hover] ? (
          <div
            className="chart-tip"
            style={{
              left: Math.min(Math.max(pad.l + band * hover + band / 2, 80), Math.max(80, width - 80)),
              top: y(Math.max(data[hover].a, data[hover].b)),
            }}
          >
            <strong>{data[hover].label}</strong>
            <div>
              {aLabel}: <span className="num">{format(data[hover].a)}</span>
            </div>
            <div>
              {bLabel}: <span className="num">{format(data[hover].b)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Línea: una serie en el tiempo, con meta opcional                    */
/* ------------------------------------------------------------------ */

export interface LineDatum {
  label: string;
  value: number;
  /** Texto extra para la etiqueta emergente. */
  note?: string;
}

export function Line({
  data,
  toneName,
  format,
  axisFormat,
  target,
  targetLabel,
  height = 220,
  title,
  everyLabel = 1,
}: {
  data: LineDatum[];
  toneName: string;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  target?: number;
  targetLabel?: string;
  height?: number;
  title: string;
  /** Muestra una de cada n etiquetas del eje horizontal. */
  everyLabel?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 14, t: 14, b: 24 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const values = data.map((d) => d.value);
  const min = Math.min(0, ...values);
  const top = niceMax(Math.max(1, ...values, target ?? 0));
  const bottom = min < 0 ? -niceMax(-min) : 0;
  const x = (i: number) => pad.l + (data.length > 1 ? (w * i) / (data.length - 1) : w / 2);
  const y = (v: number) => pad.t + h - ((v - bottom) / (top - bottom)) * h;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = data.length
    ? `${path}L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`
    : "";
  const ticks = bottom < 0 ? [bottom, 0, top] : [0, top / 2, top];
  const color = tone(toneName);
  const lastI = data.length - 1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - pad.l) / w;
    setHover(Math.max(0, Math.min(lastI, Math.round(ratio * lastI))));
  };

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && data.length ? (
        <svg height={height} role="img" aria-label={title} onMouseMove={onMove}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} />
              <text className="chart-axis" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {target != null && target <= top ? (
            <g>
              <line x1={pad.l} x2={pad.l + w} y1={y(target)} y2={y(target)} stroke="var(--ink)" strokeWidth={1.5} />
              <text x={pad.l + 4} y={y(target) - 6} fill="var(--ink)" fontSize={12} fontWeight={600}>
                {targetLabel}
              </text>
            </g>
          ) : null}
          <path d={area} fill={color} opacity={0.1} />
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => {
            const show = i % everyLabel === 0 || (i === lastI && lastI % everyLabel >= everyLabel / 2);
            return show ? (
              <text
                key={d.label + i}
                className="chart-axis"
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === lastI ? "end" : "middle"}
              >
                {d.label}
              </text>
            ) : null;
          })}
          {hover != null ? (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="var(--ink-3)" strokeWidth={1} />
          ) : null}
          <circle
            cx={x(hover ?? lastI)}
            cy={y(data[hover ?? lastI].value)}
            r={5}
            fill={color}
            stroke="var(--panel)"
            strokeWidth={2}
          />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover != null && data[hover] ? (
        <div
          className="chart-tip"
          style={{
            left: Math.min(Math.max(x(hover), 80), Math.max(80, width - 80)),
            top: y(data[hover].value),
          }}
        >
          <strong>{data[hover].label}</strong>
          <div className="num">{format(data[hover].value)}</div>
          {data[hover].note ? <div className="faint">{data[hover].note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barra segmentada: un total repartido en partes                      */
/* ------------------------------------------------------------------ */

export interface Part {
  label: string;
  value: number;
  tone?: string;
  hue?: number;
  detail?: string;
}

export function Parts({ parts, title }: { parts: Part[]; title: string }) {
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div
        className="flex h-2 w-full gap-[2px]"
        role="img"
        aria-label={`${title}: ${visible
          .map((p) => `${p.label} ${total ? Math.round((p.value / total) * 100) : 0}%`)
          .join(", ")}`}
      >
        {visible.map((p) => (
          <div
            key={p.label}
            data-tone={p.tone}
            data-hue={p.hue}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(p.value / total) * 100}%`, background: "var(--tone)", minWidth: 3 }}
          />
        ))}
        {!visible.length ? <div className="h-full w-full rounded-full bg-panel2" /> : null}
      </div>
      <ul className="mt-3 grid gap-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[0.875rem]">
            <i
              data-tone={p.tone}
              data-hue={p.hue}
              className="h-2.5 w-2.5 flex-none rounded-[2px]"
              style={{ background: "var(--tone)" }}
            />
            <span className="font-semibold">{p.label}</span>
            <span className="muted">{p.detail}</span>
            <span className="num ml-auto font-semibold">
              {total ? Math.round((Math.max(0, p.value) / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de barras: magnitudes con nombre                              */
/* ------------------------------------------------------------------ */

export interface RankRow {
  id: string;
  label: string;
  value: number;
  text: string;
  sub?: string;
  icon?: string;
  hue?: number;
  tone?: string;
}

export function Rank({ rows }: { rows: RankRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
          <Bullet hue={r.hue} tone={r.tone} icon={r.icon} size="sm" />
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="amount">{r.text}</span>
          </div>
          <div className="col-start-2">
            <div
              data-hue={r.hue}
              data-tone={r.tone}
              className="h-1.5 rounded-r-[3px]"
              style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: "var(--tone)" }}
            />
            {r.sub ? <div className="row-sub mt-1">{r.sub}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
