import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

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
  ) {}

  async create(createUserDto: CreateUserDto) {
    // შევამოწოთ, არსებობს თუ არა მომხმარებელი ამ email-ით
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const newUser = this.userRepository.create(createUserDto);
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

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'createdAt';
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

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.preload({
      id: +id,
      ...updateUserDto,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.userRepository.save(user);
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    return this.userRepository.remove(user);
  }
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
  // ← ახალი მეთოდი: პაროლის განახლება
  async updatePassword(userId: number, hashedPassword: string) {
    await this.userRepository.update(userId, { password: hashedPassword });
  }
}
