import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeolocationError, readCurrentPosition } from '../../src/geo/currentPosition';

type GetCurrentPosition = Geolocation['getCurrentPosition'];

function stubGeolocation(implementation: GetCurrentPosition) {
  const getCurrentPosition = vi.fn(implementation);
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

describe('readCurrentPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restituisce coordinate e precisione, chiedendo alta precisione con timeout', async () => {
    const getCurrentPosition = stubGeolocation((success) =>
      success({ coords: { latitude: 45.46, longitude: 9.19, accuracy: 12 } } as GeolocationPosition),
    );
    await expect(readCurrentPosition()).resolves.toEqual({ latitude: 45.46, longitude: 9.19, accuracyMeters: 12 });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 });
  });

  it.each([
    [1, 'permission_denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('traduce il codice di errore %i in %s', async (code, reason) => {
    stubGeolocation((_success, error) => error?.({ code, message: 'msg' } as GeolocationPositionError));
    const result = readCurrentPosition();
    await expect(result).rejects.toBeInstanceOf(GeolocationError);
    await expect(result).rejects.toMatchObject({ reason });
  });

  it('segnala un browser senza geolocalizzazione', async () => {
    vi.stubGlobal('navigator', {});
    await expect(readCurrentPosition()).rejects.toMatchObject({ reason: 'unsupported' });
  });
});
