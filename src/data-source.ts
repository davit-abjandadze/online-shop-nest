import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

// ეს ფაილი მხოლოდ TypeORM CLI-სთვისაა (migration:generate/run/revert) —
// Nest-ის runtime კავშირს [app.module.ts](src/app.module.ts)-ის TypeOrmModule.forRootAsync
// ქმნის ცალკე. ორივე უნდა ერთნაირ entity/migration set-ს უთითებდეს, თორემ
// CLI-ის მიერ დაგენერირებული migration-ები production runtime-ს არ დაემთხვევა.
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
