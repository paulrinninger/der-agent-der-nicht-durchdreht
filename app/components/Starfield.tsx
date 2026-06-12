/**
 * Static SVG starfield, seeded PRNG with a fixed literal seed so server and
 * client render byte-identical markup (no hydration mismatch, no Math.random).
 * Three twinkle groups desync via CSS; the whole layer is compositor-only and
 * vanishes under prefers-reduced-motion. Deliberately not canvas — a rAF loop
 * would compete with SSE-driven renders for main-thread time.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  tw: string;
  accent: boolean;
}

function makeStars(): Star[] {
  const rnd = mulberry32(20260612);
  const stars: Star[] = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.round(rnd() * 10000) / 100,
      y: Math.round(rnd() * 10000) / 100,
      r: Math.round((0.5 + rnd() * 0.6) * 100) / 100,
      o: Math.round((0.12 + rnd() * 0.28) * 100) / 100,
      tw: ["tw-a", "tw-b", "tw-c"][i % 3],
      accent: i % 31 === 0, // 3 ice-cyan accents among the white
    });
  }
  return stars;
}

const STARS = makeStars();

export function Starfield() {
  return (
    <svg
      className="starfield"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {STARS.map((s, i) => (
        <circle
          key={i}
          className={s.tw}
          cx={s.x}
          cy={s.y}
          r={s.r * 0.12}
          fill={s.accent ? "#7dd3fc" : "#ffffff"}
          opacity={s.accent ? 0.25 : s.o}
        />
      ))}
    </svg>
  );
}
