import { describe, expect, it } from 'vitest';
import { chooseAudioMimeType } from '../../src/audio/recorder';

describe('chooseAudioMimeType', () => {
  it('su Safari (solo MP4) sceglie audio/mp4', () => {
    expect(chooseAudioMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4');
  });

  it('su Chrome (WebM/Opus) sceglie WebM con Opus', () => {
    expect(chooseAudioMimeType((type) => type.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
  });

  it('se nessun formato preferito è supportato lascia scegliere al browser', () => {
    expect(chooseAudioMimeType(() => false)).toBeUndefined();
  });
});
