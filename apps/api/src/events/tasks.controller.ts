import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateTaskDto, EventTasksQueryDto, MyTasksQueryDto, ReplaceTaskAssigneesDto, UpdateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@Controller()
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('me/tasks')
  listMine(@CurrentUser() user: AuthUser, @Query() query: MyTasksQueryDto) {
    return this.tasks.listMine(user.id, query);
  }

  @Get('events/:eventId/tasks')
  listForEvent(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser, @Query() query: EventTasksQueryDto) {
    return this.tasks.listForEvent(eventId, user.id, query);
  }

  @Post('events/:eventId/tasks')
  @UseGuards(CsrfGuard)
  create(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(eventId, user, dto);
  }

  @Get('tasks/:taskId')
  getById(@Param('taskId', new ParseUUIDPipe()) taskId: string, @CurrentUser() user: AuthUser) {
    return this.tasks.getById(taskId, user.id);
  }

  @Patch('tasks/:taskId')
  @UseGuards(CsrfGuard)
  update(@Param('taskId', new ParseUUIDPipe()) taskId: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(taskId, user, dto);
  }

  @Patch('tasks/:taskId/status')
  @UseGuards(CsrfGuard)
  updateStatus(@Param('taskId', new ParseUUIDPipe()) taskId: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateTaskStatusDto) {
    return this.tasks.updateStatus(taskId, user, dto);
  }

  @Put('tasks/:taskId/assignees')
  @UseGuards(CsrfGuard)
  replaceAssignees(@Param('taskId', new ParseUUIDPipe()) taskId: string, @CurrentUser() user: AuthUser, @Body() dto: ReplaceTaskAssigneesDto) {
    return this.tasks.replaceAssignees(taskId, user, dto);
  }

  @Post('tasks/:taskId/archive')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async archive(@Param('taskId', new ParseUUIDPipe()) taskId: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.tasks.archive(taskId, user);
  }
}
