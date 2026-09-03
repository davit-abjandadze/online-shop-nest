import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import type { Translations } from '../../common/types/translations.type';

// მთავარი გვერდის hero სლაიდერის ერთი სლაიდი — მთლიანად ადმინიდან
// მართვადი (CMS-ის მსგავსად): eyebrow/სათაური/აღწერილობა/ღილაკის ტექსტი
// მრავალენოვანია (JSONB, category/product-ის იგივე translations პატერნით),
// image/ღილაკის ლინკი/პროდუქტთან მიბმა — locale-ისგან დამოუკიდებელი plain
// ველებია. productId სურვილისამებრია — თუ მითითებულია, ღილაკი პროდუქტის
// გვერდზე გადადის (ცალკე buttonLink-ითაც შეიძლება გადაფარვა, მაგ.
// კატეგორიაზე ან სრულიად გარე URL-ზე გადამისამართებისთვის).
@Entity()
export class HeroSlide {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('jsonb', { default: {} })
  translations!: Translations<{
    eyebrow?: string;
    title: string;
    description?: string;
    buttonText?: string;
  }>;

  @Column()
  image!: string;

  @Column({ nullable: true })
  buttonLink?: string;

  // მიბმული პროდუქტი — სურვილისამებრ, ღილაკის ავტომატური ლინკისთვის
  // (`buttonLink` მითითების გარეშე) ან უბრალოდ სლაიდისა და კონკრეტული
  // პროდუქტის დასაკავშირებლად admin-ის მხარეს. პროდუქტის წაშლისას სლაიდი
  // არ იშლება, უბრალოდ productId null ხდება (category/product-ის იგივე
  // SET NULL პატერნი).
  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  product?: Product | null;

  @Column({ default: true })
  isActive!: boolean;

  // ხელით მითითებული დალაგების რიგი admin-ის drag&drop editor-ისთვის.
  @Column('int', { default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
