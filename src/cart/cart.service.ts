import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    private productsService: ProductsService,
  ) {}

  // მომხმარებელს ჯერ არ აქვს კალათა? ვქმნით ცარიელს — GET /cart არასდროს
  // 404-ობს, ყოველთვის აბრუნებს (თუნდაც ცარიელ) კალათას.
  async getOrCreateForUser(userId: number): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: { items: { product: { category: true } } },
    });

    if (!cart) {
      cart = this.cartRepository.create({ user: { id: userId } });
      cart = await this.cartRepository.save(cart);
      cart.items = [];
    }

    return cart;
  }

  async addItem(
    userId: number,
    productId: number,
    quantity: number,
    colorId?: string,
  ): Promise<Cart> {
    const product = await this.productsService.findOne(productId);
    const availableStock = await this.resolveAvailableStock(
      product.id,
      product.stock,
      colorId,
    );
    const cart = await this.getOrCreateForUser(userId);

    // იგივე პროდუქტი + იგივე ფერი (ორივე ცარიელია, თუ ფერი არ გამოიყენება)
    // უკვე კალათაშია? — რაოდენობას ვამატებთ ცალკე row-ის შექმნის ნაცვლად.
    const existingItem = cart.items?.find(
      (item) =>
        item.product.id === productId &&
        (item.colorId ?? null) === (colorId ?? null),
    );

    const desiredQuantity = (existingItem?.quantity ?? 0) + quantity;
    if (availableStock < desiredQuantity) {
      throw new BadRequestException(
        `მარაგში საკმარისი რაოდენობა არ არის (ხელმისაწვდომია: ${availableStock})`,
      );
    }

    if (existingItem) {
      existingItem.quantity = desiredQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      const newItem = this.cartItemRepository.create({
        cart,
        product,
        colorId: colorId ?? null,
        quantity,
      });
      await this.cartItemRepository.save(newItem);
    }

    return this.getOrCreateForUser(userId);
  }

  async updateItemQuantity(
    userId: number,
    itemId: number,
    quantity: number,
  ): Promise<Cart> {
    const item = await this.findOwnItem(userId, itemId);
    const availableStock = await this.resolveAvailableStock(
      item.product.id,
      item.product.stock,
      item.colorId ?? undefined,
    );

    if (availableStock < quantity) {
      throw new BadRequestException(
        `მარაგში საკმარისი რაოდენობა არ არის (ხელმისაწვდომია: ${availableStock})`,
      );
    }

    item.quantity = quantity;
    await this.cartItemRepository.save(item);

    return this.getOrCreateForUser(userId);
  }

  // თუ პროდუქტს ფერები მითითებული აქვს (ProductColor-ის ჩანაწერები
  // არსებობს), colorId სავალდებულოა და მარაგიც კონკრეტული ფერის
  // stock-იდან იკითხება — ფერების გარეშე პროდუქტზე ჩვეულებრივად
  // product.stock გამოიყენება.
  private async resolveAvailableStock(
    productId: number,
    productStock: number,
    colorId?: string,
  ): Promise<number> {
    const colors = await this.productsService.getColors(productId);

    if (colors.length === 0) {
      if (colorId) {
        throw new BadRequestException('ამ პროდუქტს ფერი არ გააჩნია');
      }
      return productStock;
    }

    if (!colorId) {
      throw new BadRequestException(
        'ეს პროდუქტი მოითხოვს ფერის მითითებას (colorId)',
      );
    }

    const productColor = colors.find((c) => c.colorId === colorId);
    if (!productColor) {
      throw new BadRequestException(
        'ეს ფერი არ არის ხელმისაწვდომი ამ პროდუქტისთვის',
      );
    }

    return productColor.stock;
  }

  async removeItem(userId: number, itemId: number): Promise<Cart> {
    const item = await this.findOwnItem(userId, itemId);
    await this.cartItemRepository.remove(item);
    return this.getOrCreateForUser(userId);
  }

  async clear(userId: number): Promise<Cart> {
    const cart = await this.getOrCreateForUser(userId);
    if (cart.items?.length) {
      await this.cartItemRepository.remove(cart.items);
    }
    return this.getOrCreateForUser(userId);
  }

  // ვამოწმებთ, რომ item ეკუთვნის ამ userId-ის კალათას — სხვისი კალათის
  // item-ის მანიპულირება არ უნდა იყოს შესაძლებელი.
  private async findOwnItem(userId: number, itemId: number): Promise<CartItem> {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: { cart: { user: true }, product: true },
    });

    if (!item || item.cart.user.id !== userId) {
      throw new NotFoundException(
        `კალათის ჩანაწერი ID-ით ${itemId} ვერ მოიძებნა`,
      );
    }

    return item;
  }
}
