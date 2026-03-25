import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { randomUUID, createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { InjectDB, type DrizzleDB } from '../db';
import { users, apiKeys } from '../db/schema';

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
}

export interface AuthResult {
  user: { id: string; email: string; name: string | null; provider: string };
  accessToken: string;
}

interface GoogleProfile {
  email: string;
  name: string;
  avatarUrl?: string;
  googleId: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
  }

  // ─── Local auth ───────────────────────────────────────────────────────────

  async signup(email: string, password: string, name?: string): Promise<AuthResult> {
    const id = randomUUID();
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 10);

    await this.db.insert(users).values({
      id,
      email,
      passwordHash,
      name: name ?? null,
      provider: 'local',
      createdAt: now,
      updatedAt: now,
    });

    return this.buildAuthResult({ id, email, name: name ?? null, provider: 'local' });
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthResult> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      // Update Google info if needed
      if (user.provider !== 'google') {
        await this.db
          .update(users)
          .set({ provider: 'google', providerId: profile.googleId, avatarUrl: profile.avatarUrl, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
      return this.buildAuthResult(user);
    }

    const id = randomUUID();
    const now = new Date();

    await this.db.insert(users).values({
      id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      provider: 'google',
      providerId: profile.googleId,
      createdAt: now,
      updatedAt: now,
    });

    return this.buildAuthResult({ id, email: profile.email, name: profile.name, provider: 'google' });
  }

  // ─── JWT ──────────────────────────────────────────────────────────────────

  private buildAuthResult(user: { id: string; email: string; name: string | null; provider: string }): AuthResult {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name ?? undefined };
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

    return {
      user: { id: user.id, email: user.email, name: user.name, provider: user.provider },
      accessToken,
    };
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.jwtSecret) as JwtPayload;
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async createApiKey(userId: string, name: string): Promise<{ rawKey: string; apiKey: { id: string; name: string; keyPrefix: string } }> {
    const rawKey = `mg_${randomBytes(24).toString('base64url')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const id = randomUUID();
    const now = new Date();

    await this.db.insert(apiKeys).values({
      id,
      userId,
      keyHash,
      keyPrefix,
      name,
      createdAt: now,
    });

    return { rawKey, apiKey: { id, name, keyPrefix } };
  }

  async validateApiKey(rawKey: string): Promise<{ id: string; email: string; name: string | null } | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const rows = await this.db
      .select({ userId: apiKeys.userId, keyId: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (rows.length === 0) return null;

    // Update last used
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, rows[0].keyId));

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, rows[0].userId))
      .limit(1);

    if (userRows.length === 0) return null;

    const user = userRows[0];
    return { id: user.id, email: user.email, name: user.name };
  }
}
