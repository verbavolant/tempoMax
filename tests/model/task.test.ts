import { describe, expect, it } from 'vitest';
import { type Task, compareOpenTasks, createVoiceTask, parseTasksDocument } from '../../src/model/task';
import type { AudioNote } from '../../src/model/visit';

const audio: AudioNote = {
  id: 'a-1',
  recordedAt: '2026-11-02T09:10:00+01:00',
  mimeType: 'audio/mp4',
  durationSeconds: 6,
  driveFileId: null,
  driveLink: null,
  device: null,
  position: null,
};

const task = (id: string, dueDate: string | null, createdAt = '2026-11-02T09:10:00+01:00'): Task => ({
  id,
  kind: 'todo',
  createdAt,
  dueDate,
  completedAt: null,
  text: '',
  audio,
  visitId: null,
  clientId: null,
  device: null,
});

describe('createVoiceTask', () => {
  it('crea un "da fare" vocale aperto, con id nuovo', () => {
    const created = createVoiceTask({
      audio,
      createdAt: '2026-11-02T09:10:00+01:00',
      dueDate: '2026-11-03',
      visitId: 'v-1',
      clientId: 'c-1',
      device: 'iPhone',
    });
    expect(created).toMatchObject({ kind: 'todo', text: '', completedAt: null, dueDate: '2026-11-03', visitId: 'v-1' });
    expect(created.id).not.toBe(createVoiceTask({ ...created, audio }).id);
  });
});

describe('parseTasksDocument', () => {
  it('sopravvive al round-trip JSON', () => {
    const document = { schemaVersion: 1, tasks: [task('t-1', '2026-11-03'), { ...task('t-2', null), text: 'Comprare concime', audio: null }] };
    expect(parseTasksDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  });

  it('rifiuta un\'attività senza testo né nota vocale, scadenze non valide e id duplicati', () => {
    expect(() => parseTasksDocument({ schemaVersion: 1, tasks: [{ ...task('t-1', null), audio: null, text: '  ' }] })).toThrow(
      'serve un testo o una nota vocale',
    );
    expect(() => parseTasksDocument({ schemaVersion: 1, tasks: [task('t-1', '2026-02-30')] })).toThrow('task.tasks[0].dueDate');
    expect(() => parseTasksDocument({ schemaVersion: 1, tasks: [task('t-1', null), task('t-1', null)] })).toThrow(
      'id duplicato "t-1"',
    );
  });
});

describe('compareOpenTasks', () => {
  it('prima le scadenze più vicine, poi quelle senza scadenza; a parità le più vecchie', () => {
    const tasks = [
      task('senza', null),
      task('dopodomani', '2026-11-04'),
      task('scaduto', '2026-11-01'),
      task('domani-recente', '2026-11-03', '2026-11-02T11:00:00+01:00'),
      task('domani-vecchio', '2026-11-03', '2026-11-02T08:00:00+01:00'),
    ];
    expect([...tasks].sort(compareOpenTasks).map((current) => current.id)).toEqual([
      'scaduto',
      'domani-vecchio',
      'domani-recente',
      'dopodomani',
      'senza',
    ]);
  });
});
