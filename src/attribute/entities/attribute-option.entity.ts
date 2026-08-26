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
import { Attribute } from './attribute.entity';

// AttributeOption — attribute-ის კონკრეტული შესაძლო მნიშვნელობა
// (მაგ. attribute "ბრენდი" → option-ები "Banner", "Mutlu"...). მხოლოდ
// select/multi_select ტიპის attribute-ებს აქვთ options.
@Entity()
@Unique(['attribute', 'code']) // ერთი attribute-ის ფარგლებში კოდი უნიკალურია
export class AttributeOption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Attribute, (attribute) => attribute.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attributeId' })
  attribute!: Attribute;

  @Column()
  attributeId!: string;

  @Column()
  valueKa!: string;

  @Column()
  valueEn!: string;

  // slug-ისებური კოდი (მაგ. `banner`) — filter query-ებში (`?brand=banner,mutlu`)
  // და product_attribute_value-ის attributeOptionId-ის ნაცვლად frontend URL-ში.
  @Column()
  code!: string;

  @Column('int', { default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
