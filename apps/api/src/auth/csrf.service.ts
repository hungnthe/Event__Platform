import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { AuthException } from './auth.exception';
import { constantTimeEquals, createOpaqueToken, readCookie, signCsrfNonce } from './auth.utils';

@Injectable()
export class CsrfService {
  private readonly cookieName = 'eventflow_csrf';
  private readonly allowedOrigins: string[];

  constructor(private readonly config: ConfigService) {
    this.allowedOrigins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim());
  }

  issue(response: Response): string {
    const nonce = createOpaqueToken();
    const token = `${nonce}.${signCsrfNonce(nonce, this.config.getOrThrow<string>('CSRF_SECRET'))}`;
    response.cookie(this.cookieName, token, this.cookieOptions());
    return token;
  }

  validate(request: Request): void {
    const origin = request.header('origin');
    if (!origin || !this.allowedOrigins.includes(origin)) {
      throw new AuthException(403, 'AUTH_CSRF_INVALID', 'Yêu cầu không hợp lệ.');
    }
    const cookieToken = readCookie(request.header('cookie'), this.cookieName);
    const headerToken = request.header('x-csrf-token');
    if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, headerToken)) {
      throw new AuthException(403, 'AUTH_CSRF_INVALID', 'Yêu cầu không hợp lệ.');
    }
    const [nonce, signature, extra] = headerToken.split('.');
    if (!nonce || !signature || extra || !constantTimeEquals(signature, signCsrfNonce(nonce, this.config.getOrThrow<string>('CSRF_SECRET')))) {
      throw new AuthException(403, 'AUTH_CSRF_INVALID', 'Yêu cầu không hợp lệ.');
    }
  }

  private cookieOptions(): CookieOptions {
    const options: CookieOptions = { httpOnly: false, sameSite: 'lax', secure: this.config.getOrThrow<string>('NODE_ENV') === 'production', path: '/' };
    const domain = this.config.get<string>('SESSION_COOKIE_DOMAIN');
    if (domain) options.domain = domain;
    return options;
  }
}
