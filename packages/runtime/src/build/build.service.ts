import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BuildProviderUnavailableError } from '@magically/shared/errors';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

export const BUILD_PROVIDERS = 'BUILD_PROVIDERS';

@Injectable()
export class BuildService {
  private readonly logger = new Logger(BuildService.name);

  constructor(
    @Inject(BUILD_PROVIDERS) private readonly providers: BuildProvider[],
    private readonly config: ConfigService,
  ) {}

  async build(input: BuildInput): Promise<BuildOutput> {
    const preference = this.config.get<string>('BUILD_PROVIDER', 'auto');

    // Explicit preference: use that provider or fail
    if (preference !== 'auto') {
      const provider = this.providers.find((p) => p.name === preference);
      if (provider && await provider.isAvailable()) {
        this.logger.log(`Building ${input.agentId}@${input.version} via ${provider.name} (configured)`);
        return provider.build(input);
      }
      throw new BuildProviderUnavailableError(
        `BUILD_PROVIDER=${preference} but provider is not available`,
      );
    }

    // Auto: try each in order
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        this.logger.log(`Building ${input.agentId}@${input.version} via ${provider.name} (auto)`);
        return provider.build(input);
      }
    }

    throw new BuildProviderUnavailableError(
      `Tried: ${this.providers.map((p) => p.name).join(', ')}`,
    );
  }
}
