const svc = require('../src/services/taskService');

beforeEach(() => svc._reset());

const daysFromNow = (d) => new Date(Date.now() + d * 86400000).toISOString();

describe('create', () => {
  it('applies defaults', () => {
    const t = svc.create({ title: 'A' });
    expect(t).toMatchObject({
      title: 'A', description: '', status: 'todo', priority: 'medium',
      dueDate: null, completedAt: null,
    });
    expect(t.id).toEqual(expect.any(String));
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('respects provided fields and generates unique ids', () => {
    const a = svc.create({ title: 'A', priority: 'high', status: 'in_progress' });
    const b = svc.create({ title: 'B' });
    expect(a).toMatchObject({ priority: 'high', status: 'in_progress' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll / findById', () => {
  it('returns all tasks, and a copy of the array', () => {
    svc.create({ title: 'A' });
    const list = svc.getAll();
    list.pop();
    expect(svc.getAll()).toHaveLength(1);
  });

  it('finds by id, undefined when missing', () => {
    const t = svc.create({ title: 'A' });
    expect(svc.findById(t.id)).toEqual(t);
    expect(svc.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    svc.create({ title: 'A', status: 'todo' });
    svc.create({ title: 'B', status: 'done' });
    svc.create({ title: 'C', status: 'in_progress' });
  });

  it('returns only tasks with that exact status', () => {
    expect(svc.getByStatus('todo').map((t) => t.title)).toEqual(['A']);
  });

  it('returns [] for an unknown status', () => {
    expect(svc.getByStatus('nope')).toEqual([]);
  });

  // BUG: implementation uses String.includes -> partial match
  it('does not match on partial status strings', () => {
    expect(svc.getByStatus('do')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) svc.create({ title: `T${i}` });
  });

  // BUG: offset = page * limit, so page 1 skips the first page
  it('page 1 returns the first `limit` items', () => {
    expect(svc.getPaginated(1, 2).map((t) => t.title)).toEqual(['T1', 'T2']);
  });

  it('page 2 returns the next items', () => {
    expect(svc.getPaginated(2, 2).map((t) => t.title)).toEqual(['T3', 'T4']);
  });

  it('last page can be partial', () => {
    expect(svc.getPaginated(3, 2).map((t) => t.title)).toEqual(['T5']);
  });

  it('page past the end returns []', () => {
    expect(svc.getPaginated(10, 2)).toEqual([]);
  });
});

describe('getStats', () => {
  it('returns zeros for an empty store', () => {
    expect(svc.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts by status', () => {
    svc.create({ title: 'A', status: 'todo' });
    svc.create({ title: 'B', status: 'todo' });
    svc.create({ title: 'C', status: 'in_progress' });
    svc.create({ title: 'D', status: 'done' });
    expect(svc.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
  });

  it('counts overdue only for past-due, not-done tasks', () => {
    svc.create({ title: 'past todo', dueDate: daysFromNow(-2) });
    svc.create({ title: 'past done', dueDate: daysFromNow(-2), status: 'done' });
    svc.create({ title: 'future', dueDate: daysFromNow(2) });
    svc.create({ title: 'no due date' });
    expect(svc.getStats().overdue).toBe(1);
  });
});

describe('update', () => {
  it('merges fields and persists them', () => {
    const t = svc.create({ title: 'A' });
    const u = svc.update(t.id, { title: 'B', priority: 'high' });
    expect(u).toMatchObject({ id: t.id, title: 'B', priority: 'high' });
    expect(svc.findById(t.id).title).toBe('B');
  });

  it('returns null for an unknown id', () => {
    expect(svc.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG: arbitrary fields (incl. id / createdAt) are spread onto the task
  it('does not allow overwriting immutable fields', () => {
    const t = svc.create({ title: 'A' });
    const u = svc.update(t.id, { id: 'hacked', createdAt: '2000-01-01T00:00:00.000Z' });
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
  });
});

describe('remove', () => {
  it('removes an existing task', () => {
    const t = svc.create({ title: 'A' });
    expect(svc.remove(t.id)).toBe(true);
    expect(svc.getAll()).toHaveLength(0);
  });

  it('returns false for an unknown id', () => {
    expect(svc.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  it('sets status done and completedAt', () => {
    const t = svc.create({ title: 'A' });
    const c = svc.completeTask(t.id);
    expect(c.status).toBe('done');
    expect(new Date(c.completedAt).toString()).not.toBe('Invalid Date');
    expect(svc.findById(t.id).status).toBe('done');
  });

  // BUG: priority is hard-coded to 'medium'
  it('does not change priority', () => {
    const t = svc.create({ title: 'A', priority: 'high' });
    expect(svc.completeTask(t.id).priority).toBe('high');
  });

  it('returns null for an unknown id', () => {
    expect(svc.completeTask('nope')).toBeNull();
  });
});