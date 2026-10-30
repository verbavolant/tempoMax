import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatLocalIsoDateTime } from '../../src/model/time';
import { expectIsoDateTime } from '../../src/model/validation';

describe('formatLocalIsoDateTime', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('in UTC scrive offset +00:00', () => {
    vi.stubEnv('TZ', 'UTC');
    expect(formatLocalIsoDateTime(new Date(Date.UTC(2026, 9, 30, 8, 5, 9)))).toBe('2026-10-30T08:05:09+00:00');
  });

  it.each(['Europe/Rome', 'America/New_York', 'Asia/Kolkata', 'Pacific/Chatham'])(
    'in %s rappresenta lo stesso istante, in estate e in inverno',
    (timeZone) => {
      vi.stubEnv('TZ', timeZone);
      for (const instant of [Date.UTC(2026, 6, 1, 10, 30, 15), Date.UTC(2026, 11, 31, 23, 59, 59)]) {
        const formatted = formatLocalIsoDateTime(new Date(instant));
        expect(expectIsoDateTime(formatted, 'ora')).toBe(formatted);
        expect(Date.parse(formatted)).toBe(instant);
      }
    },
  );

  it("scarta i millisecondi", () => {
    vi.stubEnv('TZ', 'UTC');
    expect(formatLocalIsoDateTime(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 678)))).toBe('2026-01-02T03:04:05+00:00');
  });
});
