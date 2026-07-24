"use client";

import {
  patchBoardPreferences,
  loadBoardPreferences,
} from "@/components/schedule/schedule-board-state";
import { useEffect, useState } from "react";

type RelativeDateSettingProps = {
  projectId: string;
  projectStartDate: string;
};

/**
 * 보드 헤더 날짜를 프로젝트 시작일 기준 상대표기(0Day 등)로 바꿀지.
 * localStorage 보드 설정 — DB 프로젝트 설정과 별개.
 */
export default function RelativeDateSetting({
  projectId,
  projectStartDate,
}: RelativeDateSettingProps) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefs = loadBoardPreferences(projectId);
    setEnabled(prefs.useRelativeDates ?? false);
    setReady(true);
  }, [projectId]);

  function handleChange(next: boolean) {
    setEnabled(next);
    patchBoardPreferences(projectId, { useRelativeDates: next });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">타임라인 표시</h2>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          disabled={!ready}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <span>
          <span className="font-medium">상대날짜 표기</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            헤더를 프로젝트 시작일({projectStartDate}) 기준으로 표시합니다.
            예: 0Day, 1Week, -1Month. 끄면 절대날짜(7/24, 2026-07)입니다.
          </span>
        </span>
      </label>
    </section>
  );
}
