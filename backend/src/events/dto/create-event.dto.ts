import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  event_id!: string;

  @IsString()
  @IsNotEmpty()
  store_id!: string;

  @IsString()
  @IsIn(['page_view', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase'])
  event_type!: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
