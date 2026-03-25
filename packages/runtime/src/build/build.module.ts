import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BuildProcessor } from './build.processor';
import { BuildService, BUILD_PROVIDERS } from './build.service';
import { GitHubActionsBuildProvider } from './github-actions-build-provider';
import { DockerBuildProvider } from './docker-build-provider';
import { FlyBuildProvider } from './fly-build-provider';
import { StorageService } from '../registry/storage.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-build' }),
  ],
  providers: [
    BuildProcessor,
    GitHubActionsBuildProvider,
    DockerBuildProvider,
    FlyBuildProvider,
    {
      provide: BUILD_PROVIDERS,
      useFactory: (
        ghActions: GitHubActionsBuildProvider,
        docker: DockerBuildProvider,
        fly: FlyBuildProvider,
      ) => [ghActions, docker, fly],
      inject: [GitHubActionsBuildProvider, DockerBuildProvider, FlyBuildProvider],
    },
    BuildService,
    StorageService,
  ],
  exports: [BuildService],
})
export class BuildModule {}
