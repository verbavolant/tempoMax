import type { Client } from '../model/client';
import type { Coordinates } from '../model/position';

// Raggio medio R1 dell'ellissoide GRS80 (Moritz, "Geodetic Reference System 1980", adottato dall'IUGG):
// 6 371 008,7714 m. L'approssimazione sferica sbaglia al massimo ~0,5%, irrilevante per raggi di 100–200 m.
export const EARTH_MEAN_RADIUS_METERS = 6_371_008.7714;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distanza ortodromica con la formula dell'emisenoverso (Haversine). */
export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  // min(1, …) evita NaN da asin per errori di arrotondamento su punti quasi antipodali.
  return 2 * EARTH_MEAN_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export interface NearestClient {
  client: Client;
  distanceMeters: number;
}

/** Il cliente più vicino tra quelli con una posizione salvata, oppure null se nessuno ne ha una. */
export function findNearestClient(position: Coordinates, clients: readonly Client[]): NearestClient | null {
  let nearest: NearestClient | null = null;
  for (const client of clients) {
    if (!client.location) {
      continue;
    }
    const distance = distanceMeters(position, client.location);
    if (!nearest || distance < nearest.distanceMeters) {
      nearest = { client, distanceMeters: distance };
    }
  }
  return nearest;
}
