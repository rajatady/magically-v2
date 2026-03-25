import { IsString, IsOptional, IsObject } from 'class-validator';

export class AgentActionDto {
  @IsString()
  action!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
