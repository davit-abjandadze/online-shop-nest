import { IsUUID, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// POST /categories/:id/attributes-ის body — არსებული Attribute-ის (ID-ით)
// მიბმა ამ კატეგორიის attribute set-ზე.
export class AddCategoryAttributeDto {
  @ApiProperty({
    description: 'მისაბმელი Attribute-ის ID',
    example: '5b1a2c3e-...-uuid',
  })
  @IsUUID('4', { message: 'attributeId უნდა იყოს ვალიდური UUID' })
  attributeId!: string;

  @ApiPropertyOptional({
    description: 'დალაგების რიგი ამ კატეგორიის attribute set-ში',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    description:
      'override — სავალდებულოა თუ არა ეს attribute ამ კონკრეტულ კატეგორიაზე ' +
      '(გამოტოვებისას attribute-ის საკუთარი isRequired გამოიყენება უცვლელად)',
  })
  @IsOptional()
  @IsBoolean()
  isRequiredOverride?: boolean;
}
