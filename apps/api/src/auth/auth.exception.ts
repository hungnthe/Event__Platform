import { HttpException, type HttpStatus } from '@nestjs/common';

export class AuthException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ error: { code, message } }, status);
  }
}
