/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.15",
  releasedAt: "2026-07-24",
  notes: "components/schedule/ScheduleBoard.tsx, components/schedule/ScheduleToolbar.tsx 외 8개",
  sourceHash: "a6da9a9ec0c7",
} as const;
