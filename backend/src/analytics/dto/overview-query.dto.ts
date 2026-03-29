import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class OverviewQueryDto {
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'custom'])
  period?: 'today' | 'week' | 'month' | 'custom' = 'month';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
