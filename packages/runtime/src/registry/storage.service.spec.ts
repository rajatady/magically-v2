import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock the entire @aws-sdk/client-s3 module
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'put' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'get' })),
}));

describe('StorageService', () => {
  let service: StorageService;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        AWS_REGION: 'auto',
        AWS_ENDPOINT_URL_S3: 'https://fly.storage.tigris.dev',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        BUCKET_NAME: 'magically-registry',
      };
      return map[key];
    }),
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        BUCKET_NAME: 'magically-registry',
      };
      if (!map[key]) throw new Error(`Missing ${key}`);
      return map[key];
    }),
  };

  beforeEach(() => {
    service = new StorageService(mockConfig as ConfigService);
    mockSend.mockReset();
  });

  describe('uploadBundle', () => {
    it('uploads a buffer to S3 and returns the URL', async () => {
      mockSend.mockResolvedValue({});
      const buffer = Buffer.from('fake-bundle-data');

      const url = await service.uploadBundle('test-agent', '1.0.0', buffer);

      expect(url).toBe('https://fly.storage.tigris.dev/magically-registry/agents/test-agent/1.0.0/bundle.tar.gz');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadBundle', () => {
    it('downloads a bundle from S3 and returns a Buffer', async () => {
      const bodyContent = Buffer.from('downloaded-bundle-data');
      mockSend.mockResolvedValue({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(bodyContent)),
        },
      });

      const result = await service.downloadBundle(
        'https://fly.storage.tigris.dev/magically-registry/agents/test-agent/1.0.0/bundle.tar.gz',
      );

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('downloaded-bundle-data');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws when S3 returns an error', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchKey'));

      await expect(
        service.downloadBundle(
          'https://fly.storage.tigris.dev/magically-registry/agents/ghost/1.0.0/bundle.tar.gz',
        ),
      ).rejects.toThrow('NoSuchKey');
    });
  });
});
