import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

// ⚠️ ეს ტესტები ფარავს updateStatus-ის ცენტრალურ გარანტიას: history-row
// ყოველთვის იმავე ტრანზაქციაში იწერება, რომელშიც Order.status იცვლება (იხ.
// OrdersService.recordStatusHistory-ზე მდგარი კომენტარი) — არც ერთი
// call-site არ უნდა შეძლოს status-ის შეცვლა history-ის ჩაწერის გარეშე
// (ან პირიქით).
describe('OrdersService.updateStatus', () => {
  const buildService = (order: Partial<Order>) => {
    const manager = {
      update: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => Promise<void>) => {
        await cb(manager);
      }),
    };
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(order),
    };
    const paymentRepository = {};

    const service = new OrdersService(
      orderRepository as any,
      paymentRepository as any,
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

    return {
      service,
      dataSource,
      manager,
      orderRepository,
      restockOrderItemsSpy,
    };
  };

  it('არ იწყებს ტრანზაქციას, თუ სტატუსი უცვლელია', async () => {
    const order = { id: 1, status: OrderStatus.PENDING } as Order;
    const { service, dataSource } = buildService(order);

    const result = await service.updateStatus(1, OrderStatus.PENDING, 7);

    expect(result).toBe(order);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('აგდებს BadRequestException-ს დაუშვებელი გადასვლისთვის და ტრანზაქციას არ იწყებს', async () => {
    const order = { id: 1, status: OrderStatus.DELIVERED } as Order;
    const { service, dataSource } = buildService(order);

    await expect(
      service.updateStatus(1, OrderStatus.PENDING, 7),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
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
