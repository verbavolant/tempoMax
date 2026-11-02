import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/model/task';
import { EMPTY_LOCAL_TASK_STATE, LocalTaskStore } from '../../src/storage/localTasks';

function memoryStorage() {
  const items = new Map<string, string>();
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

const task: Task = {
  id: 't-1',
  kind: 'todo',
  createdAt: '2026-11-02T09:10:00+01:00',
  dueDate: null,
  completedAt: null,
  text: 'Concimare',
  audio: null,
  visitId: null,
  clientId: null,
  device: null,
};

describe('LocalTaskStore', () => {
  it('rilegge ciò che salva e parte vuoto', () => {
    const storage = memoryStorage();
    expect(new LocalTaskStore(storage).load()).toEqual(EMPTY_LOCAL_TASK_STATE);
    new LocalTaskStore(storage).save({ tasks: [task], unsyncedIds: ['t-1'] });
    expect(new LocalTaskStore(storage).load()).toEqual({ tasks: [task], unsyncedIds: ['t-1'] });
  });

  it('non salva id in coda che non corrispondono a un\'attività', () => {
    const storage = memoryStorage();
    expect(() => new LocalTaskStore(storage).save({ tasks: [], unsyncedIds: ['x'] })).toThrow('attività sconosciuta "x"');
    expect(storage.items.size).toBe(0);
  });
});
