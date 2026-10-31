import { describe, expect, it } from 'vitest';
import { audioMimeTypeCandidates, firstThatWorks } from '../../src/audio/recorder';

describe('audioMimeTypeCandidates', () => {
  it('mette AAC in MP4 esplicito per primo quando è dichiarato supportato (Chrome recente)', () => {
    expect(audioMimeTypeCandidates(() => true)).toEqual([
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      undefined,
    ]);
  });

  it('se è dichiarato solo audio/mp4 (Safari) tenta quello e poi il formato del browser', () => {
    expect(audioMimeTypeCandidates((type) => type === 'audio/mp4')).toEqual(['audio/mp4', undefined]);
  });

  it('senza formati preferiti lascia scegliere al browser', () => {
    expect(audioMimeTypeCandidates(() => false)).toEqual([undefined]);
  });
});

describe('firstThatWorks', () => {
  it('passa al candidato successivo se il primo lancia', () => {
    const attempts: (string | undefined)[] = [];
    const result = firstThatWorks(['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', undefined], (mimeType) => {
      attempts.push(mimeType);
      if (mimeType === 'audio/mp4;codecs=mp4a.40.2') {
        throw new DOMException('non permesso', 'NotAllowedError');
      }
      return `registratore ${mimeType}`;
    });
    expect(result).toBe('registratore audio/mp4');
    expect(attempts).toEqual(['audio/mp4;codecs=mp4a.40.2', 'audio/mp4']);
  });

  it("se falliscono tutti rilancia l'ultimo errore", () => {
    expect(() =>
      firstThatWorks(['a', 'b'], (candidate) => {
        throw new Error(`fallito ${candidate}`);
      }),
    ).toThrow('fallito b');
  });
});
