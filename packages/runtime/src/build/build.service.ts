import { Injectable, Inject, Logger } from '@nestjs/common';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

export const BUILD_PROVIDERS = 'BUILD_PROVIDERS';

@Injectable()
export class BuildService {
  private readonly logger = new Logger(BuildService.name);

  constructor(
    @Inject(BUILD_PROVIDERS) private readonly providers: BuildProvider[],
  ) {}

  async build(input: BuildInput): Promise<BuildOutput> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        this.logger.log(`Building ${input.agentId}@${input.version} via ${provider.name}`);
        return provider.build(input);
      }
    }

    throw new Error('No build provider available. Install Docker or configure Fly.');
  }
}
