/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.10",
  releasedAt: "2026-07-22",
  notes: "app/schedule/[projectId]/settings/page.tsx, app/schedule/actions.ts 외 11개",
  sourceHash: "32b47b2b256d",
} as const;
