import { PaginationDto } from '../../common/dto/pagination.dto';

// GET /companies და /companies/admin/all-ის query პარამეტრები — pagination-ის
// გარდა ცალკე ფილტრი ჯერ არ სჭირდება (category/branches მოდულების იგივე
// pattern-ის თანმიმდევრობისთვის ცალკე ფაილად გატანილია).
export class FindCompaniesDto extends PaginationDto {}
