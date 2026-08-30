import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BranchWorkingHoursDto } from './working-hours.dto';

export class CreateBranchDto {
  @ApiProperty({ example: 'ჯ. თბილისი, ვაკე' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: '0177, უნივერსიტეტის ქ. N6' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: '(032) 215 40 40' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiPropertyOptional({ example: 'info@amboli.ge' })
  @IsOptional()
  @IsEmail({}, { message: 'ელფოსტა არასწორი ფორმატისაა' })
  email?: string;

  @ApiProperty({ description: 'რუკის განედი (latitude)', example: 41.7225 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'რუკის გრძედი (longitude)', example: 44.7635 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiProperty({ type: BranchWorkingHoursDto })
  @ValidateNested()
  @Type(() => BranchWorkingHoursDto)
  workingHours!: BranchWorkingHoursDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
