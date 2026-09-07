import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { maskPersonalNumber, maskPhoneNumber } from '../common/utils/mask.util';
import { isAdminUser } from '../common/utils/is-admin.util';

// ⚠️ უსაფრთხოების ფიქსი: აქამდე ეს კონტროლერი მთლიანად guard-ის გარეშე იყო —
// ნებისმიერს (ტოკენის გარეშეც) შეეძლო GET /users-ით ყველა მომხმარებლის მონაცემის
// (მათ შორის დაჰეშილი პაროლის) ნახვა, PATCH /users/:id-ით საკუთარი ან სხვისი
// ანგარიშისთვის role: "admin"-ის მინიჭება, ან DELETE /users/:id-ით ნებისმიერი
// ანგარიშის წაშლა. ახლა: ყველა route მოითხოვს ავტორიზაციას, self/admin შემოწმებას
// და role ველის ცვლილება მხოლოდ ADMIN-ს შეუძლია.
// ⚠️ უსაფრთხოების ფიქსი: sanitizeUser აქამდე მხოლოდ password-ს აშორებდა — personalNumber/
// phoneNumber დეშიფრული, სრული სახით ბრუნდებოდა GET /users, /users/search, /users/:id-ზე,
// მიუხედავად იმისა, რომ AuthService.generateToken() ზუსტად ამ ველების დასაფარად mask.util.ts-ს
// უკვე იყენებდა login/register პასუხში — ეს დაცვა აქ არასდროს გამოყენებულა.
function sanitizeUser(user: any) {
  if (!user) return user;
  const { password, ...rest } = user;
  return {
    ...rest,
    personalNumber: maskPersonalNumber(rest.personalNumber),
    phoneNumber: maskPhoneNumber(rest.phoneNumber),
  };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // მხოლოდ ადმინს შეუძლია ახალი მომხმარებლის პირდაპირ შექმნა (role-ის ჩათვლით).
  // ჩვეულებრივი რეგისტრაცია ხდება /auth/register-ით, სადაც role ვერ იმართება კლიენტიდან.
  @Post()
  @AdminOnly()
  async create(@Body() createUserDto: CreateUserDto) {
    // ⚠️ უსაფრთხოების ფიქსი: UsersService.create() პაროლს არ ჰეშავს (სხვა ყველა
    // გამომძახებელი — AuthService.register/googleLogin — უკვე ჰეშირებულ პაროლს
    // გადასცემს), ამიტომ აქ, ერთადერთ ადგილას სადაც პაროლი პირდაპირ კლიენტიდან
    // მოდის დაუჰეშავად, თავად უნდა დავაჰეშოთ — თორემ ბაზაში plaintext ჩაიწერებოდა
    // და ამ ანგარიშით ვერასდროს შევძლებდით login-ს (bcrypt.compare ვერასდროს
    // დაემთხვევა non-hash მნიშვნელობას).
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return sanitizeUser(user);
  }

  // სრული სია მხოლოდ ადმინისთვის — თორემ ყველას email/მონაცემები ჟონდებოდა.
  @Get()
  @AdminOnly()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(sanitizeUser);
  }

  // გაფართოებული ძიება (search/role/gender ფილტრები + პაგინაცია/დალაგება) —
  // მხოლოდ ადმინისთვის, იმავე მიზეზით რაც findAll-ია (მომხმარებელთა მონაცემები).
  // შენიშვნა: route-ი /:id-ზე მაღლა უნდა იდგეს, თორემ Nest "search"-ს
  // :id პარამეტრად აღიქვამს.
  @Get('search')
  @AdminOnly()
  async search(@Query() searchUserDto: SearchUserDto) {
    const result = await this.usersService.findAllPaginated(searchUserDto);
    return {
      ...result,
      data: result.data.map(sanitizeUser),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    this.assertSelfOrAdmin(currentUser, +id);
    const user = await this.usersService.findOne(+id);
    return sanitizeUser(user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    this.assertSelfOrAdmin(currentUser, +id);

    // role-ის შეცვლა მხოლოდ ADMIN-ს შეუძლია — თორემ ნებისმიერს შეეძლო
    // საკუთარი თავისთვის { "role": "admin" } გაეგზავნა და ადმინი გამხდარიყო.
    if (updateUserDto.role !== undefined && !isAdminUser(currentUser)) {
      throw new ForbiddenException('როლის შეცვლის უფლება არ გაქვთ');
    }

    const user = await this.usersService.update(+id, updateUserDto);
    return sanitizeUser(user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    this.assertSelfOrAdmin(currentUser, +id);
    const user = await this.usersService.remove(+id);
    return sanitizeUser(user);
  }

  private assertSelfOrAdmin(currentUser: any, targetId: number) {
    const isAdmin = isAdminUser(currentUser);
    const isSelf = currentUser?.userId === targetId;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('ამ მოქმედების უფლება არ გაქვთ');
    }
  }
}
