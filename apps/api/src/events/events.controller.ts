import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateEventDto, MyEventsQueryDto, UpdateEventDto } from './dto/event.dto';
import { EventsService } from './events.service';
import { DelegatedPermissionsService } from './delegated-permissions.service';
import { EventProgressService } from './event-progress.service';

@Controller()
@UseGuards(SessionAuthGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly delegatedPermissions: DelegatedPermissionsService,
    private readonly progress: EventProgressService,
  ) {}

  @Get('me/events')
  getMyEvents(@CurrentUser() user: AuthUser, @Query() query: MyEventsQueryDto) {
    return this.events.getMyEvents(user.id, query);
  }

  @Post('events')
  @UseGuards(CsrfGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Get('events/:eventId')
  getById(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.events.getById(eventId, user.id);
  }

  @Get('events/:eventId/progress')
  getProgress(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.progress.forUser(eventId, user.id);
  }

  @Patch('events/:eventId')
  @UseGuards(CsrfGuard)
  update(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateEventDto) {
    return this.events.update(eventId, user, dto);
  }

  @Post('events/:eventId/archive')
  @UseGuards(CsrfGuard)
  archive(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.events.archive(eventId, user);
  }

  @Get('events/:eventId/membership/me')
  getMembership(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.events.getMyMembership(eventId, user.id);
  }

  @Get('events/:eventId/membership/me/permissions')
  getMyEffectivePermissions(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.delegatedPermissions.getCurrent(eventId, user.id);
  }
}
