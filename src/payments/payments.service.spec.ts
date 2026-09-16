import { ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Order } from '../orders/entities/order.entity';
import { Payment } from './entities/payment.entity';

// ⚠️ ეს test ფაილი მიზანმიმართულად ფარავს
// assertPaymentMatchesOrderForMockComplete-ს — PaymentsController.completeMockPayment-ის
// ერთადერთ დაცვას მას შემდეგ, რაც route-ს JwtAuthGuard მოეხსნა (იხ. ამ
// მეთოდზე მდგარი კომენტარი). ვინაიდან route ავტორიზაციის გარეშეა, სწორედ
// ეს ლოგიკაა ერთადერთი ბარიერი, რომელიც სხვისი orderId/externalId წყვილის
// მოცილებას/გამოცნობას ხელს უშლის — რეგრესია აქ პირდაპირ უსაფრთხოების
// ხვრელს ნიშნავს.
describe('PaymentsService.assertPaymentMatchesOrderForMockComplete', () => {
  const buildService = (payment: Partial<Payment> | null) => {
    const paymentRepository = {
      findOne: jest.fn().mockResolvedValue(payment),
    };

    const service = new PaymentsService(
      paymentRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, paymentRepository };
  };

  it('აბრუნებს ორდერს, როცა externalId ზუსტად ამ orderId-ის Payment-ს ეკუთვნის', async () => {
    const order = { id: 42 } as Order;
    const { service, paymentRepository } = buildService({
      providerOrderId: 'mock-correct-uuid',
      order,
    });

    const result = await service.assertPaymentMatchesOrderForMockComplete(
      42,
      'mock-correct-uuid',
    );

    expect(result).toBe(order);
    expect(paymentRepository.findOne).toHaveBeenCalledWith({
      where: { order: { id: 42 } },
      relations: { order: true },
    });
  });

  it('აგდებს ForbiddenException-ს, როცა externalId სხვა შეკვეთას ეკუთვნის', async () => {
    const { service } = buildService({
      providerOrderId: 'mock-someone-elses-uuid',
      order: { id: 42 } as Order,
    });

    await expect(
      service.assertPaymentMatchesOrderForMockComplete(
        42,
        'mock-attacker-guessed-uuid',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('აგდებს ForbiddenException-ს, როცა ამ orderId-ზე Payment საერთოდ არ არსებობს', async () => {
    const { service } = buildService(null);

    await expect(
      service.assertPaymentMatchesOrderForMockComplete(999, 'mock-anything'),
    ).rejects.toThrow(ForbiddenException);
  });
});
