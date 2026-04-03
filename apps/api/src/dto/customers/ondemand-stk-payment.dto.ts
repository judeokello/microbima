import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsString, Max, Min, ValidateIf } from 'class-validator';

export enum OndemandStkMode {
  INSTALLMENTS = 'INSTALLMENTS',
  CUSTOM = 'CUSTOM',
}

export class OndemandStkPaymentDto {
  @ApiProperty({ enum: OndemandStkMode })
  @IsEnum(OndemandStkMode)
  mode!: OndemandStkMode;

  @ApiProperty({ description: 'Required when mode=INSTALLMENTS', minimum: 1, maximum: 5, required: false })
  @ValidateIf((o: OndemandStkPaymentDto) => o.mode === OndemandStkMode.INSTALLMENTS)
  @IsInt()
  @Min(1)
  @Max(5)
  installmentCount?: number;

  @ApiProperty({ description: 'Required when mode=CUSTOM', minimum: 1, maximum: 70000, required: false })
  @ValidateIf((o: OndemandStkPaymentDto) => o.mode === OndemandStkMode.CUSTOM)
  @IsNumber()
  @Min(1)
  @Max(70000)
  customAmountKes?: number;

  @ApiProperty({ description: 'MSISDN (01/07 10-digit or 254…)' })
  @IsString()
  phoneNumber!: string;
}
