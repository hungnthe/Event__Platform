import { BadRequestException } from '@nestjs/common';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const supportedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'application/zip',
  'application/x-zip-compressed',
]);

export interface UploadedAttachmentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export function validateAttachmentFile(file: UploadedAttachmentFile): void {
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) throw new BadRequestException({ error: { code: 'ATTACHMENT_INVALID_SIZE', message: 'Tệp phải có kích thước tối đa 10 MB.' } });
  if (!supportedMimeTypes.has(file.mimetype)) throw new BadRequestException({ error: { code: 'ATTACHMENT_INVALID_TYPE', message: 'Định dạng tệp không được hỗ trợ.' } });
  if (!hasExpectedSignature(file.buffer, file.mimetype)) throw new BadRequestException({ error: { code: 'ATTACHMENT_INVALID_TYPE', message: 'Nội dung tệp không khớp với định dạng khai báo.' } });
}

function hasExpectedSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'application/msword' || mimeType === 'application/vnd.ms-excel') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}
