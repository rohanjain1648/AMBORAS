import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EventType =
  | 'page_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'purchase';

@Entity('store_events')
@Index('idx_events_store_type_ts', ['storeId', 'eventType', 'timestamp'])
@Index('idx_events_store_ts', ['storeId', 'timestamp'])
export class StoreEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'varchar', length: 50, unique: true })
  eventId!: string;

  @Column({ name: 'store_id', type: 'varchar', length: 50 })
  storeId!: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 30,
  })
  eventType!: EventType;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp!: Date;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
