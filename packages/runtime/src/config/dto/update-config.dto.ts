import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  openrouterApiKey?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsString()
  zeusName?: string;

  @IsOptional()
  @IsString()
  zeusPersonality?: string;

  @IsOptional()
  @IsEnum(['dark', 'light', 'auto'])
  theme?: 'dark' | 'light' | 'auto';

  @IsOptional()
  @IsString()
  accentColor?: string;
}
