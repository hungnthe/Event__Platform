import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CalendarService } from './calendar.service';
import { CalendarItemsQueryDto } from './dto/calendar.dto';

@Controller('calendar')
@UseGuards(SessionAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('items')
  listItems(@CurrentUser() user: AuthUser, @Query() query: CalendarItemsQueryDto) {
    return this.calendar.listItems(user.id, query);
  }

  @Get('items/:sourceType/:sourceId')
  getItem(
    @CurrentUser() user: AuthUser,
    @Param('sourceType') sourceType: string,
    @Param('sourceId', new ParseUUIDPipe()) sourceId: string,
  ) {
    return this.calendar.getItemDetail(user.id, sourceType, sourceId);
  }
}
