export interface RuntimeConfig {
  base: string;
  system?: string[];
  install?: string;
}

export function generateDockerfile(runtime: RuntimeConfig): string {
  const lines = [
    `FROM ${runtime.base}`,
    'WORKDIR /agent',
    'COPY . /agent/',
  ];

  if (runtime.system && runtime.system.length > 0) {
    lines.push(`RUN apt-get update && apt-get install -y ${runtime.system.join(' ')} && rm -rf /var/lib/apt/lists/*`);
  }

  if (runtime.install) {
    lines.push(`RUN ${runtime.install}`);
  }

  return lines.join('\n');
}
