import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * პაროლის სირთულის ვალიდაცია: მინიმუმ 8 სიმბოლო, ერთი დიდი ასო,
 * ერთი პატარა ასო და ერთი ციფრი მაინც. მხოლოდ @MinLength(6)-ის ნაცვლად
 * გამოიყენება ყველა პაროლის ველზე (რეგისტრაცია, პაროლის შეცვლა/აღდგენა),
 * რომ მოკლე, მხოლოდ-ციფრიანი პაროლები არ იყოს ბრუტფორსით ადვილად გატეხადი.
 */
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d\W_]{8,}$/;

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && STRONG_PASSWORD_REGEX.test(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს, ერთ დიდ ასოს, ერთ პატარა ასოს და ერთ ციფრს';
        },
      },
    });
  };
}
