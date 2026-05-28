// ============================================================
// NEXUS — Aura Visualizer
// Circular canvas with reactive particles. 4 states:
// idle · listening · thinking · speaking
// Port verbatim de app/aura.jsx (algoritmo visual idéntico).
// ============================================================
import { useRef, useEffect } from 'react';

interface AuraVisualizerProps {
  state?: 'idle' | 'listening' | 'thinking' | 'speaking' | string;
  size?: number;
  accent?: string;
}

function AuraVisualizer({ state = 'idle', size = 230, accent = '#7C5CFF' }: AuraVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const ampRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const COLORS: Record<string, string> = {
    idle: accent,
    listening: '#34D399',
    thinking: '#FBBF24',
    speaking: '#3B82F6',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = size;
    canvas.width = S * dpr; canvas.height = S * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const cx = S / 2, cy = S / 2;
    const baseR = S * 0.30;

    // particles
    const N = 64;
    const parts = Array.from({ length: N }, (_, i) => ({
      a: (i / N) * Math.PI * 2,
      r: baseR + Math.random() * 6,
      sp: 0.2 + Math.random() * 0.8,
      sz: 1 + Math.random() * 2,
      ph: Math.random() * Math.PI * 2,
    }));

    function hexToRgb(h: string) {
      const m = h.replace('#', '');
      return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
    }

    function draw() {
      const st = stateRef.current;
      const color = COLORS[st] || accent;
      const [r, g, b] = hexToRgb(color);
      tRef.current += reduce ? 0 : 0.016;
      const t = tRef.current;

      // target amplitude by state
      let target = 0.12;
      if (st === 'listening') target = 0.55 + Math.sin(t * 7) * 0.25 + Math.random() * 0.18;
      else if (st === 'speaking') target = 0.42 + Math.sin(t * 11) * 0.3 + Math.sin(t * 4) * 0.15;
      else if (st === 'thinking') target = 0.28 + Math.sin(t * 2) * 0.08;
      else target = 0.14 + Math.sin(t * 1.4) * 0.05;
      ampRef.current += (target - ampRef.current) * 0.12;
      const amp = ampRef.current;

      ctx.clearRect(0, 0, S, S);

      // outer glow
      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 2.0);
      glow.addColorStop(0, `rgba(${r},${g},${b},${0.30 + amp * 0.25})`);
      glow.addColorStop(0.5, `rgba(${r},${g},${b},0.08)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);

      // radial bars
      const BARS = 72;
      for (let i = 0; i < BARS; i++) {
        const a = (i / BARS) * Math.PI * 2 + (st === 'thinking' ? t * 0.9 : t * 0.15);
        const wob = Math.sin(i * 0.5 + t * (st === 'speaking' ? 9 : 4)) * 0.5 + 0.5;
        const len = baseR * (0.18 + amp * (0.5 + wob * 0.8));
        const r1 = baseR * 0.92;
        const r2 = r1 + len;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + wob * 0.4})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // core orb gradient
      const orbR = baseR * (0.82 + amp * 0.12);
      const orb = ctx.createRadialGradient(cx - orbR * 0.3, cy - orbR * 0.3, orbR * 0.1, cx, cy, orbR);
      orb.addColorStop(0, `rgba(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)},0.95)`);
      orb.addColorStop(0.6, `rgba(${r},${g},${b},0.7)`);
      orb.addColorStop(1, `rgba(${r},${g},${b},0.12)`);
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fillStyle = orb;
      ctx.fill();

      // inner ring stroke
      ctx.beginPath();
      ctx.arc(cx, cy, orbR * 0.78, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.10 + amp * 0.12})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // floating particles
      parts.forEach(p => {
        if (!reduce) p.a += p.sp * 0.004 * (st === 'thinking' ? 3 : 1);
        const pr = p.r + Math.sin(t * p.sp * 2 + p.ph) * (4 + amp * 22);
        const px = cx + Math.cos(p.a) * pr;
        const py = cy + Math.sin(p.a) * pr;
        ctx.beginPath();
        ctx.arc(px, py, p.sz * (0.6 + amp), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + amp * 0.4})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, accent]);

  return (
    <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} aria-hidden="true" />
  );
}

export { AuraVisualizer };
