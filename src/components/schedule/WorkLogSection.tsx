"use client";

import {
  createWorkLogAction,
  deleteWorkLogAction,
} from "@/app/schedule/actions";
import { workLogDurationHours } from "@/lib/schedule/work-log-utils";
import type { WorkLog } from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type WorkLogSectionProps = {
  projectId: string;
  taskId: string;
  workLogs: WorkLog[];
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLogLabel(log: WorkLog): string {
  const start = log.startedAt;
  const end = log.endedAt;
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  const startH = start.slice(11, 16);
  const endH = end.slice(11, 16);
  const hours = workLogDurationHours(start, end);
  const dateLabel =
    startDate === endDate
      ? `${Number(startDate.slice(5, 7))}/${Number(startDate.slice(8, 10))}`
      : `${startDate.slice(5)} → ${endDate.slice(5)}`;
  return `${dateLabel} ${startH}–${endH} (${hours}h)`;
}

export default function WorkLogSection({
  projectId,
  taskId,
  workLogs,
}: WorkLogSectionProps) {
  const router = useRouter();
  const [extraLogs, setExtraLogs] = useState<WorkLog[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(localToday);
  const [endDate, setEndDate] = useState(localToday);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(11);

  const logs = useMemo(() => {
    const known = new Set(workLogs.map((log) => log.id));
    const merged = [
      ...workLogs,
      ...extraLogs.filter((log) => !known.has(log.id)),
    ].filter((log) => !removedIds.includes(log.id));
    return merged.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }, [workLogs, extraLogs, removedIds]);

  const total = logs.reduce(
    (sum, log) => sum + workLogDurationHours(log.startedAt, log.endedAt),
    0,
  );

  async function handleAdd() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    fd.set("startHour", String(startHour));
    fd.set("endHour", String(endHour));
    try {
      const result = await createWorkLogAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setExtraLogs((prev) => [...prev, result.workLog]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했습니다");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(workLogId: string) {
    setPending(true);
    setError(null);
    setRemovedIds((prev) => [...prev, workLogId]);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("workLogId", workLogId);
    try {
      const result = await deleteWorkLogAction(fd);
      if (!result.ok) {
        setRemovedIds((prev) => prev.filter((id) => id !== workLogId));
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setRemovedIds((prev) => prev.filter((id) => id !== workLogId));
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-medium">실제 작업시간</h3>
        <span className="text-xs text-zinc-500">합계 {total}h</span>
      </div>

      {logs.length > 0 ? (
        <ul className="mb-3 max-h-36 space-y-1 overflow-y-auto">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>{formatLogLabel(log)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleDelete(log.id)}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">기록이 없습니다.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span>시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-black"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>시작 시</span>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-black"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-black"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>종료 시</span>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-black"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleAdd()}
          className="col-span-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700"
        >
          {pending ? "처리 중..." : "작업시간 추가"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
