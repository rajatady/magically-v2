import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Abstract storage for agent bundles.
 * Default implementation uses S3-compatible storage (Tigris).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  async uploadBundle(agentId: string, version: string, data: Buffer): Promise<string> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.config.get('AWS_REGION') ?? 'auto',
      endpoint: this.config.get('AWS_ENDPOINT_URL_S3'),
      credentials: {
        accessKeyId: this.config.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });

    const bucket = this.config.getOrThrow('BUCKET_NAME');
    const key = `agents/${agentId}/${version}/bundle.tar.gz`;

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: 'application/gzip',
    }));

    const url = `${this.config.get('AWS_ENDPOINT_URL_S3')}/${bucket}/${key}`;
    this.logger.log(`Uploaded bundle: ${url}`);
    return url;
  }
}
