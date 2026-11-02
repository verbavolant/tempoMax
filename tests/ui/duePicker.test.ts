import { describe, expect, it } from 'vitest';
import { DEFAULT_DUE_DAYS, DUE_CHOICES, DUE_PICKER_TIMEOUT_SECONDS, dueDateForChoice } from '../../src/ui/duePicker';

describe('scelte della scadenza', () => {
  it('predefinita: domani, con 30 secondi per scegliere (richiesta dell\'utente)', () => {
    expect(DEFAULT_DUE_DAYS).toBe(1);
    expect(DUE_PICKER_TIMEOUT_SECONDS).toBe(30);
    expect(DUE_CHOICES.find((choice) => choice.days === DEFAULT_DUE_DAYS)?.label).toBe('Domani');
  });

  it.each([
    [0, '2026-11-02'],
    [1, '2026-11-03'],
    [2, '2026-11-04'],
    [7, '2026-11-09'],
    [null, null],
  ])('%s giorni da oggi → %s', (days, expected) => {
    expect(dueDateForChoice('2026-11-02', days)).toBe(expected);
  });
});
