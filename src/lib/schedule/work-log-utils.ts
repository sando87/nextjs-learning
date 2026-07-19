/** DB timestamp → 비교/표시용 정규화 (초 단위까지) */
export function normalizeTimestamp(value: string): string {
  const trimmed = value.trim().replace(" ", "T");
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    throw new Error("일시 형식이 올바르지 않습니다");
  }
  const [, date, hh, mm, ss = "00"] = match;
  return `${date}T${hh}:${mm}:${ss}`;
}

export function toHourTimestamp(date: string, hour: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("날짜 형식이 올바르지 않습니다");
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("시작/종료 시는 0–23 사이여야 합니다");
  }
  return `${date}T${String(hour).padStart(2, "0")}:00:00`;
}

export function workLogDurationHours(startedAt: string, endedAt: string): number {
  const start = new Date(normalizeTimestamp(startedAt));
  const end = new Date(normalizeTimestamp(endedAt));
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function assertValidWorkLogRange(startedAt: string, endedAt: string) {
  const start = normalizeTimestamp(startedAt);
  const end = normalizeTimestamp(endedAt);
  if (end <= start) {
    throw new Error("종료 시각은 시작 시각보다 늦어야 합니다");
  }
  const hours = workLogDurationHours(start, end);
  if (!Number.isInteger(hours) || hours < 1) {
    throw new Error("작업시간은 1시간 단위로 입력하세요");
  }
  return { start, end };
}
