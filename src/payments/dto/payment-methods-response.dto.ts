import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../orders/entities/order.entity';

export class BankTransferDetailsDto {
  @ApiProperty({ example: 'ი/მ გიორგი გიორგაძე' })
  recipient!: string;

  @ApiProperty({ example: 'GE00BG0000000000000000' })
  iban!: string;

  @ApiPropertyOptional({ example: 'საქართველოს ბანკი', nullable: true })
  bankName!: string | null;
}

export class PaymentMethodsResponseDto {
  @ApiProperty({ enum: PaymentMethod, isArray: true })
  methods!: PaymentMethod[];

  @ApiPropertyOptional({ type: BankTransferDetailsDto, nullable: true })
  bankTransfer!: BankTransferDetailsDto | null;
}
