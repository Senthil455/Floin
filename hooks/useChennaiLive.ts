"use client";
import { useEffect, useState } from "react";
export type LiveWeather = { precipitation: number; temperature: number; humidity: number; wind: number; daily: number; source: string; updated: string };
export function useChennaiLive(rainfallProp: number) {
  const [live, setLive] = useState<LiveWeather>({ precipitation: rainfallProp, temperature: 31, humidity: 78, wind: 11, daily: rainfallProp, source: "prop", updated: new Date().toISOString() });
  useEffect(() => {
    let id: any;
    async function fetchLive() {
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=13.0827&longitude=80.2707&current=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum&timezone=Asia%2FKolkata");
        const j = await r.json();
        const p = j.current?.precipitation ?? rainfallProp;
        setLive({ precipitation: p, temperature: j.current?.temperature_2m ?? 31, humidity: j.current?.relative_humidity_2m ?? 78, wind: j.current?.wind_speed_10m ?? 11, daily: j.daily?.precipitation_sum?.[0] ?? p, source: "open-meteo", updated: new Date().toISOString() });
      } catch { setLive((s) => ({ ...s, precipitation: rainfallProp, source: "prop-fallback", updated: new Date().toISOString() })); }
    }
    fetchLive(); id = setInterval(fetchLive, 30000);
    return () => clearInterval(id);
  }, [rainfallProp]);
  return live;
}
