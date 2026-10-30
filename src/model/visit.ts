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
  clientId: string;
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
    clientId: expectNonEmptyString(object.clientId, 'visita.clientId'),
    checkIn: parseVisitEvent(object.checkIn, 'visita.checkIn'),
    checkOut: nullable(object.checkOut, (present) => parseVisitEvent(present, 'visita.checkOut')),
    note: expectString(object.note, 'visita.note'),
  };
  if (visit.checkOut && Date.parse(visit.checkOut.at) < Date.parse(visit.checkIn.at)) {
    throw new ValidationError('visita.checkOut.at', 'check-out precedente al check-in');
  }
  return visit;
}
