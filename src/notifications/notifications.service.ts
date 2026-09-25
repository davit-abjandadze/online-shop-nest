import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { User } from '../users/entities/user.entity';
import { sanitizeNotificationHtml } from './utils/sanitize-notification-html.util';
import { buildNotificationSnippet } from './utils/build-notification-snippet.util';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/paginate.util';
import { NotificationListItemResponseDto } from './dto/notification-list-item-response.dto';
import { NotificationDetailResponseDto } from './dto/notification-detail-response.dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { MarkAllReadResponseDto } from './dto/mark-all-read-response.dto';

const NOTIFICATION_SORTABLE_COLUMNS = ['createdAt', 'title'] as const;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly notificationRecipientRepository: Repository<NotificationRecipient>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // admin-ის შეყვანილი contentHtml-ის allow-list სანიტაცია — გამოიძახება
  // create-ზე შენახვის წინ (იხ. Phase B3.2 CreateNotificationDto.contentHtml).
  sanitizeContentHtml(html: string): string {
    return sanitizeNotificationHtml(html);
  }

  // შეტყობინების შექმნა + bulk-insert NotificationRecipient-ებში —
  // targetUserIds საერთოდ არ მითითებულა (undefined) → ეგზავნება ბაზაში
  // არსებულ ყველა user-ს; ცარიელი მასივი კი გამიზნულად "არავის" ნიშნავს და
  // ცალკე უნდა გაირჩეს undefined-საგან. ორივე insert ერთ ტრანზაქციაშია, რომ
  // targetUserIds-ში არასწორი (არარსებული) user id-ის FK-შეცდომამ არ დატოვოს
  // "ობოლი" Notification recipient-ების გარეშე.
  async create(
    createNotificationDto: CreateNotificationDto,
    createdByUserId: number,
  ): Promise<Notification> {
    return this.dataSource.transaction(async (manager) => {
      const notification = await manager.save(
        manager.create(Notification, {
          title: createNotificationDto.title,
          contentHtml: this.sanitizeContentHtml(
            createNotificationDto.contentHtml,
          ),
          imageUrl: createNotificationDto.imageUrl,
          actions: createNotificationDto.actions,
          createdByUserId,
        }),
      );

      if (!createNotificationDto.targetUserIds) {
        // ყველა user-ს — ერთი INSERT ... SELECT-ით, DB-ის შიგნით. აქამდე ყველა
        // id Node-ში იტვირთებოდა და ერთ multi-row INSERT-ად (2 bind
        // პარამეტრი თითო row-ზე) იგზავნებოდა: ~32 000 user-ის ზემოთ
        // Postgres-ის 65 535 პარამეტრის ლიმიტს სცდებოდა და broadcast მთლიანად
        // 500-ით ვარდებოდა.
        await manager.query(
          `INSERT INTO "notification_recipient" ("notificationId", "userId")
           SELECT $1, "id" FROM "user"`,
          [notification.id],
        );
        return notification;
      }

      // დუბლიკატები ([5, 5]) unique (notificationId, userId) ინდექსს არღვევდა → 500.
      const recipientIds = [...new Set(createNotificationDto.targetUserIds)];

      // წინასწარი ვალიდაცია, რომ არარსებულმა user id-მა ტრანზაქციაში
      // FK constraint violation-ი (500) არ გამოიწვიოს — ნაცვლად მკაფიო
      // 400-ის დაბრუნებისა, თუ რომელი id ვერ მოიძებნა.
      const existingUsers = await manager.find(User, {
        where: { id: In(recipientIds) },
        select: { id: true },
      });
      const existingIds = new Set(existingUsers.map((user) => user.id));
      const missingIds = recipientIds.filter((id) => !existingIds.has(id));
      if (missingIds.length) {
        throw new BadRequestException(
          `მომხმარებელი ID-ებით [${missingIds.join(', ')}] ვერ მოიძებნა`,
        );
      }

      if (recipientIds.length) {
        try {
          await manager
            .createQueryBuilder()
            .insert()
            .into(NotificationRecipient)
            .values(
              recipientIds.map((userId) => ({
                notificationId: notification.id,
                userId,
              })),
            )
            .execute();
        } catch (err) {
          // ⚠️ ფიქსი: ზემოთ existence-შემოწმებასა და ამ insert-ს შორის
          // (ორივე ერთსა და იმავე ტრანზაქციაშია, მაგრამ ცალკე statement-ებია)
          // შესაძლოა user წაიშალოს — postgres-ის FK violation (23503) კოდზე
          // მკაფიო 400-ს ვაბრუნებთ, ნაცვლად დაუჭერელი 500-ისა.
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code?: string }).code === '23503'
          ) {
            throw new BadRequestException(
              'ერთი ან მეტი მითითებული user id აღარ არსებობს',
            );
          }
          throw err;
        }
      }

      return notification;
    });
  }

  // გაგზავნილი შეტყობინებების paginated ისტორია (ADMIN) — recipient-ების
  // ჩატვირთვა აქ არ სჭირდება, სია მხოლოდ Notification-ის ველებს აჩვენებს.
  async findAllPaginated(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const qb = this.notificationRepository.createQueryBuilder('notification');
    return paginate(
      qb,
      'notification',
      paginationDto,
      NOTIFICATION_SORTABLE_COLUMNS,
      'createdAt',
    );
  }

  // შეტყობინების რედაქტირება (ADMIN) — მხოლოდ title/contentHtml/imageUrl,
  // მიმღებები (recipients) აღარ იცვლება: შეტყობინება უკვე გაგზავნილია.
  async update(
    id: number,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('შეტყობინება ვერ მოიძებნა');
    }

    if (updateNotificationDto.title !== undefined) {
      notification.title = updateNotificationDto.title;
    }
    if (updateNotificationDto.contentHtml !== undefined) {
      notification.contentHtml = this.sanitizeContentHtml(
        updateNotificationDto.contentHtml,
      );
    }
    if (updateNotificationDto.imageUrl !== undefined) {
      notification.imageUrl = updateNotificationDto.imageUrl;
    }
    if (updateNotificationDto.actions !== undefined) {
      notification.actions = updateNotificationDto.actions;
    }

    return this.notificationRepository.save(notification);
  }

  // NotificationRecipient-ები FK-ზე onDelete: 'CASCADE'-ითაა დაკავშირებული,
  // ამიტომ Notification-ის წაშლა საკმარისია — recipient row-ები ცალკე
  // წაშლა არ სჭირდება.
  async remove(id: number): Promise<void> {
    const result = await this.notificationRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('შეტყობინება ვერ მოიძებნა');
    }
  }

  // bell icon badge — user-ის წაუკითხავი შეტყობინებების რაოდენობა.
  async getUnreadCount(userId: number): Promise<UnreadCountResponseDto> {
    const count = await this.notificationRecipientRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // dropdown-ის paginated სია (USER) — NotificationRecipient-ზე ვლაგდებით
  // (და არა Notification-ზე), რომ isRead ამ user-ის მიხედვით ავირჩიოთ.
  async findAllForUser(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<NotificationListItemResponseDto>> {
    const qb = this.notificationRecipientRepository
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notification', 'notification')
      .where('recipient.userId = :userId', { userId });

    // paginate()-ის ორდერინგი 'notification' alias-ზეა (recipient-ს კი არა),
    // რადგან დალაგება notification-ის ველზეა (createdAt/title) — skip/take
    // ალიასზე დამოკიდებული არაა, ამიტომ ერთსავე qb-ზე უსაფრთხოდ მუშაობს.
    const result = await paginate(
      qb,
      'notification',
      paginationDto,
      NOTIFICATION_SORTABLE_COLUMNS,
      'createdAt',
    );

    const data = result.data.map((recipient) => ({
      id: recipient.notification.id,
      title: recipient.notification.title,
      snippet: buildNotificationSnippet(recipient.notification.contentHtml),
      imageUrl: recipient.notification.imageUrl,
      isRead: recipient.isRead,
      createdAt: recipient.notification.createdAt,
    }));

    return new PaginatedResponseDto(
      data,
      result.meta.total,
      result.meta.page,
      result.meta.limit,
    );
  }

  // მოდალის სრული content (USER) + auto mark-as-read — recipient-row-ს
  // notificationId+userId-ით ვეძებთ (და არა Notification-ს პირდაპირ), რომ
  // ერთდროულად შემოწმდეს "ეს შეტყობინება ამ user-ს გაეგზავნა თუ არა".
  async findOneForUser(
    id: number,
    userId: number,
  ): Promise<NotificationDetailResponseDto> {
    const recipient = await this.notificationRecipientRepository.findOne({
      where: { notificationId: id, userId },
      relations: { notification: true },
    });
    if (!recipient) {
      throw new NotFoundException('შეტყობინება ვერ მოიძებნა');
    }

    if (!recipient.isRead) {
      recipient.isRead = true;
      recipient.readAt = new Date();
      await this.notificationRecipientRepository.save(recipient);
    }

    return {
      id: recipient.notification.id,
      title: recipient.notification.title,
      contentHtml: recipient.notification.contentHtml,
      imageUrl: recipient.notification.imageUrl,
      actions: recipient.notification.actions,
      isRead: true,
      createdAt: recipient.notification.createdAt,
    };
  }

  // "ყველას მონიშვნა წაკითხულად" (USER) — მხოლოდ ჯერ წაუკითხავი row-ები
  // იბლოკება ერთი bulk UPDATE-ით.
  async markAllReadForUser(userId: number): Promise<MarkAllReadResponseDto> {
    const result = await this.notificationRecipientRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }
}
