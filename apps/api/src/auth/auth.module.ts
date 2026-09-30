import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { PasswordService } from './password.service';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  imports: [PrismaModule, InfrastructureModule],
  controllers: [AuthController],
  providers: [AuthService, CsrfService, CsrfGuard, PasswordService, SessionAuthGuard],
  exports: [AuthService, CsrfService, CsrfGuard, SessionAuthGuard],
})
export class AuthModule {}
