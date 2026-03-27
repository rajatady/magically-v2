/**
 * Zeus API e2e tests.
 * Tests REST endpoints against real DB. Each test creates its own data
 * and verifies via DB queries — no hardcoded states.
 *
 * Note: Agent SDK chat (POST /api/zeus/chat) is NOT tested here because
 * it requires ANTHROPIC_API_KEY and makes real API calls. These tests
 * cover the REST surface only.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import * as schema from '../src/db/schema';
import type { DrizzleDB } from '../src/db';

describe('Zeus API (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let pool: Pool;
  let authToken: string;
  let testUserId: string;
  const testEmail = `zeus-e2e-${Date.now()}@test.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Direct DB connection for verification queries
    pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2_test',
    });
    db = drizzle(pool, { schema });

    // Create test user and get auth token
    const signupRes = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: testEmail, password: 'testpass123', name: 'Zeus E2E' });

    authToken = signupRes.body.accessToken;
    testUserId = signupRes.body.user.id;
  }, 30_000);

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await db.delete(schema.zeusMemory);
      await db.delete(schema.zeusTasks);
      await db.delete(schema.zeusConversations);
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
    await app.close();
  }, 15_000);

  // ─── Conversations ────────────────────────────────────────────────

  describe('POST /api/zeus/conversations', () => {
    it('creates a conversation and returns it', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mode: 'chat' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.mode).toBe('chat');
      expect(res.body.messages).toEqual([]);

      // Verify in DB
      const rows = await db
        .select()
        .from(schema.zeusConversations)
        .where(eq(schema.zeusConversations.id, res.body.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].mode).toBe('chat');
    });
  });

  describe('GET /api/zeus/conversations', () => {
    it('lists conversations', async () => {
      // Create two conversations
      await request(app.getHttpServer())
        .post('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mode: 'chat' });
      await request(app.getHttpServer())
        .post('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mode: 'build' });

      const res = await request(app.getHttpServer())
        .get('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/zeus/conversations/:id', () => {
    it('returns a specific conversation', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mode: 'task' });

      const res = await request(app.getHttpServer())
        .get(`/api/zeus/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.mode).toBe('task');
    });

    it('returns 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/zeus/conversations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/zeus/conversations/:id', () => {
    it('deletes a conversation', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/zeus/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      await request(app.getHttpServer())
        .delete(`/api/zeus/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deleted from DB
      const rows = await db
        .select()
        .from(schema.zeusConversations)
        .where(eq(schema.zeusConversations.id, createRes.body.id));
      expect(rows).toHaveLength(0);
    });
  });

  // ─── Memory ───────────────────────────────────────────────────────

  describe('POST /api/zeus/memory', () => {
    it('creates a memory entry', async () => {
      const key = `test.e2e.${Date.now()}`;
      await request(app.getHttpServer())
        .post('/api/zeus/memory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ key, value: 'test-value', category: 'test' })
        .expect(200);

      // Verify in DB
      const rows = await db
        .select()
        .from(schema.zeusMemory)
        .where(eq(schema.zeusMemory.key, key));
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe('test-value');
      expect(rows[0].category).toBe('test');
    });

    it('updates an existing memory entry', async () => {
      const key = `test.e2e.update.${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/zeus/memory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ key, value: 'original', category: 'test' });

      await request(app.getHttpServer())
        .post('/api/zeus/memory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ key, value: 'updated', category: 'test' });

      // Verify only one entry with updated value
      const rows = await db
        .select()
        .from(schema.zeusMemory)
        .where(eq(schema.zeusMemory.key, key));
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe('updated');
    });
  });

  describe('GET /api/zeus/memory', () => {
    it('returns memory entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/zeus/memory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('DELETE /api/zeus/memory/:key', () => {
    it('deletes a memory entry', async () => {
      const key = `test.e2e.delete.${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/zeus/memory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ key, value: 'to-delete', category: 'test' });

      await request(app.getHttpServer())
        .delete(`/api/zeus/memory/${key}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deleted from DB
      const rows = await db
        .select()
        .from(schema.zeusMemory)
        .where(eq(schema.zeusMemory.key, key));
      expect(rows).toHaveLength(0);
    });
  });

  // ─── Tasks ────────────────────────────────────────────────────────

  describe('GET /api/zeus/tasks', () => {
    it('returns tasks', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/zeus/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Auth guard ───────────────────────────────────────────────────

  describe('unauthorized access', () => {
    it('rejects requests without token', async () => {
      await request(app.getHttpServer())
        .get('/api/zeus/conversations')
        .expect(401);
    });

    it('rejects requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/zeus/conversations')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
