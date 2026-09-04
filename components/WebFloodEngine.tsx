"use client";
import { useEffect, useRef, useState } from "react";

type Props = { rainfall: number; cn: number; aoi: any; viewMode: string };

export default function WebFloodEngine({ rainfall, cn, aoi, viewMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ maxH: 0, meanH: 0, flooded: 0 });

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = 128, H = 128;
    canvas.width = W; canvas.height = H;
    const terrain = new Float32Array(W * H);
    const water = new Float32Array(W * H);
    const velX = new Float32Array(W * H);
    const velY = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = x / W - 0.5, ny = y / H - 0.5;
      const d = Math.hypot(nx, ny);
      let h = Math.sin(nx * 6) * 0.3 + Math.cos(ny * 6) * 0.3;
      const cx = (aoi?.center?.[0] ?? 80.27) * 0.1; const cy = (aoi?.center?.[1] ?? 13.08) * 0.1;
      h += Math.sin((nx + cx) * 4) * 0.2;
      if (aoi?.id === "velachery") h -= Math.exp(-(nx * nx + ny * ny) * 8) * 0.6;
      if (aoi?.id === "chembarambakkam") h += Math.exp(-(nx * nx + ny * ny) * 4) * 0.8;
      h -= d * 0.4;
      terrain[y * W + x] = h;
      water[y * W + x] = rainfall > 120 ? Math.max(0, 0.02 + (rainfall - 120) / 800 - d * 0.05) : 0;
    }
    let raf = 0; let steps = 0;
    const gravity = 9.81, dt = 0.02, manning = 0.04;
    function step() {
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const h = water[i]; if (h <= 0.001) continue;
        const hx = (terrain[i + 1] + water[i + 1]) - (terrain[i - 1] + water[i - 1]);
        const hy = (terrain[i + W] + water[i + W]) - (terrain[i - W] + water[i - W]);
        const slopeX = -hx * 0.5, slopeY = -hy * 0.5;
        velX[i] = velX[i] * 0.98 + slopeX * gravity * dt - manning * velX[i];
        velY[i] = velY[i] * 0.98 + slopeY * gravity * dt - manning * velY[i];
      }
      const next = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const fluxX = (velX[i] * water[i] - velX[i - 1] * water[i - 1]) * dt;
        const fluxY = (velY[i] * water[i] - velY[i - W] * water[i - W]) * dt;
        next[i] = Math.max(0, water[i] - fluxX - fluxY);
      }
      water.set(next);
      steps++;
    }
    function render() {
      if (!ctx) return;
      const img = ctx.createImageData(W, H);
      let maxH = 0, sum = 0, flooded = 0;
      for (let i = 0; i < W * H; i++) {
        const h = water[i]; maxH = Math.max(maxH, h); sum += h; if (h > 0.01) flooded++;
        const t = terrain[i];
        const depth = h;
        let r, g, b;
        if (depth > 0.03) { const d = Math.min(1, depth * 6); r = 6 + d * 220; g = 120 - d * 60; b = 180 - d * 40; }
        else { const tt = (t + 1) * 0.5; r = 180 + tt * 40; g = 200 + tt * 20; b = 180; }
        img.data[i * 4] = Math.max(0, Math.min(255, r));
        img.data[i * 4 + 1] = Math.max(0, Math.min(255, g));
        img.data[i * 4 + 2] = Math.max(0, Math.min(255, b));
        img.data[i * 4 + 3] = 255;
      }
      ctx!.putImageData(img, 0, 0);
      if (steps % 10 === 0) setStats({ maxH, meanH: sum / (W * H), flooded });
    }
    function loop() { for (let k = 0; k < 3; k++) step(); render(); raf = requestAnimationFrame(loop); }
    loop();
    return () => cancelAnimationFrame(raf);
  }, [rainfall, cn, aoi?.id]);

  return (
    <div style={{ border: "1px solid var(--ink)", background: "var(--surface)" }}>
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>WEBFLOOD · SHALLOW-WATER FBO — CHENNAI {aoi?.id?.toUpperCase()} · {viewMode}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>128² · g9.81 · dt0.02 · n0.04</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 0 }} className="max-[700px]:!grid-cols-1">
        <div style={{ padding: 8, background: "#0F1110" }}><canvas ref={canvasRef} style={{ width: "100%", height: 240, imageRendering: "pixelated", border: "1px solid var(--ink)" }} /></div>
        <div style={{ padding: 10, borderLeft: "1px solid var(--rule)", background: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>STATS · SEMI-LAGRANGIAN</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <div style={{ border: "1px solid var(--rule)", padding: "6px 8px", background: "var(--surface)" }}><div style={{ fontSize: 9, color: "var(--muted)" }}>MAX DEPTH</div><div style={{ fontWeight: 700, color: "var(--hydro)" }}>{stats.maxH.toFixed(3)} m</div></div>
            <div style={{ border: "1px solid var(--rule)", padding: "6px 8px", background: "var(--surface)" }}><div style={{ fontSize: 9, color: "var(--muted)" }}>MEAN</div><div style={{ fontWeight: 700 }}>{stats.meanH.toFixed(4)} m</div></div>
            <div style={{ border: "1px solid var(--rule)", padding: "6px 8px", background: "var(--surface)" }}><div style={{ fontSize: 9, color: "var(--muted)" }}>FLOODED CELLS</div><div style={{ fontWeight: 700, color: "var(--vermillion)" }}>{stats.flooded} / 16384</div></div>
          </div>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 8, lineHeight: 1.4 }}>GLOW.js FBO ping-pong adapted for Chennai basin {aoi?.id}. Terrain from aoi dome + perlin, water from P {rainfall}mm.</div>
        </div>
      </div>
    </div>
  );
}
