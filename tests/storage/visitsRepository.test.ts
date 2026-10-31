import { describe, expect, it, vi } from 'vitest';
import { type Visit, startVisit } from '../../src/model/visit';
import { VisitsRepository } from '../../src/storage/visitsRepository';

function fakeDrive(files: Record<string, unknown> = {}) {
  return {
    ensureFolderPath: vi.fn().mockResolvedValue('year-folder'),
    writeJson: vi.fn().mockResolvedValue('visit-file'),
    listFiles: vi.fn().mockResolvedValue(Object.keys(files).map((id) => ({ id, name: `${id}.json` }))),
    readJson: vi.fn(async (id: string) => files[id]),
  };
}

const visitAt = (id: string, at: string): Visit => ({ ...startVisit(at, null), id });

describe('VisitsRepository.save', () => {
  it("salva la visita nella cartella dell'anno con data e id nel nome", async () => {
    const drive = fakeDrive();
    const visit = startVisit('2026-10-31T08:00:00+01:00', null);
    await new VisitsRepository(drive).save(visit);
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'visite', '2026']);
    expect(drive.writeJson).toHaveBeenCalledWith(`2026-10-31_${visit.id}.json`, 'year-folder', visit);
  });

  it('non scrive una visita non valida', async () => {
    const drive = fakeDrive();
    const invalid = { ...startVisit('2026-10-31T08:00:00+01:00', null), id: '' };
    await expect(new VisitsRepository(drive).save(invalid)).rejects.toThrow('visita.id');
    expect(drive.ensureFolderPath).not.toHaveBeenCalled();
  });
});

describe('VisitsRepository.listRecent', () => {
  it("legge le visite dell'anno e le ordina dalla più recente per orario di check-in", async () => {
    const morning = visitAt('a', '2026-10-31T08:00:00+01:00');
    const afternoon = visitAt('b', '2026-10-31T15:00:00+01:00');
    const yesterday = visitAt('c', '2026-10-30T10:00:00+01:00');
    const drive = fakeDrive({ a: morning, b: afternoon, c: yesterday });

    await expect(new VisitsRepository(drive).listRecent('2026', 20)).resolves.toEqual([afternoon, morning, yesterday]);
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'visite', '2026']);
    expect(drive.listFiles).toHaveBeenCalledWith('year-folder', 20);
  });

  it('segnala un file di visita non valido', async () => {
    const drive = fakeDrive({ rotto: { id: 'x' } });
    await expect(new VisitsRepository(drive).listRecent('2026', 20)).rejects.toThrow('visita.schemaVersion');
  });
});
