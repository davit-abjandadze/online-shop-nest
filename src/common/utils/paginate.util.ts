import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { resolveSortColumn } from '../dto/pagination.dto';

// page/limit/sortBy/order query-პარამეტრებიდან QueryBuilder-ის ერთნაირი
// "კუდის" აწყობა — category/attribute/hero-slides/product-sliders/products
// service-ებში სიტყვასიტყვით მეორდებოდა (skip/take, sortBy-ის allow-list-ით
// resolve, PaginatedResponseDto-ის აწყობა). თითოეული service-ის საკუთარი
// ფილტრები/join-ები (WHERE-ები) ამ ფუნქციამდე, თავად qb-ზე უნდა იყოს
// უკვე დამატებული — აქ მხოლოდ საერთო "დალაგება + გვერდიანობა + envelope"
// ნაწილია გატანილი.
export interface PaginateOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
}

export interface PaginateConfig {
  // ნაგულისხმევი მიმართულება, თუ options.order არც 'ASC'-ია და არც 'DESC'
  // (დეფოლტად ეს DTO-შივე ხდება, აქ მხოლოდ დამატებითი დაცვაა).
  defaultOrder?: 'ASC' | 'DESC';
  // true, თუ qb-ს უკვე აქვს პირველადი orderBy() დაყენებული (მაგ. secondary
  // sort join-ის სვეტზე) — ამ შემთხვევაში sortBy-ის სვეტი addOrderBy()-ით
  // ემატება, orderBy()-ის ნაცვლად, რომ არსებული პირველადი დალაგება არ გადაეწეროს.
  useAddOrderBy?: boolean;
  // დამატებითი, sortBy-ის შემდეგ დასამატებელი დალაგების სვეტი (მაგ.
  // ჩაშენებული item-ების sortOrder) — addOrderBy()-ით.
  secondaryOrderBy?: { column: string; direction?: 'ASC' | 'DESC' };
}

export async function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  { page = 1, limit = 10, sortBy, order }: PaginateOptions,
  allowedSortColumns: ReadonlySet<string> | readonly string[],
  defaultSortColumn: string,
  config: PaginateConfig = {},
): Promise<PaginatedResponseDto<T>> {
  const {
    defaultOrder = 'DESC',
    useAddOrderBy = false,
    secondaryOrderBy,
  } = config;

  const sortColumn = resolveSortColumn(
    sortBy,
    allowedSortColumns,
    defaultSortColumn,
  );
  const direction = order === 'ASC' || order === 'DESC' ? order : defaultOrder;

  if (useAddOrderBy) {
    qb.addOrderBy(`${alias}.${sortColumn}`, direction);
  } else {
    qb.orderBy(`${alias}.${sortColumn}`, direction);
  }
  if (secondaryOrderBy) {
    qb.addOrderBy(secondaryOrderBy.column, secondaryOrderBy.direction ?? 'ASC');
  }

  qb.skip((page - 1) * limit).take(limit);

  const [data, total] = await qb.getManyAndCount();
  return new PaginatedResponseDto(data, total, page, limit);
}
