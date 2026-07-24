/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.19",
  releasedAt: "2026-07-24",
  notes: "components/schedule/GanttBar.tsx, components/schedule/ScheduleBoard.tsx 외 5개",
  sourceHash: "b782712e683f",
} as const;
