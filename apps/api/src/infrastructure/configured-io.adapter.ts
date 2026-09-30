import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Engine.IO has its own CORS layer for the polling transport. HTTP CORS alone
 * is not enough, so apply the same validated frontend origins before Nest
 * creates the Socket.IO server.
 */
export class ConfiguredIoAdapter extends IoAdapter {
  private readonly allowedOrigins: string[];

  constructor(app: INestApplicationContext, config: ConfigService) {
    super(app);
    this.allowedOrigins = config.getOrThrow<string>('WS_ALLOWED_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
      },
    });
  }
}
