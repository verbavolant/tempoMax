import { describe, expect, it } from 'vitest';
import { highlightedDaysFor } from '../../src/ui/duePicker';
import { describeDue } from '../../src/ui/tasks';

describe('describeDue', () => {
  const today = '2026-11-02';
  it.each([
    [null, 'Senza scadenza', false],
    ['2026-11-01', '⚠️ Scaduto il 01/11', true],
    ['2026-11-02', 'Scade oggi', false],
    ['2026-11-03', 'Scade domani', false],
    ['2026-11-09', 'Scade il 09/11', false],
  ])('%s → %s', (dueDate, text, overdue) => {
    expect(describeDue(dueDate, today)).toEqual({ text, overdue });
  });
});

describe('highlightedDaysFor', () => {
  it('evidenzia la scelta corrispondente alla scadenza attuale, o nessuna', () => {
    expect(highlightedDaysFor('2026-11-02', '2026-11-03')).toBe(1);
    expect(highlightedDaysFor('2026-11-02', '2026-11-09')).toBe(7);
    expect(highlightedDaysFor('2026-11-02', null)).toBeNull();
    expect(highlightedDaysFor('2026-11-02', '2026-11-05')).toBeUndefined();
    expect(highlightedDaysFor('2026-11-02', '2026-10-30')).toBeUndefined();
  });
});
