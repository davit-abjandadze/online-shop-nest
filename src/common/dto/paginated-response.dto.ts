import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 150, description: 'ჩანაწერების საერთო რაოდენობა' })
  total!: number;

  @ApiProperty({ example: 1, description: 'მიმდინარე გვერდი' })
  page!: number;

  @ApiProperty({ example: 10, description: 'ჩანაწერები თითო გვერდზე' })
  limit!: number;

  @ApiProperty({ example: 15, description: 'გვერდების საერთო რაოდენობა' })
  totalPages!: number;

  @ApiProperty({ example: true, description: 'არის თუ არა შემდეგი გვერდი' })
  hasNext!: boolean;

  @ApiProperty({ example: false, description: 'არის თუ არა წინა გვერდი' })
  hasPrevious!: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'მონაცემთა მასივი' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto, description: 'პაგინაციის მეტაინფორმაცია' })
  meta: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    };
  }
}