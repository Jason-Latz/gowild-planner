import {
  addDays,
  isValid,
  format,
  getISOWeek,
  isAfter,
  isBefore,
  parse,
  parseISO,
  startOfDay,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { THURSDAY } from "@/lib/constants";

export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateOnly(value: string): Date {
  return parse(value, "yyyy-MM-dd", new Date());
}

export function isValidDateOnly(value: string) {
  const parsed = parseDateOnly(value);
  return isValid(parsed) && toDateOnly(parsed) === value;
}

export function tomorrowDateOnly(base = new Date()): string {
  return toDateOnly(addDays(startOfDay(base), 1));
}

export function clampDate(date: Date, start: Date, end: Date) {
  if (isBefore(date, start)) {
    return start;
  }
  if (isAfter(date, end)) {
    return end;
  }
  return date;
}

export function getIsoWeekKey(date: Date) {
  const year = format(date, "RRRR");
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${year}-W${week}`;
}

export function isSameDate(a: string, b: string) {
  return toDateOnly(parseISO(a)) === toDateOnly(parseISO(b));
}

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/**
 * Returns the wall-clock face value of an ISO-like timestamp as whole minutes,
 * ignoring any timezone offset or trailing `Z`.
 *
 * fli (Google Flights) returns local wall-clock datetimes WITHOUT a timezone
 * offset, so absolute-instant subtraction across legs is meaningless. Reading
 * only the Y-M-D h:m fields makes this format-agnostic: "2026-04-16T08:25",
 * "2026-04-16T08:25:00", "2026-04-16T08:25:00.000Z" and "...-06:00" all yield
 * the same face value.
 */
export function wallClockEpochMinutes(ts: string): number {
  const match = WALL_CLOCK_PATTERN.exec(ts);
  if (!match) {
    return Number.NaN;
  }
  const [, year, month, day, hour, minute] = match;
  return Math.round(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) / 60_000,
  );
}

/**
 * Wall-clock minutes elapsed from `fromTs` to `toTs`. Correct for layovers,
 * which always occur at a single airport, where both timestamps share the same
 * local timezone. Never use this to span a flight leg across timezones — use
 * the provider's authoritative `durationMinutes` for that.
 */
export function wallClockDiffMinutes(fromTs: string, toTs: string): number {
  return wallClockEpochMinutes(toTs) - wallClockEpochMinutes(fromTs);
}

export function parseTimeOfDay(value: string) {
  const parsed = parse(value, "HH:mm", new Date());
  if (Number.isNaN(parsed.getTime())) {
    return { hour: 8, minute: 0 };
  }
  return { hour: parsed.getHours(), minute: parsed.getMinutes() };
}

export function isWeeklySendWindow(args: {
  now: Date;
  timezone: string;
  sendDay: number;
  sendLocalTime: string;
  allowedWindowMinutes?: number;
}) {
  const { now, timezone, sendDay, sendLocalTime, allowedWindowMinutes = 59 } = args;
  const zonedNow = toZonedTime(now, timezone);

  if (zonedNow.getDay() !== sendDay) {
    return false;
  }

  const { hour, minute } = parseTimeOfDay(sendLocalTime);
  const target = new Date(zonedNow);
  target.setHours(hour, minute, 0, 0);

  const diffMs = zonedNow.getTime() - target.getTime();
  const diffMinutes = diffMs / 60000;

  return diffMinutes >= 0 && diffMinutes <= allowedWindowMinutes;
}

export function getUpcomingWeekendDepartures(base: Date, timezone: string): string[] {
  const zonedBase = toZonedTime(base, timezone);
  const dayOfWeek = zonedBase.getDay();

  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
  const friday = addDays(startOfDay(zonedBase), daysUntilFriday);
  const saturday = addDays(friday, 1);

  return [toDateOnly(friday), toDateOnly(saturday)];
}

export function getDefaultDigestSendDay() {
  return THURSDAY;
}
