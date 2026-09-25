import { Transform } from 'class-transformer';

/**
 * ელფოსტის ნორმალიზაცია (trim + lowercase) ValidationPipe-ის transform-ის
 * ეტაპზე — `Victim@x.com` და `victim@x.com` ერთი და იგივე ანგარიშია.
 * ამის გარეშე ერთი ელფოსტით ორი ანგარიში იქმნებოდა და Google-ით შესვლისას
 * (Google ყოველთვის lowercase-ს აბრუნებს) სხვა ანგარიშს მივაბამდით.
 * @IsEmail-ზე ადრე სრულდება, რადგან class-transformer ვალიდაციამდე ეშვება.
 */
export function NormalizeEmail() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
