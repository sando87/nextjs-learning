/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.18",
  releasedAt: "2026-07-24",
  notes: "components/schedule/use-work-log-drag.ts, lib/schedule/work-log-timeline-utils.ts",
  sourceHash: "3c45c7fda4c3",
} as const;
