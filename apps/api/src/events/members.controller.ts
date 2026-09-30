import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateEventMemberDto, EventMembersQueryDto, RemoveEventMemberDto, UpdateEventMemberDto } from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('events/:eventId/members')
@UseGuards(SessionAuthGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser, @Query() query: EventMembersQueryDto) {
    return this.members.list(eventId, user.id, query);
  }

  @Post()
  @UseGuards(CsrfGuard)
  add(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateEventMemberDto) {
    return this.members.add(eventId, user, dto);
  }

  @Patch(':eventMemberId')
  @UseGuards(CsrfGuard)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('eventMemberId', new ParseUUIDPipe()) eventMemberId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEventMemberDto,
  ) {
    return this.members.update(eventId, eventMemberId, user, dto);
  }

  @Delete(':eventMemberId')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async remove(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('eventMemberId', new ParseUUIDPipe()) eventMemberId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RemoveEventMemberDto,
  ): Promise<void> {
    await this.members.remove(eventId, eventMemberId, user, dto);
  }
}
