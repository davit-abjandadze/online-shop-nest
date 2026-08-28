import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// მომხმარებლის შენახული მიწოდების მისამართები (checkout-ის "შენახული
// მისამართები" სელექტისთვის) — favorites-ის ანალოგიური, user-ზე მიბმული,
// user-ის წაშლისას კასკადურად შლის.
@Entity()
export class Address {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  // მისამართის დასახელება/ლეიბლი — "სახელი (მაგ. სამსახური, სახლი)".
  @Column()
  title!: string;

  @Column()
  phoneNumber!: string;

  @Column()
  city!: string;

  @Column()
  address!: string;

  @Column({ nullable: true })
  comment?: string;

  // მომხმარებლის ერთ-ერთი მისამართი შეიძლება იყოს ნაგულისხმევი — checkout-ზე
  // ავტომატურად ეს აირჩევა. (default-ის გადართვას AddressesService აწესრიგებს.)
  @Column({ default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
