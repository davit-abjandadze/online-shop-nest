import { IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'გვერდის ნომერი (იწყება 1-დან)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'ჩანაწერების რაოდენობა თითო გვერდზე',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // დაცვა ბაზის გადატვირთვისგან
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'დალაგების ველი',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'დალაგების მიმართულება',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    default: 'DESC',
  })
  @IsOptional()
  // ⚠️ @IsIn-ის დამატებამდე `order=asc` (პატარა ასოებით) უჩუმრად DESC-ზე
  // ფოლბექდებოდა სერვისებში (`order === 'ASC' ? ... : ...`), ანუ არსებული
  // კლიენტები შეიძლება პატარა ასოებით აგზავნიდნენ. რომ ეს 400-ად არ იქცეს,
  // ვალიდაციამდე ვანორმალიზებთ დიდ ასოებზე — უცნობი მნიშვნელობა (მაგ. `foo`)
  // კვლავ 400-ს იღებს, რაც order-by injection-ის დაცვის მიზანი იყო.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * sortBy პარამეტრი კონტროლერში მომხმარებლის query string-იდან პირდაპირ მოდის —
 * PaginationDto საერთოა ყველა მოდულისთვის და ვერ იცის, რომელი სვეტებია
 * ვალიდური კონკრეტული ენტითისთვის, ამიტომ თავად ველზე allow-list ვერ დაისმის.
 *
 * ამის ნაცვლად ყველა სერვისმა, რომელიც sortBy-ს პირდაპირ QueryBuilder.orderBy()-ში
 * აწვდის, უნდა გაატაროს ის ამ ფუნქციაში — თუ სვეტი დაშვებულ სიაში არაა, ვაბრუნებთ
 * fallback-ს (ნაცვლად raw string-ის ინტერპოლაციისა, რაც order-by injection-ის
 * რისკს შექმნიდა).
 */
export function resolveSortColumn(
  sortBy: string | undefined,
  allowedColumns: ReadonlySet<string> | readonly string[],
  fallback: string,
): string {
  const allowed =
    allowedColumns instanceof Set ? allowedColumns : new Set(allowedColumns);
  return sortBy && allowed.has(sortBy) ? sortBy : fallback;
}
