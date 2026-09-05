import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  // მომხმარებლის მისამართები, ნაგულისხმევი პირველი, შემდეგ ბოლოს დამატებულის
  // თავიდან — checkout-ის სელექტს ეს თანმიმდევრობა ჭირდება ნაგულისხმევის
  // ავტომატურად ასარჩევად.
  async findAllForUser(userId: number): Promise<Address[]> {
    return this.addressRepository.find({
      where: { user: { id: userId } },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  private async findOwned(userId: number, id: number): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!address) {
      throw new NotFoundException(`მისამართი ID-ით ${id} ვერ მოიძებნა`);
    }
    return address;
  }

  async create(userId: number, dto: CreateAddressDto): Promise<Address> {
    // "მხოლოდ ერთი ნაგულისხმევი" წესი ატომურად უნდა შესრულდეს — ტრანზაქციის
    // შიგნით userId-ის ყველა მისამართის row-ს ვბლოკავთ (pessimistic_write),
    // რომ ორმა პარალელურმა POST-მა ერთდროულად ორივემ "ნაგულისხმევი არ არსებობს"
    // არ დაინახოს და ორივემ isDefault:true არ დააფიქსიროს.
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager
        .createQueryBuilder(Address, 'address')
        .setLock('pessimistic_write')
        .where('address.userId = :userId', { userId })
        .getMany();

      // პირველი დამატებული მისამართი ავტომატურად ხდება ნაგულისხმევი, რომ
      // checkout-ს ყოველთვის ჰქონდეს რაიმე წინასწარ არჩეული.
      const isDefault = existing.length === 0 || !!dto.isDefault;

      if (isDefault && existing.some((a) => a.isDefault)) {
        await manager.update(
          Address,
          { user: { id: userId } },
          { isDefault: false },
        );
      }

      const address = manager.create(Address, {
        ...dto,
        isDefault,
        user: { id: userId },
      });
      return manager.save(address);
    });
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.dataSource.transaction(async (manager) => {
      // იგივე ლოქინგი, რაც create()-ში — მოსანიშნი მისამართის და დანარჩენების
      // row-ები ტრანზაქციის ბოლომდე დაბლოკილია, სანამ ნაგულისხმევი ეცვლება.
      const address = await manager
        .createQueryBuilder(Address, 'address')
        .setLock('pessimistic_write')
        .where('address.id = :id AND address.userId = :userId', {
          id,
          userId,
        })
        .getOne();

      if (!address) {
        throw new NotFoundException(`მისამართი ID-ით ${id} ვერ მოიძებნა`);
      }

      const siblings = await manager
        .createQueryBuilder(Address, 'address')
        .setLock('pessimistic_write')
        .where('address.userId = :userId', { userId })
        .getMany();

      if (dto.isDefault && siblings.some((a) => a.isDefault && a.id !== id)) {
        await manager.update(
          Address,
          { user: { id: userId } },
          { isDefault: false },
        );
      }

      Object.assign(address, dto);
      return manager.save(address);
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    const address = await this.findOwned(userId, id);
    const wasDefault = address.isDefault;
    await this.addressRepository.remove(address);

    // თუ წაშლილი მისამართი ნაგულისხმევი იყო, შემდეგი (ყველაზე ახალი)
    // მისამართი ავტომატურად ხდება ნაგულისხმევი, რომ სია დაცარიელებული
    // default-ის გარეშე არ დარჩეს.
    if (wasDefault) {
      const next = await this.addressRepository.findOne({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await this.addressRepository.save(next);
      }
    }
  }
}
