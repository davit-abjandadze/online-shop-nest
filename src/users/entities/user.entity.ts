import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';

// 1. შევქმნათ როლების Enum
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

 @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;
  // @ApiHideProperty() // Swagger-ში არ გამოჩნდება
  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;
}