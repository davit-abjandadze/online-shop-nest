import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { resolveSortColumn } from '../common/dto/pagination.dto';
import { EmailOtpService } from '../otp/email-otp.service';
import { OtpService } from '../otp/otp.service';
import { hashForSearch } from '../common/utils/encryption.util';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — თუ პირდაპირ
// orderBy-ში ჩავსვამთ, SQL injection-ის რისკია. ამიტომ ვუშვებთ მხოლოდ
// ცნობილ, არსებულ სვეტებს — ყველა დანარჩენ შემთხვევაში ვუბრუნდებით createdAt-ს.
const SORTABLE_COLUMNS = new Set([
  'id',
  'firstName',
  'lastName',
  'email',
  'role',
  'gender',
  'age',
  'createdAt',
]);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly emailOtpService: EmailOtpService,
    private readonly otpService: OtpService,
  ) {}

  // `verifiedFlags` განზრახ არაა CreateUserDto-ს ნაწილი — მოდის მხოლოდ
  // AuthService-იდან (register/googleLogin), სადაც OTP/OAuth უკვე დამოწმებულია.
  // ასე ვერ ხერხდება, კლიენტმა @Body()-ით პირდაპირ "დამოწმებული" სტატუსი გამოგვცხადოს.
  async create(
    createUserDto: CreateUserDto,
    verifiedFlags?: { isEmailVerified?: boolean; isPhoneVerified?: boolean },
  ) {
    // შევამოწოთ, არსებობს თუ არა მომხმარებელი ამ email-ით
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException({
        message: 'ამ ელფოსტით მომხმარებელი უკვე არსებობს',
        errorCode: 'EMAIL_DUPLICATE',
      });
    }

    // ...და ამ ტელეფონის ნომრით (რომ ორმა მომხმარებელმა ერთი და იგივე
    // ნომერი ვერ დაირეგისტრიროს — phoneNumber DTO-დონეზე სავალდებულოა).
    if (createUserDto.phoneNumber) {
      const existingPhone = await this.findByPhoneNumber(
        createUserDto.phoneNumber,
      );
      if (existingPhone) {
        throw new ConflictException({
          message: 'ამ ტელეფონის ნომრით მომხმარებელი უკვე არსებობს',
          errorCode: 'PHONE_DUPLICATE',
        });
      }
    }

    const newUser = this.userRepository.create({
      ...createUserDto,
      isEmailVerified: verifiedFlags?.isEmailVerified ?? false,
      isPhoneVerified: verifiedFlags?.isPhoneVerified ?? false,
      // phoneNumber ახლა non-deterministic (AES-256-GCM) ciphertext-ად ინახება —
      // ტოლობითი ძებნისა/unique-შეზღუდვისთვის ცალკე blind-index (hash) გვჭირდება.
      phoneNumberHash: createUserDto.phoneNumber
        ? hashForSearch(createUserDto.phoneNumber)
        : undefined,
    });
    return this.userRepository.save(newUser);
  }

  findAll() {
    return this.userRepository.find();
  }

  // გაფართოებული ძიება: firstName/lastName/email-ში თავისუფალი ტექსტით
  // (ILike — case-insensitive, ნაწილობრივი დამთხვევა), + role/gender ფილტრები,
  // პაგინაციითა და დალაგებით. სისტემურ (whitelist) სვეტებზეღა ვუშვებთ დალაგებას.
  async findAllPaginated(
    searchUserDto: SearchUserDto,
  ): Promise<PaginatedResponseDto<User>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      search,
      role,
      gender,
    } = searchUserDto;

    const qb = this.userRepository.createQueryBuilder('user');

    if (search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    if (gender) {
      qb.andWhere('user.gender = :gender', { gender });
    }

    const sortColumn = resolveSortColumn(sortBy, SORTABLE_COLUMNS, 'createdAt');
    qb.orderBy(`user.${sortColumn}`, order === 'ASC' ? 'ASC' : 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByPhoneNumber(phoneNumber: string) {
    // phoneNumber სვეტი non-deterministic ciphertext-ია (AES-256-GCM,
    // შემთხვევითი IV) — WHERE-ით პირდაპირ ტოლობა ვეღარ იმუშავებდა (ერთი და
    // იგივე plaintext ყოველ დაშიფვრაზე სხვადასხვა ciphertext-ს იძლევა).
    // ტოლობის შესამოწმებლად ცალკე blind-index (phoneNumberHash) სვეტი გვაქვს.
    return this.userRepository.findOne({
      where: { phoneNumberHash: hashForSearch(phoneNumber) },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const {
      otpRequestId,
      otpCode,
      phoneOtpRequestId,
      phoneOtpCode,
      ...userFields
    } = updateUserDto;
    // `isEmailVerified`/`isPhoneVerified` არასდროს მოდის updateUserDto-დან (DTO-ს არ
    // ეკუთვნის) — მხოლოდ ქვემოთ, OTP-ის წარმატებული დამოწმების შემდეგ ვაწესებთ true-ზე.
    const verifiedPatch: {
      isEmailVerified?: boolean;
      isPhoneVerified?: boolean;
    } = {};

    // ⚠️ ფიქსი: email/phoneNumber ორივეს ერთდროულად ცვლილებისას ეს იმავე
    // User row-ს ცალ-ცალკე findOne(id)-ით ორჯერ ტვირთავდა (ერთხელ აქ,
    // ერთხელ ქვემოთ phoneNumber-ბლოკში) — ერთხელ ვტვირთავთ და ორივე
    // ბლოკი მას იზიარებს.
    const currentUser =
      userFields.email !== undefined || userFields.phoneNumber !== undefined
        ? await this.findOne(id)
        : undefined;

    // ელფოსტის შეცვლას სჭირდება წინასწარ დადასტურებული OTP კოდი ახალ ელფოსტაზე
    // (POST /otp/send-email + POST /otp/verify-email) — ისევე, როგორც რეგისტრაციისას
    // მობილურის ნომერს. აქ დამატებით ვამოწმებთ ორივე მხარეს (otp verify-ის success-ს
    // ვერ ვენდობით მარტოდან — requestId ერთჯერადია და აქვე კვლავ დგინდება).
    if (userFields.email !== undefined && currentUser) {
      const email = userFields.email;
      const verified = await this.applyVerifiedFieldChange({
        newValue: email,
        currentValue: currentUser.email,
        currentlyVerified: currentUser.isEmailVerified,
        otpRequestId,
        otpCode,
        userId: id,
        findExisting: (value) => this.findByEmail(value),
        verifyOtp: (requestId, code) =>
          this.emailOtpService.verifyOtp(requestId, code, email),
        duplicateErrorCode: 'EMAIL_DUPLICATE',
        duplicateMessage: 'ამ ელფოსტით მომხმარებელი უკვე არსებობს',
        missingOtpMessage:
          'ელფოსტის შესაცვლელად საჭიროა ახალი ელფოსტის დადასტურება — ჯერ გამოიძახეთ POST /otp/send-email',
      });
      if (verified) {
        verifiedPatch.isEmailVerified = true;
      }
    }

    // მობილურის ნომრის შეცვლას სჭირდება წინასწარ დადასტურებული OTP კოდი ახალ ნომერზე
    // (POST /otp/send + POST /otp/verify, verify.ge) — ისევე, როგორც რეგისტრაციაზე.
    if (userFields.phoneNumber !== undefined && currentUser) {
      const phoneNumber = userFields.phoneNumber;
      const verified = await this.applyVerifiedFieldChange({
        newValue: phoneNumber,
        currentValue: currentUser.phoneNumber,
        currentlyVerified: currentUser.isPhoneVerified,
        otpRequestId: phoneOtpRequestId,
        otpCode: phoneOtpCode,
        userId: id,
        findExisting: (value) => this.findByPhoneNumber(value),
        verifyOtp: (requestId, code) =>
          this.otpService.verifyOtp(requestId, code),
        duplicateErrorCode: 'PHONE_DUPLICATE',
        duplicateMessage: 'ამ ტელეფონის ნომრით მომხმარებელი უკვე არსებობს',
        missingOtpMessage:
          'მობილურის ნომრის შესაცვლელად საჭიროა ახალი ნომრის დადასტურება — ჯერ გამოიძახეთ POST /otp/send',
      });
      if (verified) {
        verifiedPatch.isPhoneVerified = true;
      }
    }

    // phoneNumber იცვლება ⇒ blind-index (phoneNumberHash) აქვე უნდა
    // გადავითვალოთ, თორემ ის ძველ ნომერს დაუკავშირდება (findByPhoneNumber
    // და unique-შეზღუდვა მასზეა დამოკიდებული, არა თავად ciphertext-ზე).
    const phoneNumberHashPatch =
      userFields.phoneNumber !== undefined
        ? { phoneNumberHash: hashForSearch(userFields.phoneNumber) }
        : {};

    const user = await this.userRepository.preload({
      id: +id,
      ...userFields,
      ...verifiedPatch,
      ...phoneNumberHashPatch,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.userRepository.save(user);
  }

  // email/phoneNumber-ის დამოწმებული ცვლილების საერთო ლოგიკა (update()-ის
  // ორივე ბლოკს შორის მეორდებოდა): თუ ველი შეიცვალა — უნიკალურობის
  // შემოწმება + OTP-ის სავალდებულო დამოწმება; თუ არ შეცვლილა, მაგრამ ჯერ
  // დაუდასტურებელი იყო და OTP მაინც გადმოეცა — ასევე დამოწმება. აბრუნებს
  // true-ს, თუ შესაბამისი `isXVerified` ალამი true-ზე უნდა დაისვას.
  private async applyVerifiedFieldChange(params: {
    newValue: string;
    currentValue: string | undefined;
    currentlyVerified: boolean;
    otpRequestId: string | undefined;
    otpCode: string | undefined;
    userId: number;
    findExisting: (value: string) => Promise<{ id: number } | null>;
    verifyOtp: (requestId: string, code: string) => boolean | Promise<boolean>;
    duplicateErrorCode: string;
    duplicateMessage: string;
    missingOtpMessage: string;
  }): Promise<boolean> {
    const {
      newValue,
      currentValue,
      currentlyVerified,
      otpRequestId,
      otpCode,
      userId,
      findExisting,
      verifyOtp,
      duplicateErrorCode,
      duplicateMessage,
      missingOtpMessage,
    } = params;

    if (newValue !== currentValue) {
      const existing = await findExisting(newValue);
      if (existing && existing.id !== userId) {
        throw new ConflictException({
          message: duplicateMessage,
          errorCode: duplicateErrorCode,
        });
      }

      if (!otpRequestId || !otpCode) {
        throw new BadRequestException(missingOtpMessage);
      }

      const verified = await verifyOtp(otpRequestId, otpCode);
      if (!verified) {
        throw new BadRequestException('OTP კოდი არასწორია ან ვადაგასულია');
      }
      return true;
    } else if (!currentlyVerified && otpRequestId && otpCode) {
      // ველი არ შეცვლილა, მაგრამ ჯერ დაუდასტურებელი იყო — თუ ამჟამინდელ
      // მნიშვნელობაზე წარმატებით გაიარა OTP-ვერიფიკაცია, ვადასტურებთ.
      const verified = await verifyOtp(otpRequestId, otpCode);
      if (!verified) {
        throw new BadRequestException('OTP კოდი არასწორია ან ვადაგასულია');
      }
      return true;
    }
    return false;
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    try {
      return await this.userRepository.remove(user);
    } catch (error: any) {
      // FK ვიოლაცია (მაგ. მომხმარებელს აქვს შეკვეთები) — orders.user-ს
      // onDelete არ აქვს დაყენებული განზრახ, რადგან შეკვეთების ისტორია
      // არ უნდა წაიშალოს ავტომატურად. 500-ის ნაცვლად გასაგები 409-ს ვაბრუნებთ.
      if (error?.code === '23503') {
        throw new ConflictException(
          'მომხმარებლის წაშლა შეუძლებელია — მას გააჩნია დაკავშირებული შეკვეთები',
        );
      }
      throw error;
    }
  }
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
  // ← ახალი მეთოდი: პაროლის განახლება
  // passwordChangedAt ივსება ყოველი გამოძახებისას (ჩვეულებრივი change-password
  // და reset-password ორივე ამ მეთოდს იძახებს) — ეს საშუალებას აძლევს
  // JwtStrategy.validate-ს, ცვლილებამდე გაცემული ყველა token (access და reset)
  // ინვალიდურად ჩათვალოს, მიუხედავად იმისა, რომ მათი ხელმოწერა/ვადა კვლავ ვალიდურია.
  async updatePassword(userId: number, hashedPassword: string) {
    await this.userRepository.update(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });
  }
}
