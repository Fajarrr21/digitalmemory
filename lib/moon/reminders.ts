/**
 * her little moon. — her own reminders. Pure + tested (reminders.test.ts).
 *
 * In-app (the 🔔 center) is the dependable channel: a reminder shows from its
 * time onward that local day until she taps "oke ♡" (or, for a check-in
 * reminder, until she has checked in). WhatsApp is optional and generic —
 * it goes out when the app's dispatch runs (someone opening the app, or the
 * daily cron), so it's "around" the time, never to the minute, and it is
 * skipped once it's more than a few hours stale.
 */

export type ReminderKind = "checkin" | "period" | "insights" | "custom";

export type Reminder = {
  id: string;
  kind: ReminderKind;
  label: string | null;
  at_time: string; // "HH:MM" or "HH:MM:SS"
  enabled: boolean;
  whatsapp: boolean;
  dismissed_on: string | null;
  sent_on: string | null;
};

/** WhatsApp older than this (past its time) is skipped — the in-app one remains. */
export const WHATSAPP_STALE_HOURS = 6;

const hm = (t: string) => t.slice(0, 5);

function minutes(t: string): number {
  const [h, m] = hm(t).split(":").map(Number);
  return h * 60 + m;
}

export function inAppDue(r: Reminder, today: string, nowHM: string, checkedInToday: boolean): boolean {
  if (!r.enabled) return false;
  if (r.dismissed_on === today) return false;
  if (r.kind === "checkin" && checkedInToday) return false;
  return minutes(nowHM) >= minutes(r.at_time);
}

export function whatsappDue(r: Reminder, today: string, nowHM: string, checkedInToday: boolean): boolean {
  if (!r.enabled || !r.whatsapp) return false;
  if (r.sent_on === today) return false;
  if (r.kind === "checkin" && checkedInToday) return false;
  const late = minutes(nowHM) - minutes(r.at_time);
  return late >= 0 && late <= WHATSAPP_STALE_HOURS * 60;
}

/** What the reminder says in the app — her own words for a custom one. */
export function reminderTitle(r: Pick<Reminder, "kind" | "label">): string {
  switch (r.kind) {
    case "checkin":
      return "Sudah sempat menyapa tubuhmu hari ini?";
    case "period":
      return "Pengingat kecil untuk mencatat siklusmu.";
    case "insights":
      return "Mau lihat catatan kecilmu sebentar?";
    case "custom":
      return r.label ?? "Pengingat kecil untukmu.";
  }
}

/**
 * The WhatsApp text is the same for every kind on purpose: a lock screen can
 * be seen by anyone, so it never mentions periods, symptoms, or her own label.
 */
export const MOON_WHATSAPP_TEXT = [
  "Pengingat kecil yang kamu buat untuk dirimu sendiri. ♡",
  "",
  "Buka app kalau kamu sempat.",
  "",
  "— A little place made for you",
].join("\n");

export function validTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
