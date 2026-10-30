import { type Coordinates, parseCoordinates } from './position';
import { formatLocalIsoDateTime } from './time';
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

// Scelta di prodotto concordata con l'utente: modificabile cliente per cliente (es. giardini grandi).
export const DEFAULT_CLIENT_RADIUS_METERS = 150;

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

/** Campi modificabili dal form; le stringhe vuote diventano campi assenti. */
export interface ClientInput {
  name: string;
  address: string;
  notes: string;
  radiusMeters: number;
  location?: Coordinates;
}

export type ClientIdentity = Pick<Client, 'id' | 'createdAt'>;

export function newClientIdentity(now: Date = new Date()): ClientIdentity {
  return { id: crypto.randomUUID(), createdAt: formatLocalIsoDateTime(now) };
}

/** Costruisce e valida un cliente: lancia `ValidationError` se l'input non è valido. */
export function buildClient(input: ClientInput, identity: ClientIdentity): Client {
  const address = input.address.trim();
  const notes = input.notes.trim();
  return parseClient(
    {
      ...identity,
      name: input.name.trim(),
      radiusMeters: input.radiusMeters,
      ...(address && { address }),
      ...(input.location && { location: input.location }),
      ...(notes && { notes }),
    },
    'cliente',
  );
}
