// Indonesian formatting helpers

export function formatRp(amount: number, withSymbol = true): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  // Indonesian uses dot as thousand separator
  const parts = abs.toString().split("");
  let out = "";
  let count = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    out = parts[i] + out;
    count++;
    if (count % 3 === 0 && i !== 0) {
      out = "." + out;
    }
  }
  return withSymbol ? `${sign}Rp${out}` : `${sign}${out}`;
}

const monthsId = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const monthsShortId = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const daysId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const daysShortId = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function formatDateId(date: Date, opts: { long?: boolean; withDay?: boolean } = {}): string {
  const day = date.getDate();
  const month = opts.long ? monthsId[date.getMonth()] : monthsShortId[date.getMonth()];
  const year = date.getFullYear();
  const prefix = opts.withDay ? `${daysShortId[date.getDay()]}, ` : "";
  return `${prefix}${day} ${month} ${year}`;
}

export function formatShortDate(date: Date): string {
  // DD/MM/YYYY
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

export function toIsoDate(date: Date): string {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export type Period = "day" | "week" | "month" | "year";

export function getPeriodRange(period: Period, ref: Date): { start: string; end: string; label: string } {
  const d = new Date(ref);
  if (period === "day") {
    const iso = toIsoDate(d);
    return { start: iso, end: iso, label: formatDateId(d, { long: true, withDay: true }) };
  }
  if (period === "week") {
    // Monday as first day
    const day = d.getDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - diffToMon);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: toIsoDate(start),
      end: toIsoDate(end),
      label: `${start.getDate()} ${monthsShortId[start.getMonth()]} - ${end.getDate()} ${monthsShortId[end.getMonth()]} ${end.getFullYear()}`,
    };
  }
  if (period === "month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      start: toIsoDate(start),
      end: toIsoDate(end),
      label: `${monthsId[d.getMonth()]} ${d.getFullYear()}`,
    };
  }
  // year
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear(), 11, 31);
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: `${d.getFullYear()}`,
  };
}

export function shiftPeriod(period: Period, ref: Date, dir: 1 | -1): Date {
  const d = new Date(ref);
  if (period === "day") d.setDate(d.getDate() + dir);
  else if (period === "week") d.setDate(d.getDate() + dir * 7);
  else if (period === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

export { monthsId, monthsShortId, daysId, daysShortId };
