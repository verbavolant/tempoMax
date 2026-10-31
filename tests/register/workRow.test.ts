import { describe, expect, it } from 'vitest';
import { WORK_REGISTER_HEADER, WORK_REGISTER_ID_COLUMN_INDEX, workPeriodToRow } from '../../src/register/workRow';

describe('workPeriodToRow', () => {
  it('periodo chiuso: data, orari, durata in minuti e id', () => {
    expect(workPeriodToRow({ id: 'p-1', start: '2026-10-31T07:30:00+01:00', end: '2026-10-31T12:15:40+01:00' })).toEqual([
      '31/10/2026',
      '07:30',
      '12:15',
      286,
      'p-1',
    ]);
  });

  it('periodo in corso: fine e durata vuote', () => {
    expect(workPeriodToRow({ id: 'p-2', start: '2026-10-31T13:30:00+01:00', end: null })).toEqual([
      '31/10/2026',
      '13:30',
      '',
      '',
      'p-2',
    ]);
  });

  it("l'id è nella colonna dichiarata", () => {
    expect(WORK_REGISTER_HEADER[WORK_REGISTER_ID_COLUMN_INDEX]).toBe('ID periodo');
  });
});
