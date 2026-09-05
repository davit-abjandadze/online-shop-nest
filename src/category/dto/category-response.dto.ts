import { Category } from '../entities/category.entity';

// Swagger-ის დოკუმენტაციისთვის — create/update handler-ები ბრტყელ Category
// entity-ს აბრუნებენ, არა { statusCode, message, data } envelope-ს (ეს
// ადრე რეალურ response shape-ს არ ემთხვეოდა, იხ. auth-ის login-response.
// dto.ts-ის იგივე ჩასწორება). ცალკე კლასია (Category-ის pass-through), რომ
// @ApiResponse({ type }) ერთი ცნობილი, სახელიანი schema-დ დარჩეს.
export class CategoryResponseDto extends Category {}
