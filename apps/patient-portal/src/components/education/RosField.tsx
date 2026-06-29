"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient "reactive oxygen species" particle field rendered to a fixed,
 * full-viewport canvas. Drifting motes with soft glow give the whole
 * narrative a living, microscopic-fluid feeling without any 3D dependency.
 *
 * `hue` shifts the palette as the story moves from clinical-cyan into the
 * amber/rose of oxidative damage and back to the emerald of recovery.
 */
export default function RosField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Mote = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
      hue: number;
    };
    let motes: Mote[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(110, (w * h) / 16000));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 2.4 + 0.6,
        a: Math.random() * 0.5 + 0.15,
        hue: 190 + Math.random() * 30,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Hue read from a CSS variable so scroll can re-tint the whole field.
      const hueVar = getComputedStyle(canvas).getPropertyValue("--ros-hue");
      const targetHue = parseFloat(hueVar) || 195;

      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        m.hue += (targetHue - m.hue) * 0.02;

        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        if (m.y < -10) m.y = h + 10;
        if (m.y > h + 10) m.y = -10;

        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6);
        grad.addColorStop(0, `hsla(${m.hue}, 90%, 65%, ${m.a})`);
        grad.addColorStop(1, `hsla(${m.hue}, 90%, 65%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    if (reduce) {
      // Single static frame for reduced-motion users.
      cancelAnimationFrame(raf);
      draw();
    }
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
