import { describe, expect, it } from 'vitest';
import { DeviceSettings, MAX_DEVICE_NAME_LENGTH, guessDeviceName, normalizeDeviceName } from '../src/device';

describe('guessDeviceName', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 'iPhone'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/156.0 Mobile', 'Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'PC Windows'],
    ['curl/8.0', 'Dispositivo'],
  ])('%s → %s', (userAgent, expected) => {
    expect(guessDeviceName(userAgent)).toBe(expected);
  });
});

describe('normalizeDeviceName', () => {
  it('toglie spazi in eccesso e trasforma il vuoto in null', () => {
    expect(normalizeDeviceName('  iPhone   di  Mario ')).toBe('iPhone di Mario');
    expect(normalizeDeviceName('   ')).toBeNull();
  });

  it('rifiuta nomi troppo lunghi', () => {
    expect(() => normalizeDeviceName('x'.repeat(MAX_DEVICE_NAME_LENGTH + 1))).toThrow('al massimo 40 caratteri');
  });

  it('il nome più lungo ammesso sta nei 124 byte delle proprietà Drive anche con lettere accentate', () => {
    expect(new TextEncoder().encode(`device${'è'.repeat(MAX_DEVICE_NAME_LENGTH)}`).length).toBeLessThanOrEqual(124);
  });
});

describe('DeviceSettings', () => {
  function memoryStorage() {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    };
  }

  it('salva, rilegge e cancella il nome', () => {
    const settings = new DeviceSettings(memoryStorage());
    expect(settings.get()).toBeNull();
    expect(settings.set(' iPhone di Mario ')).toBe('iPhone di Mario');
    expect(settings.get()).toBe('iPhone di Mario');
    settings.set('');
    expect(settings.get()).toBeNull();
  });
});
