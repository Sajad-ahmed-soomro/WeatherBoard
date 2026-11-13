import type { Condition, ConditionKind } from '../../lib/api/types';

const CLOUD = 'M15 38h19a8 8 0 0 0 1.2-15.9A11 11 0 0 0 14 21.5 8.3 8.3 0 0 0 15 38Z';
const SMALL_CLOUD = 'M14 32h16a6.5 6.5 0 0 0 1-12.9A9 9 0 0 0 13.6 18 7 7 0 0 0 14 32Z';

function Sun({ cx = 24, cy = 24, r = 8 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const inner = r + 4;
    const outer = r + 8;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * inner}
        y1={cy + Math.sin(a) * inner}
        x2={cx + Math.cos(a) * outer}
        y2={cy + Math.sin(a) * outer}
      />
    );
  });
  return (
    <g className="text-amber-500" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      {rays}
    </g>
  );
}

function Moon({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) {
  return (
    <path
      transform={`translate(${dx} ${dy})`}
      className="text-indigo-300"
      fill="currentColor"
      d="M30 10a14 14 0 1 0 9 24.7A12 12 0 0 1 30 10Z"
    />
  );
}

function Cloud({ d = CLOUD, tone = 'text-slate-400' }: { d?: string; tone?: string }) {
  return <path d={d} className={tone} fill="currentColor" />;
}

function Precip({ kind }: { kind: 'drizzle' | 'rain' | 'snow' }) {
  const xs = [17, 24, 31];
  if (kind === 'snow') {
    return (
      <g className="text-sky-300" fill="currentColor">
        {xs.map((x) => (
          <circle key={x} cx={x} cy={43} r={1.8} />
        ))}
      </g>
    );
  }
  return (
    <g className="text-sky-500" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      {xs.map((x) => (kind === 'rain' ? <line key={x} x1={x} y1={40} x2={x - 2} y2={46} /> : <line key={x} x1={x} y1={42} x2={x - 0.5} y2={44} />))}
    </g>
  );
}

function Glyph({ kind, isDay }: { kind: ConditionKind; isDay: boolean }) {
  switch (kind) {
    case 'clear':
      return isDay ? <Sun /> : <Moon dx={-4} dy={0} />;
    case 'partly-cloudy':
      return (
        <>
          {isDay ? <Sun cx={30} cy={17} r={7} /> : <Moon dx={2} dy={-4} />}
          <Cloud d={SMALL_CLOUD} tone="text-slate-300" />
        </>
      );
    case 'cloudy':
      return <Cloud />;
    case 'fog':
      return (
        <g className="text-slate-400" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="10" y1="18" x2="38" y2="18" />
          <line x1="6" y1="25" x2="34" y2="25" />
          <line x1="12" y1="32" x2="40" y2="32" />
        </g>
      );
    case 'drizzle':
    case 'rain':
    case 'snow':
      return (
        <>
          <Cloud d="M15 34h19a8 8 0 0 0 1.2-15.9A11 11 0 0 0 14 17.5 8.3 8.3 0 0 0 15 34Z" />
          <Precip kind={kind} />
        </>
      );
    case 'thunder':
      return (
        <>
          <Cloud d="M15 34h19a8 8 0 0 0 1.2-15.9A11 11 0 0 0 14 17.5 8.3 8.3 0 0 0 15 34Z" tone="text-slate-500" />
          <path d="M25 30l-6 9h5l-2 7 7-10h-5l3-6Z" className="text-amber-400" fill="currentColor" />
        </>
      );
  }
}

interface WeatherIconProps {
  condition: Condition;
  size?: number;
  className?: string;
}

/** Decorative: the condition is always also given as text next to it. */
export function WeatherIcon({ condition, size = 40, className = '' }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <Glyph kind={condition.kind} isDay={condition.isDay} />
    </svg>
  );
}
