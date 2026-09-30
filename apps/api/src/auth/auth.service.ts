import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '@eventflow/contracts';
import type { Request } from 'express';
import { Prisma, UserStatus } from '@prisma/client';
import { RedisService } from '../infrastructure/redis.service';
import { SocketSessionRegistry } from '../infrastructure/socket-session-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthException } from './auth.exception';
import { createOpaqueToken, hashToken, normalizeEmail, readCookie } from './auth.utils';
import type { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';

interface CreatedSession { rawToken: string; expiresAt: Date; }
interface LoginResult { user: AuthUser; session: CreatedSession; }
export interface AuthenticatedSocketSession { user: AuthUser; sessionId: string; expiresAt: Date; }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
    private readonly socketRegistry: SocketSessionRegistry,
  ) {}

  async login(dto: LoginDto, request: Request): Promise<LoginResult> {
    const ipAddress = request.ip || 'unknown';
    const rateLimitCount = await this.redis.incrementWithExpiry(`auth:login:${ipAddress}`, 5 * 60);
    if (rateLimitCount !== null && rateLimitCount > 10) throw new AuthException(429, 'AUTH_TOO_MANY_ATTEMPTS', 'Vui lòng thử lại sau.');
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(dto.email) } });
    const now = new Date();
    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash || (user.lockedUntil && user.lockedUntil > now)) throw this.invalidCredentials();
    if (!await this.passwords.verify(user.passwordHash, dto.password)) {
      await this.recordFailedLogin(user.id, user.failedLoginCount, user.lastFailedLoginAt, now);
      throw this.invalidCredentials();
    }
    const session = await this.createSession(user.id, dto.rememberMe, request);
    const activeUser = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null } });
    return { user: this.toAuthUser(activeUser), session };
  }

  async currentUser(request: Request): Promise<AuthUser> {
    return this.authenticate(request);
  }

  async authenticate(request: Request): Promise<AuthUser> {
    return (await this.authenticateSocket(request.header('cookie'))).user;
  }

  async authenticateSocket(cookieHeader: string | undefined): Promise<AuthenticatedSocketSession> {
    const session = await this.findActiveSessionFromCookie(cookieHeader);
    await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { user: this.toAuthUser(session.user), sessionId: session.id, expiresAt: session.expiresAt };
  }

  async logout(request: Request): Promise<void> {
    const token = readCookie(request.header('cookie'), this.cookieName());
    if (!token) return;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true } });
    if (!session) return;
    await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    this.socketRegistry.disconnectSession(session.id);
  }

  /** Used by account administration/password-reset flows when every session must end. */
  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    this.socketRegistry.disconnectUser(userId);
  }

  sessionCookieOptions(expiresAt: Date): { httpOnly: true; sameSite: 'lax'; secure: boolean; path: '/'; expires: Date; domain?: string } {
    const options = { httpOnly: true as const, sameSite: 'lax' as const, secure: this.config.getOrThrow<string>('NODE_ENV') === 'production', path: '/' as const, expires: expiresAt };
    const domain = this.config.get<string>('SESSION_COOKIE_DOMAIN');
    return domain ? { ...options, domain } : options;
  }

  clearSessionCookieOptions(): { httpOnly: true; sameSite: 'lax'; secure: boolean; path: '/'; domain?: string } {
    const options = { httpOnly: true as const, sameSite: 'lax' as const, secure: this.config.getOrThrow<string>('NODE_ENV') === 'production', path: '/' as const };
    const domain = this.config.get<string>('SESSION_COOKIE_DOMAIN');
    return domain ? { ...options, domain } : options;
  }

  cookieName(): string { return this.config.getOrThrow<string>('SESSION_COOKIE_NAME'); }

  private async createSession(userId: string, rememberMe: boolean, request: Request): Promise<CreatedSession> {
    const rawToken = createOpaqueToken();
    const hours = this.config.getOrThrow<number>('SESSION_DEFAULT_TTL_HOURS');
    const days = this.config.getOrThrow<number>('SESSION_REMEMBER_TTL_DAYS');
    const expiresAt = new Date(Date.now() + (rememberMe ? days * 24 : hours) * 60 * 60 * 1000);
    await this.prisma.session.create({ data: { userId, tokenHash: hashToken(rawToken), rememberMe, userAgent: request.header('user-agent') || null, ipAddress: request.ip || null, expiresAt } });
    return { rawToken, expiresAt };
  }

  private async findActiveSessionFromCookie(cookieHeader: string | undefined): Promise<Prisma.SessionGetPayload<{ include: { user: true } }>> {
    const token = readCookie(cookieHeader, this.cookieName());
    if (!token) throw new AuthException(401, 'AUTH_SESSION_REQUIRED', 'Cần đăng nhập để tiếp tục.');
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) throw new AuthException(401, 'AUTH_SESSION_EXPIRED', 'Phiên đăng nhập không còn hiệu lực.');
    return session;
  }

  private async recordFailedLogin(userId: string, previousCount: number, lastFailedLoginAt: Date | null, now: Date): Promise<void> {
    const failedLoginCount = lastFailedLoginAt && now.getTime() - lastFailedLoginAt.getTime() <= 15 * 60 * 1000 ? previousCount + 1 : 1;
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginCount, lastFailedLoginAt: now, lockedUntil: failedLoginCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null } });
  }

  private toAuthUser(user: { id: string; email: string; displayName: string | null; systemRole: 'USER' | 'SYSTEM_ADMIN'; status: 'INVITED' | 'ACTIVE' | 'SUSPENDED'; mustChangePassword: boolean }): AuthUser {
    return { id: user.id, email: user.email, displayName: user.displayName, systemRole: user.systemRole, status: user.status, mustChangePassword: user.mustChangePassword, permissions: user.systemRole === 'SYSTEM_ADMIN' ? ['admin:access'] : [] };
  }

  private invalidCredentials(): AuthException { return new AuthException(401, 'AUTH_INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'); }
}
