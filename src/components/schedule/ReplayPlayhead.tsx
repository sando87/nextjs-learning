"use client";

type ReplayPlayheadProps = {
  /** scroll 컨테이너 기준 left (px) */
  left: number;
  visible: boolean;
};

/** 시점 표시용 세로선 (클릭 이동은 헤더에서 처리) */
export default function ReplayPlayhead({ left, visible }: ReplayPlayheadProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 -translate-x-1/2 bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]"
      style={{ left }}
      aria-hidden
    >
      <div className="absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
    </div>
  );
}
