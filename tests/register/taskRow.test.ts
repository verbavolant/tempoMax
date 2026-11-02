import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/model/task';
import { TASK_REGISTER_HEADER, TASK_REGISTER_ID_COLUMN_INDEX, taskToRow } from '../../src/register/taskRow';

const task: Task = {
  id: 't-1',
  kind: 'todo',
  createdAt: '2026-11-02T09:10:00+01:00',
  dueDate: '2026-11-03',
  completedAt: null,
  text: '',
  audio: {
    id: 'a-1',
    recordedAt: '2026-11-02T09:10:00+01:00',
    mimeType: 'audio/mp4',
    durationSeconds: 6,
    driveFileId: 'f-1',
    driveLink: 'https://drive.google.com/file/d/f-1/view',
    device: 'iPhone',
    position: { latitude: 45.4642, longitude: 9.19, accuracyMeters: 10 },
  },
  visitId: null,
  clientId: 'c-1',
  device: 'iPhone',
};

describe('taskToRow', () => {
  it('compila creazione, scadenza, stato, cliente, audio, mappa, dispositivo e id', () => {
    expect(taskToRow(task, 'Villa Rossi')).toEqual([
      '02/11/2026 09:10',
      '03/11/2026',
      'Da fare',
      '',
      'Villa Rossi',
      'https://drive.google.com/file/d/f-1/view',
      'https://www.google.com/maps/search/?api=1&query=45.4642%2C9.19',
      'iPhone',
      't-1',
    ]);
  });

  it('un\'attività fatta, senza scadenza né audio', () => {
    expect(taskToRow({ ...task, dueDate: null, completedAt: '2026-11-04T17:00:00+01:00', audio: null, text: 'x' }, null)).toEqual([
      '02/11/2026 09:10',
      '',
      'Fatto',
      '04/11/2026 17:00',
      '',
      '',
      '',
      'iPhone',
      't-1',
    ]);
  });

  it("l'id è nella colonna dichiarata", () => {
    expect(TASK_REGISTER_HEADER[TASK_REGISTER_ID_COLUMN_INDEX]).toBe('ID attività');
  });
});
