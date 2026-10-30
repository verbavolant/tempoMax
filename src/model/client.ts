import { type Coordinates, parseCoordinates } from './position';
import {
  SCHEMA_VERSION,
  expectArray,
  expectIsoDateTime,
  expectNonEmptyString,
  expectNumberInRange,
  expectObject,
  expectSchemaVersion,
  expectString,
  expectUniqueIds,
  optional,
} from './validation';

export interface Client {
  id: string;
  name: string;
  address?: string;
  /** Assente se il cliente è stato creato senza GPS: il check-in non può verificare la distanza. */
  location?: Coordinates;
  radiusMeters: number;
  notes?: string;
  createdAt: string;
}

/** Contenuto di `clienti.json` su Drive. */
export interface ClientsDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  clients: Client[];
}

export function parseClient(value: unknown, path: string): Client {
  const object = expectObject(value, path);
  const client: Client = {
    id: expectNonEmptyString(object.id, `${path}.id`),
    name: expectNonEmptyString(object.name, `${path}.name`),
    radiusMeters: expectNumberInRange(object.radiusMeters, `${path}.radiusMeters`, 1, Infinity),
    createdAt: expectIsoDateTime(object.createdAt, `${path}.createdAt`),
  };
  const address = optional(object.address, (present) => expectString(present, `${path}.address`));
  const location = optional(object.location, (present) => parseCoordinates(present, `${path}.location`));
  const notes = optional(object.notes, (present) => expectString(present, `${path}.notes`));
  // Le chiavi assenti restano assenti, così il round-trip JSON non aggiunge campi.
  return {
    ...client,
    ...(address !== undefined && { address }),
    ...(location !== undefined && { location }),
    ...(notes !== undefined && { notes }),
  };
}

export function parseClientsDocument(value: unknown): ClientsDocument {
  const object = expectObject(value, 'clienti');
  const schemaVersion = expectSchemaVersion(object.schemaVersion, 'clienti.schemaVersion');
  const clients = expectArray(object.clients, 'clienti.clients').map((item, index) =>
    parseClient(item, `clienti.clients[${index}]`),
  );
  expectUniqueIds(clients, 'clienti.clients');
  return { schemaVersion, clients };
}
