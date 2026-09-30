const request = require('supertest');
const app = require('../src/app');
const svc = require('../src/services/taskService');

beforeEach(() => svc._reset());

const createTask = async () => (await request(app).post('/tasks').send({ title: 'T' })).body;
const assign = (id, body) => request(app).patch(`/tasks/${id}/assign`).send(body);

describe('PATCH /tasks/:id/assign', () => {
  it('assigns and returns the updated task', async () => {
    const t = await createTask();
    const res = await assign(t.id, { assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'T', assignee: 'Alice' });
  });

  it('persists the assignment', async () => {
    const t = await createTask();
    await assign(t.id, { assignee: 'Alice' });
    const list = (await request(app).get('/tasks')).body;
    expect(list[0].assignee).toBe('Alice');
  });

  it('trims surrounding whitespace', async () => {
    const t = await createTask();
    expect((await assign(t.id, { assignee: '  Bob  ' })).body.assignee).toBe('Bob');
  });

  it('404 for unknown task', async () => {
    expect((await assign('nope', { assignee: 'Alice' })).status).toBe(404);
  });

  it.each([
    ['missing', {}],
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['non-string', { assignee: 42 }],
    ['null', { assignee: null }],
    ['too long', { assignee: 'x'.repeat(101) }],
  ])('400 when assignee is %s', async (_n, body) => {
    const t = await createTask();
    const res = await assign(t.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('allows reassigning to a different person', async () => {
    const t = await createTask();
    await assign(t.id, { assignee: 'Alice' });
    const res = await assign(t.id, { assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });

  it('returns 404 (not 400) for an unknown id even with a bad body', async () => {
    expect((await assign('nope', {})).status).toBe(404);
  });
});