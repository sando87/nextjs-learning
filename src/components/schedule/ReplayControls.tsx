"use client";

import type { ReplayStepUnit } from "@/components/schedule/use-replay-clock";

type ReplayControlsProps = {
  playing: boolean;
  playheadLabel: string;
  stepUnit: ReplayStepUnit;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onStepUnitChange: (unit: ReplayStepUnit) => void;
};

const STEP_OPTIONS: { value: ReplayStepUnit; label: string }[] = [
  { value: "hour", label: "1시간" },
  { value: "day", label: "1일" },
  { value: "week", label: "1주" },
];

export default function ReplayControls({
  playing,
  playheadLabel,
  stepUnit,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onStepUnitChange,
}: ReplayControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onTogglePlay}
        className="rounded bg-zinc-950 px-3 py-1.5 text-white dark:bg-zinc-50 dark:text-zinc-950"
      >
        {playing ? "일시정지" : "재생"}
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onStepBack}
          className="rounded border border-zinc-300 px-2.5 py-1.5 dark:border-zinc-600"
          title="이전 스텝"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onStepForward}
          className="rounded border border-zinc-300 px-2.5 py-1.5 dark:border-zinc-600"
          title="다음 스텝"
        >
          ›
        </button>
      </div>

      <div className="flex rounded border border-zinc-300 dark:border-zinc-600">
        {STEP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStepUnitChange(opt.value)}
            className={`px-2.5 py-1.5 ${
              stepUnit === opt.value
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <span className="text-xs text-zinc-500">
        재생: 초당 {STEP_OPTIONS.find((o) => o.value === stepUnit)?.label}
      </span>

      <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
        {playheadLabel}
      </span>
    </div>
  );
}
