import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { IsStrongPortalPin } from '../../../decorators/validators/is-strong-portal-pin.decorator';

export class CustomerPortalPinCompleteDto {
  @ApiProperty({
    pattern: '^[0-9]{6}$',
    description:
      'Six-digit chosen PIN. Rejects trivial patterns per FR-019 (e.g. 111111, 123456, 654321).',
  })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'PIN must be exactly 6 digits' })
  @IsStrongPortalPin()
  pin!: string;

  @ApiProperty({ pattern: '^[0-9]{6}$' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'PIN confirmation must be exactly 6 digits' })
  pinConfirm!: string;
}
