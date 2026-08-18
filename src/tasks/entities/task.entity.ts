import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Buy groceries' })
  @Column()
  title: string;

  @ApiProperty({ example: 'Buy milk, eggs, bread' })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({ example: false })
  @Column({ default: false })
  isCompleted: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
