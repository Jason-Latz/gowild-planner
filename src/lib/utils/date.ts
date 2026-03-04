import {
  addDays,
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
