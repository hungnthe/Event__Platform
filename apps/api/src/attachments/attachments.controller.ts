import { BadRequestException, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { type AuthenticatedRequest } from '../auth/authenticated-request';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AttachmentsService } from './attachments.service';
import { MAX_ATTACHMENT_BYTES } from './file-validation';

@Controller('tasks/:taskId/attachments')
@UseGuards(SessionAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } }))
  async upload(@Param('taskId', new ParseUUIDPipe()) taskId: string, @UploadedFile() file: Express.Multer.File | undefined, @Req() request: AuthenticatedRequest) {
    if (!file) throw new BadRequestException({ error: { code: 'ATTACHMENT_REQUIRED', message: 'Vui lòng chọn tệp đính kèm.' } });
    return this.attachments.upload(taskId, requireUserId(request), file);
  }

  @Get(':attachmentId/download')
  async download(@Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string, @Req() request: AuthenticatedRequest, @Res() response: Response): Promise<void> {
    const result = await this.attachments.download(taskId, attachmentId, requireUserId(request));
    response.setHeader('content-type', result.attachment.mimeType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.originalFileName)}`);
    result.stream.pipe(response);
  }

  @Delete(':attachmentId')
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async remove(@Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.attachments.remove(taskId, attachmentId, requireUserId(request));
  }
}

function requireUserId(request: AuthenticatedRequest): string {
  if (!request.user) throw new BadRequestException({ error: { code: 'AUTH_SESSION_REQUIRED', message: 'Cần đăng nhập để tiếp tục.' } });
  return request.user.id;
}
