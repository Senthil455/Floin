"use client";
import React, { useEffect, useRef } from "react";

interface RainParticleOverlayProps {
  rainfall: number; // in mm
  enabled?: boolean;
  windAngle?: number; // degrees
}

export default function RainParticleOverlay({
  rainfall,
  enabled = true,
  windAngle = 15,
}: RainParticleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled || rainfall <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle count scaled by rainfall intensity
    const maxDrops = Math.min(600, Math.floor(rainfall * 2.5 + 40));
    const drops: Array<{
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
      thickness: number;
    }> = [];

    const splashes: Array<{
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      opacity: number;
    }> = [];

    const rad = (windAngle * Math.PI) / 180;
    const windX = Math.sin(rad);
    const windY = Math.cos(rad);

    for (let i = 0; i < maxDrops; i++) {
      drops.push({
        x: Math.random() * (width + 200) - 100,
        y: Math.random() * height,
        length: 12 + Math.random() * 16,
        speed: 14 + Math.random() * 12,
        opacity: 0.2 + Math.random() * 0.45,
        thickness: 0.8 + Math.random() * 0.8,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render rain streaks
      ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
      ctx.lineCap = "round";

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        ctx.lineWidth = d.thickness;
        ctx.globalAlpha = d.opacity;

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windX * d.length, d.y + windY * d.length);
        ctx.stroke();

        d.x += windX * d.speed;
        d.y += windY * d.speed;

        // Reset if reached bottom
        if (d.y > height) {
          if (Math.random() < 0.35 && splashes.length < 80) {
            splashes.push({
              x: d.x,
              y: height - Math.random() * 10,
              radius: 1,
              maxRadius: 4 + Math.random() * 6,
              opacity: 0.6,
            });
          }
          d.y = -d.length - Math.random() * 50;
          d.x = Math.random() * (width + 200) - 100;
        }
      }

      // Render ground splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius * 1.6, s.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(186, 230, 253, ${s.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        s.radius += 0.4;
        s.opacity -= 0.04;
        if (s.opacity <= 0 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [rainfall, enabled, windAngle]);

  if (!enabled || rainfall <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
