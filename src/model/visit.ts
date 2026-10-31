import { type MeasuredPosition, parseMeasuredPosition } from './position';
import {
  SCHEMA_VERSION,
  ValidationError,
  expectIsoDateTime,
  expectNonEmptyString,
  expectObject,
  expectSchemaVersion,
  expectString,
  nullable,
} from './validation';

export interface VisitEvent {
  at: string;
  /** null quando il GPS non era disponibile o il permesso è stato negato. */
  position: MeasuredPosition | null;
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
  };
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
