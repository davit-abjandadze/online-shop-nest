import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// TODO: შემდეგ ეტაპზე დაემატება ManyToMany/OneToMany კავშირი Product-თან,
// როცა პროდუქტის მოდული შეიქმნება.
@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;
}
