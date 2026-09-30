import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { WorkflowStageTasksQueryDto } from './dto/task.dto';
import { InitializeWorkflowDto } from './dto/workflow.dto';
import { TasksService } from './tasks.service';
import { WorkflowService } from './workflow.service';

@Controller('events/:eventId/workflow')
@UseGuards(SessionAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly tasks: TasksService,
  ) {}

  @Get()
  get(@Param('eventId', new ParseUUIDPipe()) eventId: string, @CurrentUser() user: AuthUser) {
    return this.workflow.get(eventId, user.id);
  }

  @Get('stages/:stageId/tasks')
  listStageTasks(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('stageId', new ParseUUIDPipe()) stageId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: WorkflowStageTasksQueryDto,
  ) {
    return this.tasks.listForWorkflowStage(eventId, stageId, user.id, query);
  }

  @Post('initialize')
  @UseGuards(CsrfGuard)
  initialize(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InitializeWorkflowDto,
  ) {
    return this.workflow.initialize(eventId, user.id, dto);
  }
}
