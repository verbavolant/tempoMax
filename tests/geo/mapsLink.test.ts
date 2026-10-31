import { describe, expect, it } from 'vitest';
import { googleMapsUrl } from '../../src/geo/mapsLink';

describe('googleMapsUrl', () => {
  it("segue il formato dell'esempio ufficiale dei Maps URLs", () => {
    // https://developers.google.com/maps/documentation/urls/get-started
    expect(googleMapsUrl({ latitude: 47.5951518, longitude: -122.3316393 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=47.5951518%2C-122.3316393',
    );
  });

  it('il parametro query decodificato contiene latitudine e longitudine separate da virgola', () => {
    const url = new URL(googleMapsUrl({ latitude: 45.4642, longitude: 9.19 }));
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('45.4642,9.19');
  });
});
