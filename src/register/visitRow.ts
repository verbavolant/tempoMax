import { googleMapsUrl } from '../geo/mapsLink';
import { type Visit, visitDurationMinutes } from '../model/visit';

export const REGISTER_HEADER = [
  'Data',
  'Inizio',
  'Fine',
  'Durata (min)',
  'Cliente',
  'Mappa inizio',
  'Mappa fine',
  'ID visita',
] as const;

export type RegisterRow = [string, string, string, number | '', string, string, string, string];

/** Indice (da 0) della colonna con l'ID: serve per ritrovare la riga di una visita. */
export const REGISTER_ID_COLUMN_INDEX = REGISTER_HEADER.indexOf('ID visita');

// Data e ora si leggono dalla stringa locale (`2026-10-31T09:05:00+01:00`): niente conversioni di fuso.
export const italianDate = (at: string) => `${at.slice(8, 10)}/${at.slice(5, 7)}/${at.slice(0, 4)}`;
export const clockTime = (at: string) => at.slice(11, 16);

export function visitToRow(visit: Visit, clientName: string | null): RegisterRow {
  const { checkIn, checkOut } = visit;
  return [
    italianDate(checkIn.at),
    clockTime(checkIn.at),
    checkOut ? clockTime(checkOut.at) : '',
    visitDurationMinutes(visit) ?? '',
    clientName ?? '',
    checkIn.position ? googleMapsUrl(checkIn.position) : '',
    checkOut?.position ? googleMapsUrl(checkOut.position) : '',
    visit.id,
  ];
}
