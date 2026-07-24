"use client";

import {
  getPlanBarDragMode,
  type PlanDragMode,
} from "@/components/schedule/use-plan-drag";

type PlanGanttBarProps = {
  left: number;
  width: number;
  title: string;
  isPreview?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  onBarPointerDown?: (
    mode: Exclude<PlanDragMode, "create">,
    clientX: number,
    clientY: number,
  ) => void;
};

export default function PlanGanttBar({
  left,
  width,
  title,
  isPreview,
  interactive = false,
  disabled,
  onBarPointerDown,
}: PlanGanttBarProps) {
  return (
    <div
      className={`absolute top-1 z-[1] h-2 transition-[left,width] duration-300 ease-out ${isPreview ? "opacity-60" : ""}`}
      style={{ left, width: Math.max(width, 3) }}
      title={title}
      onPointerDown={(e) => {
        if (disabled || isPreview || !interactive || !onBarPointerDown) return;
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const mode = getPlanBarDragMode(e.clientX, rect);
        onBarPointerDown(mode, e.clientX, e.clientY);
      }}
    >
      <div
        className={`h-full w-full rounded border border-dashed border-zinc-400 bg-zinc-200/70 dark:border-zinc-500 dark:bg-zinc-700/50 ${
          interactive && !disabled
            ? "cursor-pointer active:cursor-grabbing"
            : ""
        }`}
      />
      {interactive && !disabled && !isPreview ? (
        <>
          <div className="absolute inset-y-0 left-0 w-1.5 cursor-w-resize" />
          <div className="absolute inset-y-0 right-0 w-1.5 cursor-e-resize" />
        </>
      ) : null}
    </div>
  );
}
