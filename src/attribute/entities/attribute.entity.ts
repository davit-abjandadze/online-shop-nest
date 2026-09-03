import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttributeOption } from './attribute-option.entity';
import type { Translations } from '../../common/types/translations.type';

// დინამიური attribute-ის ტიპი — განსაზღვრავს, თუ როგორი value (`select`,
// `multi_select`, `number`, `text`, `boolean`, `range`) ერგება ამ attribute-ს
// და, შესაბამისად, product_attribute_value-ში რომელი სვეტი გამოიყენება
// (იხ. ProductAttributeValue, ფაზა 4).
export enum AttributeType {
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  NUMBER = 'number',
  TEXT = 'text',
  BOOLEAN = 'boolean',
  RANGE = 'range',
}

// Attribute — მახასიათებლის განმარტება (მაგ. "ტევადობა", "ბრენდი",
// "წყალგაუმტარობა"), category_attribute join-ით ერთვის კონკრეტულ
// კატეგორიებს (ფაზა 3), product_attribute_value-ით — კონკრეტულ
// პროდუქტებს (ფაზა 4).
@Entity()
export class Attribute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // მრავალენოვანი სახელი (ka/en/ru) — JSONB, ka ყოველთვის სავალდებულოა.
  @Column('jsonb', { default: {} })
  translations!: Translations<{ name: string }>;

  // slug-ისებური უნიკალური კოდი — filter query-ებში/frontend-ზე გამოსაყენებელი
  // სტაბილური იდენტიფიკატორი (მაგ. `amperage`), სახელისგან დამოუკიდებელი.
  @Column({ unique: true })
  code!: string;

  @Column({
    type: 'enum',
    enum: AttributeType,
    default: AttributeType.TEXT,
  })
  type!: AttributeType;

  // ერთეული (Ah, V, mm...) — მხოლოდ number/range ტიპებისთვის აქვს აზრი,
  // frontend-ს გამოსატანად ესაჭიროება.
  @Column({ nullable: true })
  unit?: string;

  // faceted-filter endpoint-ში (ფაზა 5) გამოჩნდება თუ არა ეს attribute.
  @Column({ default: true })
  isFilterable!: boolean;

  // admin-ის პროდუქტის ფორმაში სავალდებულოა თუ არა (category_attribute-ს
  // შეუძლია ეს override-ც გადაწეროს კონკრეტულ კატეგორიაზე, ფაზა 3).
  @Column({ default: false })
  isRequired!: boolean;

  @Column('int', { default: 0 })
  sortOrder!: number;

  // მხოლოდ select/multi_select ტიპებისთვის ივსება რეალურად, სხვა ტიპებზე
  // ცარიელი მასივი დარჩება.
  @OneToMany(() => AttributeOption, (option) => option.attribute, {
    cascade: true,
  })
  options?: AttributeOption[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
