/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.8",
  releasedAt: "2026-07-20",
  notes: "app/schedule/actions.ts, components/schedule/ScheduleBoard.tsx 외 7개",
  sourceHash: "6b5ce4dbb4dc",
} as const;
