"use client";
import { useMemo } from "react";

export function calcScsRunoff(P: number, CN: number) {
  const S = 25400 / CN - 254;
  const Ia = 0.2 * S;
  const Q = P <= Ia ? 0 : (P - Ia) ** 2 / (P + 0.8 * S);
  return { S, Ia, Q };
}
export function useHydrology(rainfall: number, cn: number, duration: number) {
  const { S, Ia, Q } = useMemo(() => calcScsRunoff(rainfall, cn), [rainfall, cn]);
  const economicLoss = useMemo(() => {
    const depthVal = Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100));
    const affectedBuildings = Math.round(80 + (Q / 120) * 800);
    const directLossCrores = (affectedBuildings * Math.pow(Math.max(0.1, depthVal), 1.35) * 4.8) / 100;
    const displacedPop = Math.round(affectedBuildings * 4.2 * Math.min(1.0, depthVal / 0.8));
    return { directLossCrores: directLossCrores.toFixed(1), displacedPop: displacedPop.toLocaleString(), affectedBuildings, depthVal: depthVal.toFixed(2) };
  }, [Q, duration]);
  return { S, Ia, Q, economicLoss };
}
