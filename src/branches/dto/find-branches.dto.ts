import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// GET /branches და /branches/admin/all-ის query პარამეტრები — pagination +
// სურვილისამებრ კონკრეტული კომპანიით გაფილტვრა.
export class FindBranchesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'გაფილტვრა კონკრეტული კომპანიის მიხედვით',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
