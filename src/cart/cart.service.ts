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
  ): Promise<Cart> {
    const product = await this.productsService.findOne(productId);
    const cart = await this.getOrCreateForUser(userId);

    const existingItem = cart.items?.find(
      (item) => item.product.id === productId,
    );

    const desiredQuantity = (existingItem?.quantity ?? 0) + quantity;
    if (product.stock < desiredQuantity) {
      throw new BadRequestException(
        `მარაგში საკმარისი რაოდენობა არ არის (ხელმისაწვდომია: ${product.stock})`,
      );
    }

    if (existingItem) {
      existingItem.quantity = desiredQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      const newItem = this.cartItemRepository.create({
        cart,
        product,
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

    if (item.product.stock < quantity) {
      throw new BadRequestException(
        `მარაგში საკმარისი რაოდენობა არ არის (ხელმისაწვდომია: ${item.product.stock})`,
      );
    }

    item.quantity = quantity;
    await this.cartItemRepository.save(item);

    return this.getOrCreateForUser(userId);
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
