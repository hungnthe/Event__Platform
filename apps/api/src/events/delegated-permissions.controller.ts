import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DelegatedPermissionsService } from './delegated-permissions.service';
import { UpdateDelegatedPermissionsDto } from './dto/delegated-permission.dto';

@Controller('events/:eventId/members/:eventMemberId/permissions')
@UseGuards(SessionAuthGuard)
export class DelegatedPermissionsController {
  constructor(private readonly permissions: DelegatedPermissionsService) {}

  @Get()
  get(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('eventMemberId', new ParseUUIDPipe()) eventMemberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissions.get(eventId, eventMemberId, user.id);
  }

  @Put()
  @UseGuards(CsrfGuard)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('eventMemberId', new ParseUUIDPipe()) eventMemberId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDelegatedPermissionsDto,
  ) {
    return this.permissions.update(eventId, eventMemberId, user, dto);
  }
}
