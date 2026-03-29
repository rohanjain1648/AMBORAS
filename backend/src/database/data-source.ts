import { DataSource } from 'typeorm';
import { StoreEvent } from './entities/store-event.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [StoreEvent],
  synchronize: false,
  migrations: ['src/database/migrations/*.ts'],
});
