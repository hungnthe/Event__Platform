import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { CsrfResponse, LoginResponse } from '@eventflow/contracts';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly csrf: CsrfService) {}
  @Get('csrf') csrfToken(@Res({ passthrough: true }) response: Response): CsrfResponse { return { token: this.csrf.issue(response) }; }
  @UseGuards(CsrfGuard)
  @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LoginResponse> {
    const result = await this.auth.login(dto, request);
    response.cookie(this.auth.cookieName(), result.session.rawToken, this.auth.sessionCookieOptions(result.session.expiresAt));
    return { user: result.user };
  }
  @Get('me') me(@Req() request: Request) { return this.auth.currentUser(request); }
  @UseGuards(CsrfGuard)
  @Post('logout') @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request);
    response.clearCookie(this.auth.cookieName(), this.auth.clearSessionCookieOptions());
  }
}
