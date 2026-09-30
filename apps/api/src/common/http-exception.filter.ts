import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

function hasErrorEnvelope(value: unknown): value is { error: Record<string, unknown> } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'object' && value.error !== null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp(); const response = context.getResponse<Response>(); const request = context.getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttp ? exception.getResponse() : undefined;
    if (hasErrorEnvelope(exceptionResponse)) {
      response.status(status).json({ error: { ...exceptionResponse.error, requestId: request.header('x-request-id') } });
      return;
    }
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      response.status(status).json({ ...exceptionResponse, requestId: request.header('x-request-id') });
      return;
    }
    response.status(status).json({ statusCode: status, message: isHttp ? exception.message : 'Internal server error', timestamp: new Date().toISOString(), path: request.url, requestId: request.header('x-request-id') });
  }
}
