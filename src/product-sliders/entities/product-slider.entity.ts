import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Translations } from '../../common/types/translations.type';
import { ProductSliderItem } from './product-slider-item.entity';

// უნივერსალური "პროდუქტების სლაიდერის" ბლოკი — მთლიანად ადმინიდან
// მართვადი (hero-slides-ის მსგავსად): დინამიური სათაური + "ყველას ნახვა"
// ლინკი + ხელით შერჩეული/დალაგებული პროდუქტების სია (იხ. ProductSliderItem).
// `key` არის სტაბილური იდენტიფიკატორი (slug), რომლითაც frontend-ი ბლოკს
// ნებისმიერ გვერდზე embed-ავს — GET /product-sliders/key/:key (მაგ.
// "home-featured", "new-arrivals") — ID-ისგან განსხვავებით key ხელით
// ინიშნება ადმინის მიერ და მუდმივია გვერდის კოდში hardcode-ისთვის.
@Entity()
export class ProductSlider {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // slug ფორმატი — ლათინური ასოები/ციფრები/დეფისი, unique. frontend-ი ამ
  // მნიშვნელობით ითხოვს კონკრეტულ ბლოკს (`GET /product-sliders/key/:key`).
  @Column({ unique: true })
  key!: string;

  @Column('jsonb', { default: {} })
  translations!: Translations<{ title: string; viewAllText?: string }>;

  // "ყველას ნახვა" ღილაკის ლინკი — სურვილისამებრ (მაგ. კონკრეტულ
  // კატეგორიაზე ან საძიებო/ფილტრის URL-ზე). არარსებობისას frontend-მა
  // ან ღილაკი არ უნდა აჩვენოს, ან key-ის მიხედვით default გვერდზე გადავიდეს.
  @Column({ nullable: true })
  viewAllLink?: string;

  @Column({ default: true })
  isActive!: boolean;

  // ხელით მითითებული დალაგების რიგი admin-ის სიისთვის (hero-slides-ის
  // იგივე პატერნი) — ერთ გვერდზე რამდენიმე ბლოკის ავტომატური
  // თანმიმდევრობისთვის, თუ frontend-მა ეს გამოიყენა.
  @Column('int', { default: 0 })
  sortOrder!: number;

  // ბლოკში შემავალი პროდუქტები, ხელით მითითებული რიგით (ProductSliderItem.
  // sortOrder) — PUT /product-sliders/:id/items-ით იმართება, bulk
  // delete+recreate პატერნით (იხ. ProductsService.setColors).
  @OneToMany(() => ProductSliderItem, (item) => item.productSlider, {
    cascade: true,
  })
  items!: ProductSliderItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
