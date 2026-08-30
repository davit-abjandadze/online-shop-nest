import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
  ) {}

  // checkout-ის "ფილიალიდან გატანა" სია — მხოლოდ აქტიური ფილიალები.
  async findAllActive(): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  // ადმინის დეშბორდი დახურული ფილიალებსაც ხედავს.
  async findAllAdmin(): Promise<Branch[]> {
    return this.branchRepository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`ფილიალი ID-ით ${id} ვერ მოიძებნა`);
    }
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepository.create(dto as Partial<Branch>);
    return this.branchRepository.save(branch);
  }

  async update(id: number, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    Object.assign(branch, dto);
    return this.branchRepository.save(branch);
  }

  async remove(id: number): Promise<void> {
    const branch = await this.findOne(id);
    await this.branchRepository.remove(branch);
  }
}
