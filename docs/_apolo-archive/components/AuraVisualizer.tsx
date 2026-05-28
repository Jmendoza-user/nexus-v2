/**
 * AuraVisualizer — Canvas con partículas reactivas a voz
 *
 * Soporta estados: idle | listening | thinking | speaking
 * Integra con Web Audio API (AnalyserNode) para animación reactiva a amplitud.
 * Respeta `prefers-reduced-motion`: si activo, muestra gradiente estático.
 *
 * @example
 * ```tsx
 * const analyser = useRef<AnalyserNode | null>(null);
 * <AuraVisualizer
 *   state="listening"
 *   analyser={analyser.current}
 *   size={220}
 * />
 * ```
 */

import React, { useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AuraState = "idle" | "listening" | "thinking" | "speaking";

export interface AuraVisualizerProps {
  state: AuraState;
  /** AnalyserNode de Web Audio API para reactivity. Opcional. */
  analyser?: AnalyserNode | null;
  /** Diámetro del canvas en px. Default: 220 */
  size?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constantes de diseño
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<AuraState, { primary: string; secondary: string; rgb: [number, number, number] }> = {
  idle:      { primary: "#7C5CFF", secondary: "#5B3ECC", rgb: [124, 92, 255] },
  listening: { primary: "#34D399", secondary: "#059669", rgb: [52, 211, 153] },
  thinking:  { primary: "#FBBF24", secondary: "#D97706", rgb: [251, 191, 36] },
  speaking:  { primary: "#3B82F6", secondary: "#2563EB", rgb: [59, 130, 246] },
};

const PARTICLE_COUNT = 80;
const BASE_RADIUS_RATIO = 0.35; // proporción del radio del círculo central sobre size/2

interface Particle {
  angle: number;
  baseRadius: number;
  radius: number;
  speed: number;
  size: number;
  opacity: number;
  phase: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AuraVisualizer({ state, analyser, size = 220, className = "" }: AuraVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const stateRef = useRef(state);
  const prefersReducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  // Inicializar partículas
  const initParticles = useCallback(() => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle:      (i / PARTICLE_COUNT) * Math.PI * 2,
      baseRadius: (size / 2) * BASE_RADIUS_RATIO * (0.85 + Math.random() * 0.3),
      radius:     0,
      speed:      0.003 + Math.random() * 0.004,
      size:       1.5 + Math.random() * 2,
      opacity:    0.3 + Math.random() * 0.5,
      phase:      Math.random() * Math.PI * 2,
    }));
  }, [size]);

  // Loop de animación principal
  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size * dpr;
    const h = size * dpr;
    const cx = w / 2;
    const cy = h / 2;

    // Leer amplitud del análisis de audio (0-255)
    let amplitude = 0;
    if (analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);
      const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + (v - 128) ** 2, 0) / dataArray.length);
      amplitude = Math.min(rms / 50, 1); // normalizar 0-1
    }

    const currentState = stateRef.current;
    const { rgb } = STATE_COLORS[currentState];

    // Amplitud extra por estado
    const stateAmplitude =
      currentState === "listening" ? 0.3 + amplitude * 0.7
      : currentState === "thinking" ? 0.2 + Math.sin(time * 0.003) * 0.15
      : currentState === "speaking" ? 0.4 + amplitude * 0.6
      : 0.1 + Math.sin(time * 0.0015) * 0.05; // idle: respiración suave

    // Limpiar
    ctx.clearRect(0, 0, w, h);

    // Glow central
    const glowGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * BASE_RADIUS_RATIO * 1.8);
    glowGradient.addColorStop(0, `rgba(${rgb.join(",")}, ${0.15 + stateAmplitude * 0.15})`);
    glowGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, w, h);

    // Círculo base
    const baseR = cx * BASE_RADIUS_RATIO;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb.join(",")}, ${0.25 + stateAmplitude * 0.2})`;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Anillo de partículas
    particlesRef.current.forEach((p) => {
      p.angle += p.speed;
      const waveOffset = Math.sin(p.angle * 3 + p.phase + time * 0.002) * stateAmplitude * 30 * dpr;
      const r = baseR + waveOffset;

      const x = cx + Math.cos(p.angle) * r;
      const y = cy + Math.sin(p.angle) * r;
      const alpha = p.opacity * (0.6 + stateAmplitude * 0.4);

      ctx.beginPath();
      ctx.arc(x, y, p.size * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.join(",")}, ${alpha})`;
      ctx.fill();
    });

    animFrameRef.current = requestAnimationFrame(animate);
  }, [size, analyser]);

  // Variante sin movimiento (prefers-reduced-motion)
  const renderStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size * dpr;
    const h = size * dpr;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    const { rgb } = STATE_COLORS[stateRef.current];

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.8);
    gradient.addColorStop(0, `rgba(${rgb.join(",")}, 0.20)`);
    gradient.addColorStop(0.5, `rgba(${rgb.join(",")}, 0.10)`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, cx * BASE_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb.join(",")}, 0.35)`;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
  }, [size]);

  // Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;

    initParticles();

    if (prefersReducedMotion.current) {
      renderStatic();
    } else {
      animFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [size, animate, renderStatic, initParticles]);

  // Reaccionar a cambio de estado
  useEffect(() => {
    stateRef.current = state;
    if (prefersReducedMotion.current) {
      renderStatic();
    }
  }, [state, renderStatic]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className}`}
      aria-label={`Aura del asistente — estado: ${state}`}
      role="img"
    />
  );
}

export default AuraVisualizer;
