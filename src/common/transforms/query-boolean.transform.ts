// class-transformer-ის @Type(() => Boolean) query string-ისთვის გამოუსადეგარია —
// შიგნით უბრალო Boolean(value)-ია, ხოლო ნებისმიერი არაცარიელი სტრიქონი
// (მათ შორის "false") ისე ითვლის, თითქოს true-ია. ეს ფილტრს, რომელიც
// ...=false-ს ელოდება, არაფუნქციურს ხდის (ყოველთვის true ვარდება).
//
// გამოყენება: @Transform(toQueryBoolean) DTO ველზე, IsBoolean-ის წინ.
export const toQueryBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
