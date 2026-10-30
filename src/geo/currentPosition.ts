import type { MeasuredPosition } from '../model/position';

// Scelte di prodotto: in giardino il GPS può metterci un po' ad agganciarsi, ma oltre 20 s
// conviene lasciar proseguire il check-in senza posizione. Una lettura di 30 s fa è ancora buona.
const POSITION_TIMEOUT_MS = 20_000;
const POSITION_MAX_AGE_MS = 30_000;

export type GeolocationErrorReason = 'unsupported' | 'permission_denied' | 'unavailable' | 'timeout';

export class GeolocationError extends Error {
  readonly reason: GeolocationErrorReason;

  constructor(reason: GeolocationErrorReason, message: string) {
    super(message);
    this.name = 'GeolocationError';
    this.reason = reason;
  }
}

// Codici di GeolocationPositionError.code (MDN): 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
const ERRORS_BY_CODE: Record<number, [GeolocationErrorReason, string]> = {
  1: ['permission_denied', 'Permesso di posizione negato: abilitalo nelle impostazioni del browser'],
  2: ['unavailable', "Posizione non disponibile: prova all'aperto o riattiva il GPS"],
  3: ['timeout', 'Il GPS non ha risposto in tempo'],
};

/** Posizione attuale con precisione (metri, confidenza 95%). Richiede HTTPS o localhost. */
export function readCurrentPosition(): Promise<MeasuredPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationError('unsupported', 'Questo browser non supporta la geolocalizzazione'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy }),
      (error) => {
        const [reason, message] = ERRORS_BY_CODE[error.code] ?? ['unavailable', error.message];
        reject(new GeolocationError(reason, message));
      },
      { enableHighAccuracy: true, timeout: POSITION_TIMEOUT_MS, maximumAge: POSITION_MAX_AGE_MS },
    );
  });
}
