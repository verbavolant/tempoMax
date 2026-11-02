const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/**
 * Data e ora locali del dispositivo con il loro fuso, es. `2026-10-30T09:15:00+01:00`.
 * Si conserva l'ora "di orologio" del giardiniere: serve per giorno e orari in fattura.
 */
export function formatLocalIsoDateTime(date: Date): string {
  // getTimezoneOffset è positivo a ovest di Greenwich: il segno ISO è l'opposto.
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
  );
}

/** Durata come `H:MM:SS` (le ore possono superare 24). Durate negative valgono zero. */
export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${pad(minutes)}:${pad(totalSeconds % 60)}`;
}

/**
 * Minuti tra due istanti ISO con fuso. Regola provvisoria (decisione dell'utente: "per ora al minuto"):
 * arrotondamento al minuto più vicino. La regola di fatturazione definitiva sostituirà questa funzione (T-012).
 */
export function roundedMinutesBetween(startAt: string, endAt: string): number {
  return Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000);
}

/** Durata come `H:MM` (minuti interi per difetto), per i totali della giornata. Durate negative valgono zero. */
export function formatHoursMinutes(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  return `${Math.floor(totalMinutes / 60)}:${pad(totalMinutes % 60)}`;
}

/**
 * Giorno di calendario `AAAA-MM-GG` spostato di `days` giorni. Aritmetica sul solo calendario (in UTC),
 * quindi indipendente da fuso e ora legale.
 */
export function addDaysToDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const moved = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}
