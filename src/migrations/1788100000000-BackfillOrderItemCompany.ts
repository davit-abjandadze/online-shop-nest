import { MigrationInterface, QueryRunner } from 'typeorm';

// 1788090000000-AddCompanyToOrderItem-მა companyId სვეტი მხოლოდ დაამატა —
// მანამდე შექმნილ order_item-ებს companyId NULL დარჩათ, რის გამოც
// სტატისტიკაში კომპანიის ფილტრით შემოსავალი ბევრად ნაკლები ჩანდა, ვიდრე
// "ყველა კომპანია"-ს ჯამი. ძველ ჩანაწერებს product.companyId-ით ვავსებთ
// (იმ პროდუქტებისთვის, რომლებიც ჯერ კიდევ არსებობს — წაშლილი პროდუქტის
// item-ებს კომპანიის გაგება აღარ შეიძლება და NULL რჩება).
export class BackfillOrderItemCompany1788100000000 implements MigrationInterface {
  name = 'BackfillOrderItemCompany1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "order_item" oi
      SET "companyId" = p."companyId"
      FROM "product" p
      WHERE oi."productId" = p."id"
        AND oi."companyId" IS NULL
        AND p."companyId" IS NOT NULL
    `);
  }

  // backfill-ის შემდეგ ვეღარ გავარჩევთ, რომელი მნიშვნელობა ჩაიწერა აქ და
  // რომელი — შეკვეთის შექმნისას, ამიტომ down განზრახ არაფერს აკეთებს.
  public async down(): Promise<void> {}
}
