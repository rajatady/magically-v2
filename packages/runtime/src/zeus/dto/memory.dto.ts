import { IsString, IsOptional, MinLength } from 'class-validator';

export class SetMemoryDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  value!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  source?: string;
}
