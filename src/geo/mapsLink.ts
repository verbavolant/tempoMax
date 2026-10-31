import type { Coordinates } from '../model/position';

/**
 * Link che apre Google Maps con un segnaposto sulle coordinate (azione "search" dei Maps URLs, senza chiave API).
 * Fonte: https://developers.google.com/maps/documentation/urls/get-started — la virgola va codificata come %2C.
 */
export function googleMapsUrl({ latitude, longitude }: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`;
}
