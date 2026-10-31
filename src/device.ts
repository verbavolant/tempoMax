import { LOCAL_STORAGE_PREFIX } from './config';

// Il nome finisce anche nelle proprietà private dei file audio su Drive (max 124 byte per coppia chiave-valore).
export const MAX_DEVICE_NAME_LENGTH = 40;

const STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}.device`;

/**
 * Proposta iniziale per il nome del dispositivo, ricavata dallo user agent. Il nome vero del telefono
 * ("iPhone di Mario") non è leggibile dal web: lo scrive l'utente nelle Opzioni.
 */
export function guessDeviceName(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'PC Windows';
  return 'Dispositivo';
}

/** Nome ripulito dagli spazi; null se vuoto. Lancia se troppo lungo. */
export function normalizeDeviceName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length > MAX_DEVICE_NAME_LENGTH) {
    throw new Error(`Nome troppo lungo: al massimo ${MAX_DEVICE_NAME_LENGTH} caratteri`);
  }
  return name === '' ? null : name;
}

/** Nome di questo dispositivo, salvato sul telefono (uno per app installata). */
export class DeviceSettings {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {}

  get(): string | null {
    return this.storage.getItem(STORAGE_KEY);
  }

  set(input: string): string | null {
    const name = normalizeDeviceName(input);
    if (name) {
      this.storage.setItem(STORAGE_KEY, name);
    } else {
      this.storage.removeItem(STORAGE_KEY);
    }
    return name;
  }
}
