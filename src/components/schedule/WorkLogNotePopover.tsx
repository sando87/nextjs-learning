"use client";

import { updateWorkLogAction } from "@/app/schedule/actions";
import type { WorkLog } from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type WorkLogNotePopoverProps = {
  projectId: string;
  workLog: WorkLog;
  anchor: { x: number; y: number };
  onClose: () => void;
};

export default function WorkLogNotePopover({
  projectId,
  workLog,
  anchor,
  onClose,
}: WorkLogNotePopoverProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState(workLog.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  async function handleSave() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("workLogId", workLog.id);
    fd.set("startDate", workLog.startedAt.slice(0, 10));
    fd.set("endDate", workLog.endedAt.slice(0, 10));
    fd.set("startHour", workLog.startedAt.slice(11, 13));
    fd.set("endHour", workLog.endedAt.slice(11, 13));
    fd.set("note", note.trim());
    try {
      const result = await updateWorkLogAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed z-50 w-52 -translate-x-1/2 -translate-y-full rounded-md border border-zinc-300 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
      style={{ left: anchor.x, top: anchor.y - 6 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="mb-1 text-[10px] text-zinc-500">메모</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="간단한 메모..."
        autoFocus
        className="w-full resize-none rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-black"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSave();
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-400">Ctrl+Enter 저장</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleSave()}
          className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] disabled:opacity-50 dark:border-zinc-700"
        >
          {pending ? "..." : "저장"}
        </button>
      </div>
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
