import { describe, expect, it, vi } from 'vitest';
import type { Client } from '../../src/model/client';
import { ValidationError } from '../../src/model/validation';
import { ClientsRepository } from '../../src/storage/clientsRepository';

const villa: Client = { id: 'c-1', name: 'Villa Rossi', radiusMeters: 150, createdAt: '2026-10-30T09:00:00+01:00' };

function fakeDrive(existingFileId: string | null, content?: unknown) {
  return {
    ensureFolderPath: vi.fn().mockResolvedValue('root-folder'),
    findFile: vi.fn().mockResolvedValue(existingFileId),
    readJson: vi.fn().mockResolvedValue(content),
    writeJson: vi.fn().mockResolvedValue('clients-file'),
  };
}

describe('ClientsRepository', () => {
  it('senza clienti.json restituisce una lista vuota', async () => {
    const drive = fakeDrive(null);
    await expect(new ClientsRepository(drive).load()).resolves.toEqual([]);
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax']);
    expect(drive.findFile).toHaveBeenCalledWith('clienti.json', 'root-folder');
    expect(drive.readJson).not.toHaveBeenCalled();
  });

  it('legge e valida clienti.json', async () => {
    const drive = fakeDrive('clients-file', { schemaVersion: 1, clients: [villa] });
    await expect(new ClientsRepository(drive).load()).resolves.toEqual([villa]);
    expect(drive.readJson).toHaveBeenCalledWith('clients-file');
  });

  it('segnala un clienti.json non valido invece di ignorarlo', async () => {
    const drive = fakeDrive('clients-file', { schemaVersion: 1, clients: [{ id: 'c-1' }] });
    await expect(new ClientsRepository(drive).load()).rejects.toBeInstanceOf(ValidationError);
  });

  it('salva il documento con la versione dello schema', async () => {
    const drive = fakeDrive(null);
    await new ClientsRepository(drive).save([villa]);
    expect(drive.writeJson).toHaveBeenCalledWith('clienti.json', 'root-folder', { schemaVersion: 1, clients: [villa] });
  });

  it('non scrive su Drive una lista con id duplicati', async () => {
    const drive = fakeDrive(null);
    await expect(new ClientsRepository(drive).save([villa, { ...villa }])).rejects.toBeInstanceOf(ValidationError);
    expect(drive.writeJson).not.toHaveBeenCalled();
  });
});
