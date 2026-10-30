import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriveError, fetchDriveUser } from '../../src/storage/drive';
import { ValidationError } from '../../src/model/validation';

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchDriveUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chiama about.get con fields e token Bearer', async () => {
    const fetchMock = stubFetch(200, { user: { displayName: 'Mario Verdi', emailAddress: 'mario@example.com' } });
    await expect(fetchDriveUser('abc')).resolves.toEqual({
      displayName: 'Mario Verdi',
      emailAddress: 'mario@example.com',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName%2CemailAddress)',
      { headers: { Authorization: 'Bearer abc' } },
    );
  });

  it('propaga lo status HTTP in caso di errore', async () => {
    stubFetch(401, { error: { code: 401 } });
    await expect(fetchDriveUser('scaduto')).rejects.toEqual(new DriveError(401, 'Google Drive ha risposto 401'));
  });

  it('rifiuta una risposta senza email', async () => {
    stubFetch(200, { user: { displayName: 'Mario Verdi' } });
    await expect(fetchDriveUser('abc')).rejects.toBeInstanceOf(ValidationError);
  });
});
