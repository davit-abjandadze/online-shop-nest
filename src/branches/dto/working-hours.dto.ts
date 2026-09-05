import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// `open`/`close` თავად HH:mm ფორმატში უკვე დავალიდირეთ @Matches-ით, აქ
// მხოლოდ შედარებას ვამოწმებთ — HH:mm სტრიქონების ლექსიკოგრაფიული შედარება
// ქრონოლოგიურ შედარებასაც იძლევა ("09:30" < "19:00"), ამიტომ დროდ გადაყვანა
// არაა საჭირო.
@ValidatorConstraint({ name: 'openBeforeClose', async: false })
class OpenBeforeCloseConstraint implements ValidatorConstraintInterface {
  validate(close: string, args: ValidationArguments): boolean {
    const { open } = args.object as BranchDayHoursDto;
    if (!TIME_REGEX.test(open) || !TIME_REGEX.test(close)) {
      return true; // ფორმატის ვალიდაცია @Matches-ს ეკუთვნის, აქ არ ვამრავლებთ შეცდომებს
    }
    return open < close;
  }

  defaultMessage(): string {
    return 'დახურვის დრო (close) უნდა იყოს გახსნის დროის (open) შემდეგ';
  }
}

// ერთი დღის სამუშაო საათები — `null`/გამოტოვება ნიშნავს დახურულ დღეს.
export class BranchDayHoursDto {
  @ApiPropertyOptional({ example: '09:30' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'დროის ფორმატი უნდა იყოს HH:mm' })
  open!: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'დროის ფორმატი უნდა იყოს HH:mm' })
  @Validate(OpenBeforeCloseConstraint)
  close!: string;
}

export class BranchWorkingHoursDto {
  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  mon?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  tue?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  wed?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  thu?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  fri?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  sat?: BranchDayHoursDto | null;

  @ApiPropertyOptional({ type: BranchDayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDayHoursDto)
  sun?: BranchDayHoursDto | null;
}
