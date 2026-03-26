/**
 * Abstract build provider for building and pushing container images.
 *
 * BuildProvider is SEPARATE from ComputeProvider:
 * - ComputeProvider runs containers (execute agent code)
 * - BuildProvider builds images (produce artifacts for later execution)
 *
 * Only agents with a `runtime` block in their manifest need image builds.
 */

export interface BuildInput {
  agentId: string;
  version: string;
  bundlePath: string;            // local temp dir with extracted agent bundle
  manifest: Record<string, any>;
}

export interface BuildOutput {
  imageRef: string;              // Primary image ref (GHCR)
  flyImageRef?: string;          // Fly registry copy (if pushed)
  durationMs: number;
}

export abstract class BuildProvider {
  abstract readonly name: string;

  /** Build a container image from an agent bundle and push to a registry. */
  abstract build(input: BuildInput): Promise<BuildOutput>;

  /** Check if this provider is available/configured. */
  abstract isAvailable(): Promise<boolean>;
}
