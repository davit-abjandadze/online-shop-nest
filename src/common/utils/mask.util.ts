// მგრძნობიარე ველების (პირადი ნომერი, ტელეფონი) ნიღბვის დამხმარეები —
// გამოიყენება იქ, სადაც მთლიანი მნიშვნელობა კლიენტს არ სჭირდება (მაგ. login/register
// პასუხში), რომ ეს მონაცემები არ გავრცელდეს response body-ს ლოგებში/error-reporting-ში.

// პირადი ნომერი (11 ციფრი) — ვტოვებთ მხოლოდ ბოლო 2 ციფრს, დანარჩენს ვფარავთ.
// მაგ: "01234567890" → "*********90"
export function maskPersonalNumber(value?: string | null): string | undefined {
  if (!value) return value ?? undefined;
  const visibleCount = 2;
  if (value.length <= visibleCount) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleCount) + value.slice(-visibleCount);
}

// ტელეფონის ნომერი — ვტოვებთ ბოლო 4 ციფრს, დანარჩენს ვფარავთ.
// მაგ: "+995555123456" → "*********3456"
export function maskPhoneNumber(value?: string | null): string | undefined {
  if (!value) return value ?? undefined;
  const visibleCount = 4;
  if (value.length <= visibleCount) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleCount) + value.slice(-visibleCount);
}
