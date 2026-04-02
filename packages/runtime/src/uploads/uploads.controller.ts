import { Controller, Post, Req, Res, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { StorageService } from '../registry/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  async upload(@Req() req: Request, @Res() res: Response) {
    const contentType = req.headers['content-type'] ?? 'application/octet-stream';
    const fileName = (req.headers['x-file-name'] as string) ?? `upload-${randomUUID()}`;
    const fileSize = parseInt(req.headers['content-length'] ?? '0', 10);

    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE})`);
    }

    // Collect raw body into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    const data = Buffer.concat(chunks);

    if (data.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large: ${data.length} bytes (max ${MAX_FILE_SIZE})`);
    }

    const timestamped = `${Date.now()}-${fileName}`;
    const url = await this.storage.uploadFile(timestamped, data, contentType);

    res.json({
      url,
      pathname: timestamped,
      contentType,
      size: data.length,
    });
  }
}
