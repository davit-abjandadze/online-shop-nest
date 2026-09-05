// JWT (access თუ password-reset ტიპის) ტოკენი stateless არის — ხელმოწერა/ვადა
// მისი გაცემის მომენტში ფიქსირდება და პაროლის შემდგომი ცვლილება მას ავტომატურად
// არ აბათილებს. ორივე ადგილას, სადაც ეს შემოწმება საჭიროა — JwtStrategy.validate
// (ჩვეულებრივი access token) და AuthService.resetPassword (reset token) — ერთი
// და იგივე წესი უნდა გავრცელდეს, რომ მომავალში ერთ ადგილას ცვლილება მეორეს არ
// გამორჩეს.
//
// ⚠️ სიზუსტე: JWT-ის `iat` წამების სიზუსტისაა (Math.floor(Date.now()/1000)),
// passwordChangedAt კი მილიწამების. პირდაპირი შედარებით (iat * 1000 <
// passwordChangedAt) იმავე წამში გაცემული სრულიად ვალიდური ტოკენიც
// "მოძველებულად" ჩაითვლებოდა — მაგ. პაროლის შეცვლა 10:00:00.400-ზე, მაშინვე
// login 10:00:00.900-ზე გვაძლევს iat*1000 = 10:00:00.000 < 10:00:00.400 → 401.
// ამიტომ ორივე მხარეს წამებამდე ვამრგვალებთ (floor) და მკაცრ უტოლობას
// ვიყენებთ: მხოლოდ პაროლის ცვლილების წამზე *მკაცრად ადრე* გაცემული ტოკენი
// ბათილდება. იმავე წამში გაცემულს ვენდობით — ერთწამიანი ფანჯარა
// (მოპარული ტოკენის გამოყენებადობა) გაცილებით ნაკლები რისკია, ვიდრე
// ლეგიტიმური მომხმარებლის სისტემატური გამოგდება.
export function isTokenIssuedBeforePasswordChange(
  iat: unknown,
  passwordChangedAt: Date | string | null | undefined,
): boolean {
  if (!passwordChangedAt || typeof iat !== 'number') return false;
  const changedAtMs = new Date(passwordChangedAt).getTime();
  if (Number.isNaN(changedAtMs)) return false;
  return Math.floor(iat) < Math.floor(changedAtMs / 1000);
}
