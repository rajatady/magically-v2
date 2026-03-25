import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { AuthService } from './auth.service';
import { DRIZZLE, type DrizzleDB } from '../db';
import * as schema from '../db/schema';
import { users, apiKeys } from '../db/schema';

const TEST_EMAILS = ['test@example.com', 'google@example.com'];

describe('AuthService', () => {
  let service: AuthService;
  let db: DrizzleDB;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret-key-for-jwt';
              throw new Error(`Unknown key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    db = module.get(DRIZZLE);

    // Clean up only rows created by this test suite
    await db.delete(apiKeys);
    await db.delete(users).where(inArray(users.email, TEST_EMAILS));
  });

  afterAll(async () => {
    await db.delete(apiKeys);
    await db.delete(users).where(inArray(users.email, TEST_EMAILS));
    await module.close();
  });

  describe('signup (local)', () => {
    it('creates a user with email and password', async () => {
      const result = await service.signup('test@example.com', 'password123', 'Test User');

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
    });

    it('rejects duplicate email', async () => {
      await expect(
        service.signup('test@example.com', 'password123', 'Duplicate'),
      ).rejects.toThrow();
    });
  });

  describe('login (local)', () => {
    it('returns a token for valid credentials', async () => {
      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('rejects wrong password', async () => {
      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(/invalid/i);
    });

    it('rejects unknown email', async () => {
      await expect(
        service.login('nobody@example.com', 'password123'),
      ).rejects.toThrow(/invalid/i);
    });
  });

  describe('Google OAuth', () => {
    it('creates a user from Google profile', async () => {
      const result = await service.findOrCreateGoogleUser({
        email: 'google@example.com',
        name: 'Google User',
        avatarUrl: 'https://example.com/avatar.jpg',
        googleId: 'google-sub-123',
      });

      expect(result.user.email).toBe('google@example.com');
      expect(result.user.provider).toBe('google');
      expect(result.accessToken).toBeDefined();
    });

    it('returns existing user on repeat Google login', async () => {
      const result = await service.findOrCreateGoogleUser({
        email: 'google@example.com',
        name: 'Google User',
        avatarUrl: 'https://example.com/avatar.jpg',
        googleId: 'google-sub-123',
      });

      expect(result.user.email).toBe('google@example.com');
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid JWT and returns the payload', async () => {
      const { accessToken } = await service.login('test@example.com', 'password123');
      const payload = service.verifyToken(accessToken);

      expect(payload.email).toBe('test@example.com');
      expect(payload.sub).toBeDefined();
    });

    it('throws on invalid token', () => {
      expect(() => service.verifyToken('garbage')).toThrow();
    });
  });

  describe('API keys', () => {
    let userId: string;

    beforeAll(async () => {
      const { user } = await service.login('test@example.com', 'password123');
      userId = user.id;
    });

    it('creates an API key and returns the raw key once', async () => {
      const result = await service.createApiKey(userId, 'My CLI Key');

      expect(result.rawKey).toMatch(/^mg_/);
      expect(result.apiKey.name).toBe('My CLI Key');
      expect(result.apiKey.keyPrefix).toBe(result.rawKey.substring(0, 8));
    });

    it('validates an API key and returns the user', async () => {
      const { rawKey } = await service.createApiKey(userId, 'Validate Test');
      const user = await service.validateApiKey(rawKey);

      expect(user).toBeDefined();
      expect(user!.email).toBe('test@example.com');
    });

    it('returns null for invalid API key', async () => {
      const user = await service.validateApiKey('mg_invalid_key');
      expect(user).toBeNull();
    });
  });
});
