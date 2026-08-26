import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Attribute } from '../../attribute/entities/attribute.entity';
import { AttributeOption } from '../../attribute/entities/attribute-option.entity';

// ProductAttributeValue — კონკრეტული პროდუქტის კონკრეტული Attribute-ის
// მნიშვნელობა. მხოლოდ ერთი value-სვეტი ივსება რეალურად, attribute.type-ის
// მიხედვით (select → attributeOptionId, number/range → valueNumber,
// text → valueText, boolean → valueBoolean). multi_select-ისთვის ერთ
// პროდუქტს, ერთ attribute-ზე, რამდენიმე row ექნება — თითო არჩეულ
// option-ზე ერთი (იხ. ProductsService.setAttributeValues).
@Entity()
@Unique(['productId', 'attributeId', 'attributeOptionId'])
export class ProductAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  @ManyToOne(() => Attribute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attributeId' })
  attribute!: Attribute;

  @Column()
  attributeId!: string;

  // მხოლოდ select/multi_select ტიპებისთვის — არჩეული option.
  @ManyToOne(() => AttributeOption, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'attributeOptionId' })
  attributeOption?: AttributeOption | null;

  @Column({ type: 'uuid', nullable: true })
  attributeOptionId?: string | null;

  // მხოლოდ text ტიპისთვის.
  @Column({ type: 'varchar', nullable: true })
  valueText?: string | null;

  // მხოლოდ number/range ტიპებისთვის.
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  valueNumber?: string | null;

  // მხოლოდ boolean ტიპისთვის.
  @Column({ type: 'boolean', nullable: true })
  valueBoolean?: boolean | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
