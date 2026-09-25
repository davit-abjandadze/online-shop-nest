import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

// ⚠️ ეს ტესტები ფარავს updateStatus-ის ცენტრალურ გარანტიებს:
// - history-row ყოველთვის იმავე ტრანზაქციაში იწერება, რომელშიც Order.status
//   იცვლება (იხ. OrdersService.recordStatusHistory);
// - status/stockRestored იკითხება ტრანზაქციის შიგნით, order row-ის ლოქის
//   (FOR UPDATE) ქვეშ — არა ტრანზაქციამდე წაკითხული ძველი ასლიდან (ამის
//   გამო ადმინის cancel და cron-ის expire მარაგს ორჯერ აბრუნებდა).
describe('OrdersService.updateStatus', () => {
  const buildService = (order: Partial<Order>) => {
    const lockQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(order),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQuery),
      findOne: jest.fn().mockResolvedValue(order),
      update: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(order),
      find: jest.fn().mockResolvedValue([{ id: order.id }]),
    };

    const service = new OrdersService(
      orderRepository as any,
      {} as any,
      dataSource as any,
      {} as any,
      {} as any,
    );
    const restockOrderItemsSpy = jest
      .spyOn(
        service as unknown as {
          restockOrderItems: (...args: unknown[]) => Promise<void>;
        },
        'restockOrderItems',
      )
      .mockResolvedValue(undefined);

    return { service, manager, lockQuery, restockOrderItemsSpy };
  };

  it('სტატუსს ლოქის ქვეშ კითხულობს (FOR UPDATE)', async () => {
    const order = { id: 1, status: OrderStatus.PAID } as Order;
    const { service, lockQuery } = buildService(order);

    await service.updateStatus(1, OrderStatus.PROCESSING, 7);

    expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('არაფერს წერს, თუ სტატუსი უცვლელია', async () => {
    const order = { id: 1, status: OrderStatus.PENDING } as Order;
    const { service, manager } = buildService(order);

    await service.updateStatus(1, OrderStatus.PENDING, 7);

    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('აგდებს BadRequestException-ს დაუშვებელი გადასვლისთვის და არაფერს წერს', async () => {
    const order = { id: 1, status: OrderStatus.DELIVERED } as Order;
    const { service, manager } = buildService(order);

    await expect(
      service.updateStatus(1, OrderStatus.PENDING, 7),
    ).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('დაშვებულ გადასვლაზე (restock-ის გარეშე) წერს status-ცვლილებას და history-ს ერთ ტრანზაქციაში', async () => {
    const order = {
      id: 5,
      status: OrderStatus.PAID,
      stockRestored: false,
    } as Order;
    const { service, manager } = buildService(order);

    await service.updateStatus(5, OrderStatus.PROCESSING, 42);

    expect(manager.update).toHaveBeenCalledWith(Order, 5, {
      status: OrderStatus.PROCESSING,
    });
    expect(manager.create).toHaveBeenCalledWith(
      OrderStatusHistory,
      expect.objectContaining({
        order: { id: 5 },
        status: OrderStatus.PROCESSING,
        changedBy: { id: 42 },
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('CANCELLED-ზე გადასვლისას (needsRestock) აბრუნებს მარაგს და ამოწერს history-ს', async () => {
    const order = {
      id: 8,
      status: OrderStatus.PENDING,
      stockRestored: false,
    } as Order;
    const { manager, restockOrderItemsSpy, service } = buildService(order);

    await service.updateStatus(8, OrderStatus.CANCELLED);

    expect(restockOrderItemsSpy).toHaveBeenCalledWith(manager, order);
    expect(manager.update).toHaveBeenCalledWith(Order, 8, {
      status: OrderStatus.CANCELLED,
      stockRestored: true,
    });
    expect(manager.create).toHaveBeenCalledWith(
      OrderStatusHistory,
      expect.objectContaining({
        order: { id: 8 },
        status: OrderStatus.CANCELLED,
        changedBy: undefined,
      }),
    );
  });

  it('ლოქის ქვეშ უკვე დაბრუნებულ მარაგს მეორედ აღარ აბრუნებს', async () => {
    const order = {
      id: 8,
      status: OrderStatus.PENDING,
      stockRestored: true,
    } as Order;
    const { restockOrderItemsSpy, service } = buildService(order);

    await service.updateStatus(8, OrderStatus.CANCELLED);

    expect(restockOrderItemsSpy).not.toHaveBeenCalled();
  });

  it('PAID -> CANCELLED-ზე ნიშნავს Payment-ს REFUNDED-ად', async () => {
    const order = {
      id: 9,
      status: OrderStatus.PAID,
      stockRestored: false,
    } as Order;
    const { service, manager } = buildService(order);

    await service.updateStatus(9, OrderStatus.CANCELLED, 3);

    expect(manager.update).toHaveBeenCalledWith(
      Payment,
      { order: { id: 9 }, status: PaymentStatus.COMPLETED },
      { status: PaymentStatus.REFUNDED },
    );
  });
});

describe('OrdersService.expireStaleOrders', () => {
  const buildService = (lockedOrder: Partial<Order>) => {
    const lockQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(lockedOrder),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQuery),
      findOne: jest.fn().mockResolvedValue(lockedOrder),
      update: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    const orderRepository = {
      find: jest.fn().mockResolvedValue([{ id: lockedOrder.id }]),
    };
    const service = new OrdersService(
      orderRepository as any,
      {} as any,
      dataSource as any,
      {} as any,
      {} as any,
    );
    const restockSpy = jest
      .spyOn(
        service as unknown as {
          restockOrderItems: (...args: unknown[]) => Promise<void>;
        },
        'restockOrderItems',
      )
      .mockResolvedValue(undefined);
    return { service, manager, restockSpy };
  };

  it('ლოქის ქვეშ უკვე PAID შეკვეთას არ ეხება (სიის წაკითხვის შემდეგ გადაიხადეს)', async () => {
    const { service, manager, restockSpy } = buildService({
      id: 3,
      status: OrderStatus.PAID,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.expireStaleOrders()).resolves.toBe(0);
    expect(restockSpy).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('ვადაგაგრძელებულ შეკვეთას არ ეხება (გადახდა დაიწყო)', async () => {
    const { service, manager } = buildService({
      id: 3,
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    await expect(service.expireStaleOrders()).resolves.toBe(0);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('ვადაგასულ PENDING შეკვეთას EXPIRED-ად აქცევს და მარაგს აბრუნებს', async () => {
    const { service, manager, restockSpy } = buildService({
      id: 3,
      status: OrderStatus.PENDING,
      stockRestored: false,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.expireStaleOrders()).resolves.toBe(1);
    expect(restockSpy).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledWith(Order, 3, {
      status: OrderStatus.EXPIRED,
      stockRestored: true,
    });
  });
});
