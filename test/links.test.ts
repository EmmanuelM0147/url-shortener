import request from 'supertest';
import { DatabaseError } from 'pg';
import { createApp } from '../src/app';
import { query } from '../src/db';

jest.mock('../src/db', () => ({
  query: jest.fn(),
  pool: {},
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

function mockQueryResult<T>(rows: T[], rowCount = rows.length) {
  return {
    rows,
    rowCount,
    command: '',
    oid: 0,
    fields: [],
  };
}

describe('URL shortener API', () => {
  const app = createApp();

  beforeEach(() => {
    mockQuery.mockReset();
    process.env.BASE_URL = 'http://localhost:8080';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/links', () => {
    it('returns 201 with slug and short_url when given valid target_url', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 1,
            slug: 'abc1234',
            target_url: 'https://example.com',
            created_at: new Date('2024-06-01T00:00:00.000Z'),
            expires_at: null,
            click_count: 0,
          },
        ]),
      );

      const res = await request(app)
        .post('/api/links')
        .send({ target_url: 'https://example.com' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: 1,
        slug: 'abc1234',
        target_url: 'https://example.com',
        short_url: 'http://localhost:8080/abc1234',
      });
    });

    it('returns 400 when target_url is missing', async () => {
      const res = await request(app).post('/api/links').send({}).expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('field');
      expect(res.body.error).toBe('target_url is required');
      expect(res.body.field).toBe('target_url');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when target_url is not a valid URL', async () => {
      const res = await request(app)
        .post('/api/links')
        .send({ target_url: 'not-a-valid-url' })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('field');
      expect(res.body.error).toBe('target_url must be a valid URL');
      expect(res.body.field).toBe('target_url');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when custom slug contains invalid characters', async () => {
      const res = await request(app)
        .post('/api/links')
        .send({ target_url: 'https://example.com', slug: 'bad slug!' })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('field');
      expect(res.body.error).toBe('slug must contain only alphanumeric characters and hyphens');
      expect(res.body.field).toBe('slug');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when custom slug is too long', async () => {
      const res = await request(app)
        .post('/api/links')
        .send({ target_url: 'https://example.com', slug: 'a'.repeat(21) })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('field');
      expect(res.body.error).toBe('slug must be between 3 and 20 characters');
      expect(res.body.field).toBe('slug');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 409 when slug is already taken (mock DB unique violation)', async () => {
      const dbError = new DatabaseError('duplicate key value violates unique constraint', 0, 'error');
      dbError.code = '23505';
      mockQuery.mockRejectedValueOnce(dbError);

      const res = await request(app)
        .post('/api/links')
        .send({ target_url: 'https://example.com', slug: 'taken-slug' })
        .expect(409);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Slug already taken');
      expect(Object.keys(res.body)).toEqual(['error']);
    });
  });

  describe('GET /api/links', () => {
    it('returns 200 with array of links', async () => {
      const links = [
        {
          id: 1,
          slug: 'abc1234',
          target_url: 'https://example.com',
          click_count: 5,
          created_at: new Date('2024-06-01T00:00:00.000Z'),
          expires_at: null,
        },
      ];

      mockQuery.mockResolvedValueOnce(mockQueryResult(links));

      const res = await request(app).get('/api/links').expect(200);

      expect(res.body).toEqual([
        {
          ...links[0],
          created_at: '2024-06-01T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('DELETE /api/links/:slug', () => {
    it('returns 204 when link exists', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ slug: 'abc1234' }], 1));

      await request(app).delete('/api/links/abc1234').expect(204);
    });

    it('returns 404 when link does not exist', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([], 0));

      const res = await request(app).delete('/api/links/missing').expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Link not found');
      expect(Object.keys(res.body)).toEqual(['error']);
    });
  });

  describe('GET /:slug (redirect)', () => {
    it('returns 302 to target_url for valid non-expired link', async () => {
      mockQuery
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              slug: 'abc1234',
              target_url: 'https://example.com/page',
              expires_at: null,
            },
          ]),
        )
        .mockResolvedValueOnce(mockQueryResult([], 1))
        .mockResolvedValueOnce(mockQueryResult([], 1));

      const res = await request(app).get('/abc1234').expect(302);

      expect(res.headers.location).toBe('https://example.com/page');
    });

    it('returns 404 for unknown slug', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([], 0));

      const res = await request(app).get('/unknown').expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Link not found');
      expect(Object.keys(res.body)).toEqual(['error']);
    });

    it('returns 404 for expired link', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            slug: 'expired',
            target_url: 'https://example.com',
            expires_at: new Date('2020-01-01T00:00:00.000Z'),
          },
        ]),
      );

      const res = await request(app).get('/expired').expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Link expired');
      expect(Object.keys(res.body)).toEqual(['error']);
    });
  });

  describe('GET /api/links/:slug/analytics', () => {
    it('returns 200 with analytics for an existing slug', async () => {
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ slug: 'abc1234', click_count: 2 }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              clicked_at: new Date('2024-06-01T12:00:00.000Z'),
              user_agent: 'curl/8.0',
            },
          ]),
        );

      const res = await request(app).get('/api/links/abc1234/analytics').expect(200);

      expect(res.body).toEqual({
        slug: 'abc1234',
        total_clicks: 2,
        recent_clicks: [
          {
            clicked_at: '2024-06-01T12:00:00.000Z',
            user_agent: 'curl/8.0',
          },
        ],
      });
    });

    it('returns 404 when slug does not exist', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([], 0));

      const res = await request(app).get('/api/links/missing/analytics').expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Link not found');
      expect(Object.keys(res.body)).toEqual(['error']);
    });
  });

  describe('GET /health', () => {
    it('returns 200 with { status: "ok" } when DB responds', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ '?column?': 1 }]));

      const res = await request(app).get('/health').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        db: 'connected',
      });
      expect(typeof res.body.uptime).toBe('number');
    });

    it('returns 503 when DB is unreachable', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));

      const res = await request(app).get('/health').expect(503);

      expect(res.body).toMatchObject({
        status: 'degraded',
        db: 'disconnected',
      });
      expect(typeof res.body.uptime).toBe('number');
    });
  });
});
