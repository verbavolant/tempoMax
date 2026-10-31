import { describe, expect, it, vi } from 'vitest';
import type { WorkPeriod } from '../../src/model/work';
import { WorkRepository } from '../../src/storage/workRepository';

const morning: WorkPeriod = { id: 'mattina', start: '2026-10-31T07:30:00+01:00', end: '2026-10-31T12:30:00+01:00' };
const afternoon: WorkPeriod = { id: 'pomeriggio', start: '2026-10-31T13:30:00+01:00', end: null };

function fakeDrive(existing: unknown) {
  return {
    ensureFolderPath: vi.fn().mockResolvedValue('lavoro-2026'),
    findFile: vi.fn().mockResolvedValue(existing ? 'day-file' : null),
    readJson: vi.fn().mockResolvedValue(existing),
    writeJson: vi.fn().mockResolvedValue('day-file'),
  };
}

describe('WorkRepository.save', () => {
  it('crea il file del giorno nella cartella dell’anno', async () => {
    const drive = fakeDrive(null);
    await new WorkRepository(drive).save(morning);
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'lavoro', '2026']);
    expect(drive.writeJson).toHaveBeenCalledWith('2026-10-31.json', 'lavoro-2026', {
      schemaVersion: 1,
      date: '2026-10-31',
      periods: [morning],
    });
  });

  it('aggiunge un periodo al giorno esistente e aggiorna quello con lo stesso id, in ordine di inizio', async () => {
    const drive = fakeDrive({ schemaVersion: 1, date: '2026-10-31', periods: [afternoon, { ...morning, end: null }] });
    await new WorkRepository(drive).save(morning);
    expect(drive.writeJson).toHaveBeenCalledWith('2026-10-31.json', 'lavoro-2026', {
      schemaVersion: 1,
      date: '2026-10-31',
      periods: [morning, afternoon],
    });
  });

  it('segnala un file del giorno corrotto invece di sovrascriverlo', async () => {
    const drive = fakeDrive({ schemaVersion: 1, date: '2026-10-31', periods: [{ id: 'x' }] });
    await expect(new WorkRepository(drive).save(morning)).rejects.toThrow('lavoro.periods[0].start');
    expect(drive.writeJson).not.toHaveBeenCalled();
  });
});
