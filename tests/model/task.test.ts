import { describe, expect, it } from 'vitest';
import { type TasksDocument, parseTasksDocument } from '../../src/model/task';

const tasksDocument: TasksDocument = {
  schemaVersion: 1,
  tasks: [
    {
      id: 't-1',
      kind: 'todo',
      clientId: 'c-1',
      originVisitId: 'v-1',
      text: 'Concimare le rose',
      createdAt: '2026-10-30T11:00:00+01:00',
      completedAt: null,
    },
    {
      id: 't-2',
      kind: 'purchase',
      clientId: 'c-1',
      originVisitId: null,
      text: '2 sacchi di terriccio',
      createdAt: '2026-10-30T11:05:00+01:00',
      completedAt: '2026-10-31T08:30:00+01:00',
    },
  ],
};

describe('parseTasksDocument', () => {
  it('sopravvive al round-trip JSON', () => {
    expect(parseTasksDocument(JSON.parse(JSON.stringify(tasksDocument)))).toStrictEqual(tasksDocument);
  });

  it('rifiuta un tipo sconosciuto', () => {
    const invalid = structuredClone(tasksDocument);
    (invalid.tasks[0] as { kind: string }).kind = 'shopping';
    expect(() => parseTasksDocument(invalid)).toThrow('task.tasks[0].kind: atteso uno tra todo, purchase');
  });

  it('rifiuta un testo vuoto', () => {
    const invalid = structuredClone(tasksDocument);
    invalid.tasks[1]!.text = '';
    expect(() => parseTasksDocument(invalid)).toThrow('task.tasks[1].text: stringa vuota');
  });

  it('rifiuta id duplicati', () => {
    const invalid = structuredClone(tasksDocument);
    invalid.tasks[1]!.id = 't-1';
    expect(() => parseTasksDocument(invalid)).toThrow('id duplicato "t-1"');
  });
});
