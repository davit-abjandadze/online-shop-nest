// ცალკე ფაილშია გატანილი (Order/OrderStatusHistory entity-ებისგან
// დამოუკიდებლად), რომ ორივემ პირდაპირ, წრიული import-ის გარეშე შეძლოს ამის
// გამოყენება — @Column({ enum: OrderStatus }) დეკორატორს კონკრეტული enum
// object მოდულის load-ის დროსვე, სინქრონულად სჭირდება; Order ↔
// OrderStatusHistory-ს ორმხრივი (ManyToOne/OneToMany) კავშირი lazy
// thunk-ებით (() => Order) მოგვარებულია და უსაფრთხოა, მაგრამ ეს enum, რომ
// ერთი entity-დან პირდაპირ მეორეს import-ებოდა, TypeORM-ს "missing enum
// property" შეცდომას აწვდიდა (require-ის ციკლში ერთი მხარე ჯერ კიდევ არ
// იყო სრულად built, module.exports.OrderStatus იმ მომენტში undefined იყო).
export enum OrderStatus {
  PENDING = 'pending', // შეიქმნა, ელოდება გადახდას
  PAID = 'paid',
  PROCESSING = 'processing', // მიმდინარეობს დამუშავება/გაგზავნის მომზადება
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired', // ვადა გავიდა (გადაუხდელი), ავტომატურად cron-ის მიერ
}
