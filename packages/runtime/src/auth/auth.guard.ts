import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication');
    }

    // Try JWT first
    try {
      const payload = this.auth.verifyToken(token);
      (request as Record<string, unknown>).user = payload;
      return true;
    } catch {}

    // Try API key
    if (token.startsWith('mg_')) {
      const user = await this.auth.validateApiKey(token);
      if (user) {
        (request as Record<string, unknown>).user = { sub: user.id, email: user.email, name: user.name };
        return true;
      }
    }

    throw new UnauthorizedException('Invalid authentication');
  }

  private extractToken(request: Request): string | null {
    // Bearer token
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // X-API-Key header
    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey === 'string') {
      return apiKey;
    }

    // Query param (for iframes that can't set headers)
    const queryToken = request.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
