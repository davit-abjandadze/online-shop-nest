import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    private productsService: ProductsService,
  ) {}

  // მომხმარებლის ფავორიტების სია, ნაბოლოდ დამატებულის თავიდან.
  async findAllForUser(userId: number): Promise<Favorite[]> {
    return this.favoriteRepository.find({
      where: { user: { id: userId } },
      relations: { product: { category: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async addFavorite(userId: number, productId: number): Promise<Favorite> {
    // ვამოწმებთ, პროდუქტი საერთოდ არსებობს თუ არა — 404 თუ არა.
    await this.productsService.findOne(productId);

    const existing = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, product: { id: productId } },
    });
    if (existing) {
      throw new ConflictException('პროდუქტი უკვე ფავორიტებშია დამატებული');
    }

    const favorite = this.favoriteRepository.create({
      user: { id: userId },
      product: { id: productId },
    });

    const saved = await this.favoriteRepository.save(favorite);
    return this.favoriteRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { product: { category: true } },
    });
  }

  async removeFavorite(userId: number, productId: number): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, product: { id: productId } },
    });

    if (!favorite) {
      throw new NotFoundException(
        `პროდუქტი ID-ით ${productId} ფავორიტებში ვერ მოიძებნა`,
      );
    }

    await this.favoriteRepository.remove(favorite);
  }
}
