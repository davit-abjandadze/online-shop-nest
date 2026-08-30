import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ერთი დღის სამუშაო საათები — `null`/გამოტოვება ნიშნავს დახურულ დღეს.
export class BranchDayHoursDto {
  @ApiPropertyOptional({ example: '09:30' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'დროის ფორმატი უნდა იყოს HH:mm' })
  open!: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'დროის ფორმატი უნდა იყოს HH:mm' })
  close!: string;
}

export class BranchWorkingHoursDto {
  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  mon?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  tue?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  wed?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  thu?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  fri?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  sat?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  sun?: BranchDayHoursDto | null;
}
