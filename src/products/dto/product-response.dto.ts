import { Product } from '../entities/product.entity';

// Swagger-ის დოკუმენტაციისთვის — create/update handler-ები ბრტყელ Product
// entity-ს აბრუნებენ, არა { statusCode, message, data } envelope-ს (ეს
// ადრე რეალურ response shape-ს არ ემთხვეოდა, იხ. auth-ის login-response.
// dto.ts-ის იგივე ჩასწორება). ცალკე კლასია (Product-ის pass-through), რომ
// @ApiResponse({ type }) ერთი ცნობილი, სახელიანი schema-დ დარჩეს.
export class ProductResponseDto extends Product {}
