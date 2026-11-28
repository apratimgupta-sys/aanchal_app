import { useContext, useState } from "react";
import {
  Button,
  Table,
  Td,
  Th,
  leadingHelp,
  useScrollRegion,
} from "../../../ui";
import { Language, useText } from "../../../i18n";
import {
  axis,
  labelIndexes,
  spreadLabels,
  tiles,
  tipLeft,
  tipWidth,
  xAt,
} from "./scale";

export type ChartSeries = { label: string; colour: 1 | 2 };

export function dayLabel(date: string, lang: "en" | "hi"): string {
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

// Class names are written out in full so Tailwind generates them.
const COLOURS = {
  1: { fill: "fill-chart-1", stroke: "stroke-chart-1", swatch: "bg-chart-1" },
  2: { fill: "fill-chart-2", stroke: "stroke-chart-2", swatch: "bg-chart-2" },
} as const;

// Geometry, in viewBox units: the SVG scales through its viewBox, nothing is measured.
const WIDTH = 1170;
const HEIGHT = 240;
const LEFT = 56;
const RIGHT = 1110;
const TOP = 16;
const BOTTOM = 200;
const TIP_PAD = 8;
const TIP_LINE = 16;
const LABEL_GAP = 14;

type Props = {
  kind: "bars" | "lines";
  title: string;
  days: { date: string; values: number[] }[];
  series: ChartSeries[];
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
};

export default function DayChart({
  kind,
  title,
  days,
  series,
  format,
  formatAxis,
}: Props) {
  const t = useText();
  const lang = useContext(Language);
  const scrollRegion = useScrollRegion();
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const axisText = formatAxis ?? format;

  const count = days.length;
  const largest = days.reduce(
    (m, d) => d.values.reduce((a, v) => Math.max(a, v), m),
    0,
  );
  const { max, ticks } = axis(largest);
  const plotHeight = BOTTOM - TOP;
  const yAt = (value: number) => BOTTOM - (value / max) * plotHeight;
  const slot = (RIGHT - LEFT) / Math.max(count, 1);
  // Bars sit in the middle of an equal slot; line points run edge to edge.
  const centre = (i: number) =>
    kind === "bars" ? LEFT + slot * (i + 0.5) : xAt(i, count, LEFT, RIGHT);
  const barWidth = Math.min(40, Math.max(3, slot * 0.6));

  const toggle = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setAsTable((v) => !v)}
    >
      {asTable
        ? t("View as chart", "चार्ट के रूप में देखें")
        : t("View as table", "तालिका के रूप में देखें")}
    </Button>
  );

  const table = (
    <Table role="table" containerProps={scrollRegion(title)}>
      <thead role="rowgroup">
        <tr role="row">
          <Th>{t("Date", "तिथि")}</Th>
          {series.map((s) => (
            <Th key={s.label} className="text-right">
              {s.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {days.map((d) => (
          <tr role="row" key={d.date}>
            <Td label={t("Date", "तिथि")}>{dayLabel(d.date, lang)}</Td>
            {series.map((s, i) => (
              <Td
                key={s.label}
                label={s.label}
                className="text-right font-mono tabular-nums"
              >
                {format(d.values[i] ?? 0)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );

  const barPath = (x: number, value: number) => {
    const h = (value / max) * plotHeight;
    if (!(h > 0)) return `M${x} ${BOTTOM}h${barWidth}z`;
    const r = Math.min(3, barWidth / 2, h);
    const top = BOTTOM - h;
    return `M${x} ${BOTTOM}V${top + r}a${r} ${r} 0 0 1 ${r} ${-r}h${barWidth - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${BOTTOM}z`;
  };

  const tip = active === null ? null : days[active];
  const tipHeight = TIP_PAD * 2 + TIP_LINE * (1 + series.length);
  const tipLines = tip
    ? [
        dayLabel(tip.date, lang),
        ...series.map((s, si) => `${s.label} ${format(tip.values[si] ?? 0)}`),
      ]
    : [];
  const tipW = tipWidth(tipLines);
  const tipX = active === null ? 0 : tipLeft(centre(active), tipW, LEFT, RIGHT);
  const dotYs = series.map((_, si) =>
    count ? yAt(days[count - 1].values[si] ?? 0) : 0,
  );
  const labelYs = spreadLabels(
    dotYs.map((y) => y + 4),
    LABEL_GAP,
    TOP + 4,
    BOTTOM - 2,
  );
  const areas = tiles(
    days.map((_, i) => centre(i)),
    LEFT,
    RIGHT,
  );
  const tipY = TOP + 4;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!asTable && series.length >= 2 ? (
          <div
            data-legend
            className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground ${leadingHelp}`}
          >
            {series.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${COLOURS[s.colour].swatch}`}
                />
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        {toggle}
      </div>
      {asTable ? (
        table
      ) : (
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label={title}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full min-w-[640px]"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={LEFT}
                  x2={RIGHT}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={LEFT - 8}
                  y={yAt(tick) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[11px]"
                >
                  {axisText(tick)}
                </text>
              </g>
            ))}
            {labelIndexes(count).map((i) => (
              <text
                key={days[i].date}
                data-x-label
                x={centre(i)}
                y={BOTTOM + 22}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {dayLabel(days[i].date, lang)}
              </text>
            ))}
            {kind === "bars" &&
              days.map((d, i) => (
                <path
                  key={d.date}
                  data-bar
                  d={barPath(centre(i) - barWidth / 2, d.values[0] ?? 0)}
                  className={COLOURS[series[0]?.colour ?? 1].fill}
                />
              ))}
            {kind === "lines" &&
              series.map((s, si) => {
                const c = COLOURS[s.colour];
                const last = days.length - 1;
                return (
                  <g key={s.label}>
                    <polyline
                      data-line
                      fill="none"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={c.stroke}
                      points={days
                        .map((d, i) => `${centre(i)},${yAt(d.values[si] ?? 0)}`)
                        .join(" ")}
                    />
                    {last >= 0 && (
                      <>
                        <circle
                          cx={centre(last)}
                          cy={yAt(days[last].values[si] ?? 0)}
                          r={4}
                          strokeWidth={2}
                          className={`${c.fill} stroke-card`}
                        />
                        <text
                          data-end-label
                          x={centre(last) + 10}
                          y={labelYs[si]}
                          className="fill-foreground font-mono text-[11px]"
                        >
                          {axisText(days[last].values[si] ?? 0)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            {days.map((d, i) => {
              const { x, width: w } = areas[i];
              return (
                <rect
                  key={d.date}
                  data-day
                  x={x}
                  y={TOP}
                  width={w}
                  height={plotHeight}
                  className="fill-transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(d.date, lang)}: ${series.map((s, si) => `${s.label} ${format(d.values[si] ?? 0)}`).join(", ")}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onBlur={() => setActive(null)}
                />
              );
            })}
            {tip && (
              <g data-chart-tooltip pointerEvents="none">
                <rect
                  x={tipX}
                  y={tipY}
                  width={tipW}
                  height={tipHeight}
                  rx={4}
                  className="fill-card stroke-border"
                />
                <text
                  x={tipX + TIP_PAD}
                  y={tipY + TIP_PAD + 11}
                  className="fill-foreground text-[11px] font-medium"
                >
                  {dayLabel(tip.date, lang)}
                </text>
                {series.map((s, si) => (
                  <text
                    key={s.label}
                    x={tipX + TIP_PAD}
                    y={tipY + TIP_PAD + 11 + TIP_LINE * (si + 1)}
                    className="fill-muted-foreground font-mono text-[11px]"
                  >
                    {`${s.label} ${format(tip.values[si] ?? 0)}`}
                  </text>
                ))}
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
