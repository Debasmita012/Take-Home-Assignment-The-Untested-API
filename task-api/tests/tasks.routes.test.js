const request = require('supertest');
const app = require('../src/app');
const svc = require('../src/services/taskService');

beforeEach(() => svc._reset());

const create = (body = { title: 'Task' }) => request(app).post('/tasks').send(body);

describe('POST /tasks', () => {
  it('creates a task (201)', async () => {
    const res = await create({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high', status: 'todo' });
    expect(res.body.id).toBeDefined();
  });

  it.each([
    ['missing title', {}],
    ['empty title', { title: '   ' }],
    ['non-string title', { title: 42 }],
    ['invalid status', { title: 'x', status: 'pending' }],
    ['invalid priority', { title: 'x', priority: 'urgent' }],
    ['invalid dueDate', { title: 'x', dueDate: 'not-a-date' }],
  ])('400 on %s', async (_name, body) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // BUG: body-parser errors fall into the generic handler and return 500
  it('400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/tasks').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await create({ title: 'A' });
    await create({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    await create({ title: 'A', status: 'todo' });
    await create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.map((t) => t.title)).toEqual(['B']);
  });

  // BUG: substring match on status
  it('does not treat status as a substring match', async () => {
    await create({ title: 'A', status: 'todo' });
    await create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks?status=do');
    expect(res.body).toEqual([]);
  });

  // BUG: off-by-one in pagination offset
  it('paginates: page 1 is the first page', async () => {
    for (let i = 1; i <= 5; i++) await create({ title: `T${i}` });
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['T1', 'T2']);
  });

  it('paginates: last page is partial', async () => {
    for (let i = 1; i <= 5; i++) await create({ title: `T${i}` });
    const res = await request(app).get('/tasks?page=3&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['T5']);
  });

  it('falls back to defaults for non-numeric page/limit', async () => {
    await create({ title: 'A' });
    const res = await request(app).get('/tasks?page=abc&limit=xyz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates a task', async () => {
    const { body: t } = await create();
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'New', priority: 'low' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'New', priority: 'low' });
  });

  it('404 for unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it.each([
    [{ title: '' }],
    [{ status: 'bogus' }],
    [{ priority: 'bogus' }],
    [{ dueDate: 'bogus' }],
  ])('400 on invalid body %j', async (body) => {
    const { body: t } = await create();
    const res = await request(app).put(`/tasks/${t.id}`).send(body);
    expect(res.status).toBe(400);
  });

  // BUG: id can be overwritten through the body
  it('ignores id in the request body', async () => {
    const { body: t } = await create();
    const res = await request(app).put(`/tasks/${t.id}`).send({ id: 'hacked' });
    expect(res.body.id).toBe(t.id);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes and returns 204', async () => {
    const { body: t } = await create();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });

  it('404 for unknown id, and on second delete', async () => {
    const { body: t } = await create();
    await request(app).delete(`/tasks/${t.id}`);
    expect((await request(app).delete(`/tasks/${t.id}`)).status).toBe(404);
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task complete', async () => {
    const { body: t } = await create();
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  // BUG: priority reset to medium
  it('keeps the original priority', async () => {
    const { body: t } = await create({ title: 'x', priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  it('404 for unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  it('returns counts and overdue', async () => {
    await create({ title: 'A' });
    await create({ title: 'B', status: 'in_progress', dueDate: '2000-01-01T00:00:00.000Z' });
    await create({ title: 'C', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });

  it('is not shadowed by /:id routes', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toHaveProperty('overdue');
  });
});