import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) {}

  // საჯარო სია — checkout/კატალოგში მხოლოდ აქტიური კომპანიები.
  async findAllActive(): Promise<Company[]> {
    return this.companyRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  // ადმინის დეშბორდი დახურულ კომპანიებსაც ხედავს.
  async findAllAdmin(): Promise<Company[]> {
    return this.companyRepository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`კომპანია ID-ით ${id} ვერ მოიძებნა`);
    }
    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.companyRepository.create(dto as Partial<Company>);
    return this.companyRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);
    Object.assign(company, dto);
    return this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);
    await this.companyRepository.remove(company);
  }
}
