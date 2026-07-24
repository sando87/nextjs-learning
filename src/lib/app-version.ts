/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.21",
  releasedAt: "2026-07-24",
  notes: "components/schedule/TimelineCells.tsx, components/schedule/TimelineHeader.tsx 외 2개",
  sourceHash: "83b8a2764ed9",
} as const;
