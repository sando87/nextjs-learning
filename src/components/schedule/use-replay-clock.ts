"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReplayStepUnit = "hour" | "day" | "week";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export function stepUnitMs(unit: ReplayStepUnit): number {
  switch (unit) {
    case "hour":
      return HOUR_MS;
    case "day":
      return DAY_MS;
    case "week":
      return WEEK_MS;
  }
}

type UseReplayClockOptions = {
  rangeStartMs: number;
  rangeEndMs: number;
  enabled: boolean;
  resetToken?: number;
  initialMs?: number;
  /** 재생 시 초당 이동량 (= 스텝 단위) */
  stepUnit: ReplayStepUnit;
};

export function useReplayClock({
  rangeStartMs,
  rangeEndMs,
  enabled,
  resetToken = 0,
  initialMs,
  stepUnit,
}: UseReplayClockOptions) {
  const span = Math.max(1, rangeEndMs - rangeStartMs);

  const clampMs = useCallback(
    (ms: number) => Math.min(rangeEndMs, Math.max(rangeStartMs, ms)),
    [rangeStartMs, rangeEndMs],
  );

  const toProgress = useCallback(
    (ms: number) => (clampMs(ms) - rangeStartMs) / span,
    [clampMs, rangeStartMs, span],
  );

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(() =>
    toProgress(initialMs != null ? initialMs : rangeEndMs),
  );
  const [seenToken, setSeenToken] = useState(resetToken);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const stepUnitRef = useRef(stepUnit);
  stepUnitRef.current = stepUnit;

  if (resetToken !== seenToken) {
    setSeenToken(resetToken);
    setProgress(toProgress(initialMs != null ? initialMs : rangeEndMs));
    setPlaying(false);
  }

  const playheadMs = rangeStartMs + progress * span;

  useEffect(() => {
    if (!enabled || !playing) {
      lastFrameRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // 초당 stepUnit 만큼 시계 전진 (예: 1시간 단위 → 초당 1시간)
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const dtSec = (now - last) / 1000;
      const deltaMs = stepUnitMs(stepUnitRef.current) * dtSec;
      setProgress((prev) => {
        const nextMs = rangeStartMs + prev * span + deltaMs;
        if (nextMs >= rangeEndMs) {
          setPlaying(false);
          return 1;
        }
        return (nextMs - rangeStartMs) / span;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, playing, rangeStartMs, rangeEndMs, span]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) {
        setProgress((prev) => (prev >= 1 ? 0 : prev));
      }
      return !p;
    });
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const seekMs = useCallback(
    (ms: number) => {
      setPlaying(false);
      setProgress(toProgress(ms));
    },
    [toProgress],
  );

  const stepBy = useCallback(
    (unit: ReplayStepUnit, direction: -1 | 1) => {
      seekMs(playheadMs + direction * stepUnitMs(unit));
    },
    [playheadMs, seekMs],
  );

  return {
    playing,
    playheadMs,
    progress,
    toggle,
    pause,
    seekMs,
    stepBy,
  };
}
