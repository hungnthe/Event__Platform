import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client; private readonly bucket: string;
  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({ endpoint: config.getOrThrow<string>('S3_ENDPOINT'), region: config.getOrThrow<string>('S3_REGION'), forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'), credentials: { accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'), secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY') } });
  }
  async isHealthy(): Promise<boolean> { try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); return true; } catch { return false; } }
  async putPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async getPrivateObject(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!(result.Body instanceof Readable)) throw new Error('Object storage returned a non-stream response');
    return result.Body;
  }
  async deletePrivateObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
