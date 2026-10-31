import { type MeasuredPosition, parseMeasuredPosition } from './position';
import {
  SCHEMA_VERSION,
  ValidationError,
  expectArray,
  expectIsoDateTime,
  expectNonEmptyString,
  expectNumberInRange,
  expectObject,
  expectSchemaVersion,
  expectString,
  expectUniqueIds,
  nullable,
} from './validation';

export interface VisitEvent {
  at: string;
  /** null quando il GPS non era disponibile o il permesso è stato negato. */
  position: MeasuredPosition | null;
}

/** Nota vocale registrata durante la visita; il file vive sul telefono finché non è caricato su Drive. */
export interface AudioNote {
  id: string;
  recordedAt: string;
  mimeType: string;
  durationSeconds: number;
  /** null finché il file non è stato caricato su Drive (T-014). */
  driveFileId: string | null;
}

/** Contenuto di un file `visite/AAAA/AAAA-MM-GG_<id>.json` su Drive. */
export interface Visit {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  /** null se il cliente non è stato riconosciuto né indicato (ADR-006). */
  clientId: string | null;
  checkIn: VisitEvent;
  /** null finché la visita è in corso. */
  checkOut: VisitEvent | null;
  note: string;
  audio: AudioNote[];
}

function parseAudioNote(value: unknown, path: string): AudioNote {
  const object = expectObject(value, path);
  return {
    id: expectNonEmptyString(object.id, `${path}.id`),
    recordedAt: expectIsoDateTime(object.recordedAt, `${path}.recordedAt`),
    mimeType: expectNonEmptyString(object.mimeType, `${path}.mimeType`),
    durationSeconds: expectNumberInRange(object.durationSeconds, `${path}.durationSeconds`, 0, Infinity),
    driveFileId: nullable(object.driveFileId, (present) => expectNonEmptyString(present, `${path}.driveFileId`)),
  };
}

function parseVisitEvent(value: unknown, path: string): VisitEvent {
  const object = expectObject(value, path);
  return {
    at: expectIsoDateTime(object.at, `${path}.at`),
    position: nullable(object.position, (present) => parseMeasuredPosition(present, `${path}.position`)),
  };
}

export function parseVisit(value: unknown): Visit {
  const object = expectObject(value, 'visita');
  const visit: Visit = {
    schemaVersion: expectSchemaVersion(object.schemaVersion, 'visita.schemaVersion'),
    id: expectNonEmptyString(object.id, 'visita.id'),
    clientId: nullable(object.clientId, (present) => expectNonEmptyString(present, 'visita.clientId')),
    checkIn: parseVisitEvent(object.checkIn, 'visita.checkIn'),
    checkOut: nullable(object.checkOut, (present) => parseVisitEvent(present, 'visita.checkOut')),
    note: expectString(object.note, 'visita.note'),
    // Campo aggiunto con l'audio (T-013): le visite salvate prima non lo hanno e valgono "nessuna nota".
    audio:
      object.audio === undefined
        ? []
        : expectArray(object.audio, 'visita.audio').map((item, index) => parseAudioNote(item, `visita.audio[${index}]`)),
  };
  expectUniqueIds(visit.audio, 'visita.audio');
  if (visit.checkOut && Date.parse(visit.checkOut.at) < Date.parse(visit.checkIn.at)) {
    throw new ValidationError('visita.checkOut.at', 'check-out precedente al check-in');
  }
  return visit;
}

/** Nuova visita in corso: posizione e cliente si aggiungono dopo, quando il GPS risponde. */
export function startVisit(at: string): Visit {
  return parseVisit({
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    clientId: null,
    checkIn: { at, position: null },
    checkOut: null,
    note: '',
    audio: [],
  });
}

export function endVisit(visit: Visit, at: string): Visit {
  if (visit.checkOut) {
    throw new ValidationError('visita.checkOut', 'visita già chiusa');
  }
  return parseVisit({ ...visit, checkOut: { at, position: null } });
}

/**
 * Cartella dell'anno e nome del file, ricavati dalla data locale del check-in.
 * `checkIn.at` è già in ora locale con fuso (es. `2026-10-30T09:15:00+01:00`): non serve convertirlo.
 */
export function visitStorageLocation(visit: Visit): { year: string; fileName: string } {
  return { year: visit.checkIn.at.slice(0, 4), fileName: `${visit.checkIn.at.slice(0, 10)}_${visit.id}.json` };
}

/**
 * Durata in minuti di una visita chiusa, null se è ancora in corso.
 * Regola provvisoria (decisione dell'utente: "per ora al minuto"): arrotondamento al minuto più vicino.
 * La regola di fatturazione definitiva sostituirà questa funzione (T-012).
 */
export function visitDurationMinutes(visit: Visit): number | null {
  if (!visit.checkOut) {
    return null;
  }
  return Math.round((Date.parse(visit.checkOut.at) - Date.parse(visit.checkIn.at)) / 60_000);
}
