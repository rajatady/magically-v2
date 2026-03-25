import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';

export class ChatDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsEnum(['chat', 'build', 'edit', 'task'])
  mode?: 'chat' | 'build' | 'edit' | 'task';
}
