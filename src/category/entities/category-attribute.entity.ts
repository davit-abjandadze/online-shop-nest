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
import { Category } from './category.entity';
import { Attribute } from '../../attribute/entities/attribute.entity';

// CategoryAttribute — join ცხრილი ("attribute set"), რომელიც კონკრეტულ
// Attribute-ს კონკრეტულ Category-ს უკავშირებს. წინაპარი კატეგორიიდან
// მემკვიდრეობით მიღებული attribute-ები (იხ. CategoryService.findAttributesForCategory)
// ავტომატურად ვრცელდება ქვეკატეგორიებზეც, თუ ქვეკატეგორიას იგივე
// attributeId-ზე საკუთარი row არ აქვს (რომელიც override-ავს მემკვიდრეობით
// მიღებულს).
@Entity()
@Unique(['category', 'attribute'])
export class CategoryAttribute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

  @Column()
  categoryId!: string;

  @ManyToOne(() => Attribute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attributeId' })
  attribute!: Attribute;

  @Column()
  attributeId!: string;

  @Column('int', { default: 0 })
  sortOrder!: number;

  // null = attribute-ის საკუთარი `isRequired` გამოიყენება უცვლელად;
  // true/false — ამ კონკრეტულ კატეგორიაზე ცალსახად გადაწერს.
  @Column({ type: 'boolean', nullable: true })
  isRequiredOverride?: boolean | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
