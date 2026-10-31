import { describe, expect, it, vi } from 'vitest';
import { startVisit } from '../../src/model/visit';
import { VisitsRepository } from '../../src/storage/visitsRepository';

describe('VisitsRepository', () => {
  it("salva la visita nella cartella dell'anno con data e id nel nome", async () => {
    const drive = {
      ensureFolderPath: vi.fn().mockResolvedValue('year-folder'),
      writeJson: vi.fn().mockResolvedValue('visit-file'),
    };
    const visit = startVisit('2026-10-31T08:00:00+01:00');
    await new VisitsRepository(drive).save(visit);
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'visite', '2026']);
    expect(drive.writeJson).toHaveBeenCalledWith(`2026-10-31_${visit.id}.json`, 'year-folder', visit);
  });

  it('non scrive una visita non valida', async () => {
    const drive = { ensureFolderPath: vi.fn(), writeJson: vi.fn() };
    const invalid = { ...startVisit('2026-10-31T08:00:00+01:00'), id: '' };
    await expect(new VisitsRepository(drive).save(invalid)).rejects.toThrow('visita.id');
    expect(drive.ensureFolderPath).not.toHaveBeenCalled();
  });
});
