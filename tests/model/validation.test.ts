import { describe, expect, it } from 'vitest';
import {
  ValidationError,
  expectIsoDate,
  expectIsoDateTime,
  expectNumberInRange,
  expectUniqueIds,
} from '../../src/model/validation';

describe('expectIsoDateTime', () => {
  it.each([
    '2026-10-30T09:15:00+01:00',
    '2026-10-30T09:15:00.123Z',
    '2026-10-30T09:15-02:00',
    // 2028 è bisestile: divisibile per 4 e non per 100.
    '2028-02-29T12:00:00Z',
  ])('accetta %s', (text) => {
    expect(expectIsoDateTime(text, 'campo')).toBe(text);
  });

  it.each([
    ['senza fuso orario', '2026-10-30T09:15:00'],
    ['solo data', '2026-10-30'],
    ['ora inesistente', '2026-10-30T25:00:00Z'],
    ['mese inesistente', '2026-13-01T00:00:00Z'],
    ['30 febbraio', '2026-02-30T10:00:00+01:00'],
    ['29 febbraio in anno non bisestile', '2027-02-29T10:00:00Z'],
    ['31 aprile', '2026-04-31T10:00:00Z'],
  ])('rifiuta %s', (_label, text) => {
    expect(() => expectIsoDateTime(text, 'campo')).toThrow(ValidationError);
  });

  it('rifiuta valori non stringa', () => {
    expect(() => expectIsoDateTime(1793348100000, 'campo')).toThrow('campo: attesa una stringa');
  });
});

describe('expectNumberInRange', () => {
  it('accetta gli estremi', () => {
    expect(expectNumberInRange(-90, 'lat', -90, 90)).toBe(-90);
    expect(expectNumberInRange(90, 'lat', -90, 90)).toBe(90);
  });

  it.each([Number.NaN, Infinity, '45', null])('rifiuta %s', (value) => {
    expect(() => expectNumberInRange(value, 'lat', -90, 90)).toThrow('lat: atteso un numero');
  });

  it('rifiuta valori fuori intervallo', () => {
    expect(() => expectNumberInRange(90.1, 'lat', -90, 90)).toThrow('lat: atteso un numero tra -90 e 90');
  });
});

describe('expectUniqueIds', () => {
  it('segnala il primo duplicato con il suo percorso', () => {
    expect(() => expectUniqueIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }], 'lista')).toThrow(
      'lista[2].id: id duplicato "a"',
    );
  });
});

describe('expectIsoDate', () => {
  it('accetta una data esistente', () => {
    expect(expectIsoDate('2028-02-29', 'data')).toBe('2028-02-29');
  });

  it.each(['2027-02-29', '2026-13-01', '31/10/2026', '2026-10-31T00:00:00Z'])('rifiuta %s', (text) => {
    expect(() => expectIsoDate(text, 'data')).toThrow(ValidationError);
  });
});
