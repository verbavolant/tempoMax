import { describe, expect, it } from 'vitest';
import { chooseAudioMimeType } from '../../src/audio/recorder';

describe('chooseAudioMimeType', () => {
  it('preferisce AAC in MP4 quando è supportato esplicitamente (Chrome recente)', () => {
    expect(chooseAudioMimeType(() => true)).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('se il codec esplicito non è riconosciuto usa audio/mp4 (Safari: AAC)', () => {
    expect(chooseAudioMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4');
  });

  it('su Chrome (WebM/Opus) sceglie WebM con Opus', () => {
    expect(chooseAudioMimeType((type) => type.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
  });

  it('se nessun formato preferito è supportato lascia scegliere al browser', () => {
    expect(chooseAudioMimeType(() => false)).toBeUndefined();
  });
});
