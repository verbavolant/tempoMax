export class ValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ValidationError';
    this.path = path;
  }
}

export type JsonObject = Record<string, unknown>;

export function expectObject(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(path, 'atteso un oggetto');
  }
  return value as JsonObject;
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(path, 'atteso un array');
  }
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(path, 'attesa una stringa');
  }
  return value;
}

export function expectNonEmptyString(value: unknown, path: string): string {
  const text = expectString(value, path);
  if (text.trim() === '') {
    throw new ValidationError(path, 'stringa vuota');
  }
  return text;
}

export function expectNumberInRange(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(path, 'atteso un numero');
  }
  if (value < min || value > max) {
    throw new ValidationError(path, `atteso un numero tra ${min} e ${max}`);
  }
  return value;
}

export function expectLiteral<T extends string | number>(value: unknown, path: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new ValidationError(path, `atteso uno tra ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optional<T>(value: unknown, parse: (value: unknown) => T): T | undefined {
  return value === undefined ? undefined : parse(value);
}

export function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

// Formato "date-time" della ECMAScript Date Time String Format, con fuso obbligatorio:
// senza fuso Date.parse userebbe l'ora locale del dispositivo.
const ISO_DATE_TIME_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function expectIsoDateTime(value: unknown, path: string): string {
  const text = expectString(value, path);
  const match = ISO_DATE_TIME_WITH_OFFSET.exec(text);
  if (!match || Number.isNaN(Date.parse(text))) {
    throw new ValidationError(path, 'attesa una data ISO 8601 con fuso orario');
  }
  // Date.parse accetta giorni inesistenti (es. 30 febbraio) spostandoli al mese dopo.
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    throw new ValidationError(path, 'data inesistente nel calendario');
  }
  return text;
}

export const SCHEMA_VERSION = 1;

export function expectSchemaVersion(value: unknown, path: string): typeof SCHEMA_VERSION {
  return expectLiteral(value, path, [SCHEMA_VERSION]);
}

export function expectUniqueIds(items: readonly { id: string }[], path: string): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      throw new ValidationError(`${path}[${index}].id`, `id duplicato "${item.id}"`);
    }
    seen.add(item.id);
  });
}
