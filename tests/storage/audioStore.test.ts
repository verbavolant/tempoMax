import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { AudioStore } from '../../src/storage/audioStore';

describe('AudioStore', () => {
  it('conserva byte e tipo del file audio', async () => {
    const store = new AudioStore(new IDBFactory());
    await store.put('a-1', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }));
    const audio = await store.get('a-1');
    expect(audio?.type).toBe('audio/mp4');
    expect(new Uint8Array((await audio?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('restituisce null per un id sconosciuto e dopo la cancellazione', async () => {
    const store = new AudioStore(new IDBFactory());
    await expect(store.get('mai-visto')).resolves.toBeNull();
    await store.put('a-1', new Blob(['x'], { type: 'audio/webm' }));
    await store.delete('a-1');
    await expect(store.get('a-1')).resolves.toBeNull();
  });

  it('i dati sopravvivono a una nuova istanza sullo stesso database', async () => {
    const factory = new IDBFactory();
    await new AudioStore(factory).put('a-1', new Blob(['ciao'], { type: 'audio/mp4' }));
    await expect((await new AudioStore(factory).get('a-1'))?.text()).resolves.toBe('ciao');
  });
});
