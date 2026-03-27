import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string; name?: string };
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  async signup(@Body() body: { email: string; password: string; name?: string }) {
    return this.auth.signup(body.email, body.password, body.name);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  googleRedirect(@Req() req: Request, @Res() res: Response) {
    const clientId = this.config.getOrThrow('GOOGLE_CLIENT_ID');
    const redirectUri = this.getGoogleCallbackUrl();
    const scope = 'openid email profile';

    // Pass cli_redirect through Google's state param so it survives the OAuth round-trip
    const cliRedirect = req.query.cli_redirect as string | undefined;
    const state = cliRedirect ? Buffer.from(JSON.stringify({ cli_redirect: cliRedirect })).toString('base64url') : '';

    let url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    if (state) url += `&state=${state}`;

    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const code = req.query.code as string;
    if (!code) throw new UnauthorizedException('Missing code');

    const clientId = this.config.getOrThrow('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.getGoogleCallbackUrl();

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json() as GoogleTokenResponse;
    if (!tokens.access_token) {
      console.error('Google token exchange error:', tokens);
      throw new UnauthorizedException(`Google token exchange failed: ${tokens.error_description ?? tokens.error ?? 'unknown'}`);
    }

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = await profileRes.json() as GoogleProfile;

    const result = await this.auth.findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      googleId: profile.id,
    });

    // Check if CLI started this flow
    const stateParam = req.query.state as string | undefined;
    let cliRedirect: string | undefined;
    if (stateParam) {
      try {
        const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        cliRedirect = state.cli_redirect;
      } catch {}
    }

    // Redirect to web app with token (and cli_redirect if present)
    const webUrl = this.config.get('WEB_URL') ?? 'http://localhost:5173';
    const callbackUrl = `${webUrl}/auth/callback?token=${result.accessToken}${cliRedirect ? `&cli_redirect=${encodeURIComponent(cliRedirect)}` : ''}`;
    res.redirect(callbackUrl);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  @Post('api-keys')
  async createApiKey(@Req() req: AuthenticatedRequest, @Body() body: { name: string }) {
    return this.auth.createApiKey(req.user.sub, body.name);
  }

  // ─── Current user ─────────────────────────────────────────────────────────

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getGoogleCallbackUrl(): string {
    const base = this.config.get('RUNTIME_URL') ?? 'http://localhost:4321';
    return `${base}/api/auth/google/callback`;
  }
}
