import { BadRequestException } from '@nestjs/common';
import { validateAttachmentFile } from './file-validation';

describe('validateAttachmentFile', () => {
  it('accepts a PDF with a matching signature', () => {
    expect(() => validateAttachmentFile({ buffer: Buffer.from('%PDF-1.7'), mimetype: 'application/pdf', originalname: 'brief.pdf', size: 8 })).not.toThrow();
  });
  it('rejects a declared PDF without a PDF signature', () => {
    expect(() => validateAttachmentFile({ buffer: Buffer.from('not a PDF'), mimetype: 'application/pdf', originalname: 'brief.pdf', size: 9 })).toThrow(BadRequestException);
  });
});
