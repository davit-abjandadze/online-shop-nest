import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from './entities/user.entity';

// ⚠️ უსაფრთხოების ფიქსი: აქამდე ეს კონტროლერი მთლიანად guard-ის გარეშე იყო —
// ნებისმიერს (ტოკენის გარეშეც) შეეძლო GET /users-ით ყველა მომხმარებლის მონაცემის
// (მათ შორის დაჰეშილი პაროლის) ნახვა, PATCH /users/:id-ით საკუთარი ან სხვისი
// ანგარიშისთვის role: "admin"-ის მინიჭება, ან DELETE /users/:id-ით ნებისმიერი
// ანგარიშის წაშლა. ახლა: ყველა route მოითხოვს ავტორიზაციას, self/admin შემოწმებას
// და role ველის ცვლილება მხოლოდ ADMIN-ს შეუძლია.
function sanitizeUser(user: any) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // მხოლოდ ადმინს შეუძლია ახალი მომხმარებლის პირდაპირ შექმნა (role-ის ჩათვლით).
  // ჩვეულებრივი რეგისტრაცია ხდება /auth/register-ით, სადაც role ვერ იმართება კლიენტიდან.
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return sanitizeUser(user);
  }

  // სრული სია მხოლოდ ადმინისთვის — თორემ ყველას email/მონაცემები ჟონდებოდა.
  @Get()
  @Roles(UserRole.ADMIN)
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(sanitizeUser);
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
    if (updateUserDto.role !== undefined && currentUser?.role !== UserRole.ADMIN) {
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
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const isSelf = currentUser?.userId === targetId;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('ამ მოქმედების უფლება არ გაქვთ');
    }
  }
}
