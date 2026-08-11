import { IsOptional, IsInt, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApprovalStatus, CreatorType } from '../entities/question.entity';

export class FindQuestionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'კატეგორიის ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category?: number;

  @ApiPropertyOptional({
    description: 'აქტიურობის სტატუსი (ვადაგასული კითხვები ავტომატურად ითვლება inactive-ად)',
    enum: ['active', 'inactive'],
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({
    description: 'admin-ის განხილვის სტატუსი (მხ. user-ის დასმულ კითხვებს ეხება; admin-ის კითხვები ყოველთვის approved-ია)',
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'ვინ დასვა კითხვა — admin თუ user',
    enum: CreatorType,
  })
  @IsOptional()
  @IsEnum(CreatorType)
  creatorType?: CreatorType;
}
