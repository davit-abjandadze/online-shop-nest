import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({ description: 'დამატებითი კომენტარი კურიერისთვის' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'ნაგულისხმევ მისამართად დაყენება',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
