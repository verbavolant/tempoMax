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
