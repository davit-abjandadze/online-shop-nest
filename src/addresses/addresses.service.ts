import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
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
    // პირველი დამატებული მისამართი ავტომატურად ხდება ნაგულისხმევი, რომ
    // checkout-ს ყოველთვის ჰქონდეს რაიმე წინასწარ არჩეული.
    const existingCount = await this.addressRepository.count({
      where: { user: { id: userId } },
    });
    const isDefault = existingCount === 0 || !!dto.isDefault;

    if (isDefault) {
      await this.addressRepository.update(
        { user: { id: userId } },
        { isDefault: false },
      );
    }

    const address = this.addressRepository.create({
      ...dto,
      isDefault,
      user: { id: userId },
    });
    return this.addressRepository.save(address);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOwned(userId, id);

    if (dto.isDefault) {
      await this.addressRepository.update(
        { user: { id: userId } },
        { isDefault: false },
      );
    }

    Object.assign(address, dto);
    return this.addressRepository.save(address);
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
