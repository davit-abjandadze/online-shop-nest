# Notifications Module — Implementation Plan

## კონტექსტი

საიტს სჭირდება ადმინის მიერ გაგზავნილი შეტყობინებების სისტემა (ss.ge-ს ტიპის bell/dropdown/modal
პატერნი): ადმინი წერს შეტყობინებას rich-text ედიტორში (ტექსტი, სურათი, ლინკები), ირჩევს ვის
გაეგზავნოს (ყველას თუ კონკრეტულ user(ებ)-ს), user-ი ხედავს bell icon-ზე unread count badge-ს,
დაჭერისას გვერდიდან იხსნება dropdown სია, სიაში ერთ item-ზე დაჭერისას — მოდალი სრული content-ით,
რასაც თან ერთვის mark-as-read.

დაზუსტებული გადაწყვეტილებები:
- **Real-time არ გვჭირდება** — client polling ყოველ 30 წუთში (unread-count ენდფოინთზე).
- **Content ფორმატი** — sanitized HTML string (rich-text ედიტორის, მაგ. TipTap/Quill, output-ი),
  არა structured JSON blocks.
- **Target** — ერთი შეტყობინება უნდა შესძლოს გავეგზავნოს ყველა user-ს ან კონკრეტულ user(ებ)-ს →
  `Notification` + `NotificationRecipient` join-ცხრილი (თითო user-ს თავისი read-სტატუსი).
- **სურათები** — ცალკე upload endpoint, ედიტორი embed-ავს დაბრუნებულ URL-ს content HTML-ში.

## Module structure

```
src/notifications/
  notifications.module.ts
  notifications.controller.ts       # admin routes
  notifications-user.controller.ts  # user-facing routes (ან ერთ კონტროლერში, prefix-ით გამიჯნული)
  notifications.service.ts
  entities/
    notification.entity.ts          # id, title, contentHtml, imageUrl?, createdBy(adminId), createdAt
    notification-recipient.entity.ts # id, notificationId, userId, isRead, readAt
  dto/
    create-notification.dto.ts      # title, contentHtml, imageUrl?, targetUserIds?: number[] (undefined = ყველა)
    notification-response.dto.ts
```

`NotificationsModule` → `TypeOrmModule.forFeature([Notification, NotificationRecipient, User])`,
რეგისტრირდება `src/app.module.ts`-ში. Admin routes `@AdminOnly()`-ის ქვეშ, user routes —
`@UseGuards(JwtAuthGuard)` + `@CurrentUser()`. `@ApiTags('Notifications')`, ქართული `@ApiOperation`
აღწერები, arსებული `PaginatedResponseDto`/`PaginationDto` პატერნის გამოყენებით სიებზე.

---

## Backend

### Phase B1 — Data model + migration ✅

- [x] B1.1 `Notification` entity (`title`, `contentHtml` — sanitized HTML, `imageUrl?`, `createdByUserId`
      → FK `User`, `createdAt`)
- [x] B1.2 `NotificationRecipient` entity (`notificationId` → FK, `userId` → FK, `isRead: boolean`
      default `false`, `readAt?: Date`) — composite ან უნიკალური ინდექსი `(notificationId, userId)`-ზე
- [x] B1.3 Migration ორივე ცხრილზე + ინდექსები (`userId, isRead` — unread-count/list query-სთვის)
- [x] B1.4 `NotificationsModule` skeleton, რეგისტრაცია `app.module.ts`-ში

### Phase B2 — Content sanitization + image upload ✅

- [x] B2.1 HTML sanitizer (მაგ. `sanitize-html` პაკეტი) — allow-list ტეგები/ატრიბუტები
      (`<p>`, `<b>`, `<i>`, `<a href>`, `<img src>`, ...), გამოიძახება `create`-ზე შენახვის წინ
- [x] B2.2 `POST /admin/notifications/upload-image` — ატვირთვა (disk/S3), აბრუნებს URL-ს ედიტორისთვის

### Phase B3 — Admin API (გაგზავნა + ისტორია) ✅

- [x] B3.1 `CreateNotificationDto` (`title`, `contentHtml`, `imageUrl?`, `targetUserIds?: number[]`)
- [x] B3.2 `POST /admin/notifications` — ქმნის `Notification`-ს + bulk-insert `NotificationRecipient`
      (ყველა user თუ `targetUserIds` არაა მითხობილი, TypeORM `createQueryBuilder().insert()` ბულკ ჩასასმელად)
- [x] B3.3 `GET /admin/notifications` — გაგზავნილების paginated ისტორია (`PaginatedResponseDto`)
- [x] B3.4 `DELETE /admin/notifications/:id` — შეტყობინების + recipient-ების წაშლა (cascade)

### Phase B4 — User-facing API ✅

- [x] B4.1 `GET /notifications/unread-count` — `count(NotificationRecipient WHERE userId=me AND isRead=false)`
- [x] B4.2 `GET /notifications` — paginated სია (`title`, snippet, `isRead`, `createdAt`), sort `createdAt DESC`
- [x] B4.3 `GET /notifications/:id` — სრული content (`contentHtml`, `imageUrl`) + auto mark-as-read
      (ან ცალკე `PATCH /notifications/:id/read`, თუ მოდალის გახსნაზე read-ის მარკირება ცალკე ნაბიჯად გვინდა)
- [x] B4.4 `PATCH /notifications/read-all` — ყველას mark-as-read `me`-სთვის

### Phase B5 — გავლა/ტესტები ✅

- [x] B5.1 `yarn build` / `yarn lint` / `yarn test` — რეგრესიის გარეშე (build გადის, ტესტები 9/9,
      `notifications`-ის ფაილებზე lint სუფთაა — დარჩენილი 78 lint error/18 warning ყველა
      `notifications`-თან დაუკავშირებელ, წინასწარ არსებულ ფაილშია: `auth`, `users`, `common`)
- [x] B5.2 Runtime verification: რეალურ Postgres-ზე გაშვებული აპლიკაციის წინააღმდეგ
      ბოლომდე გავლილი: admin ქმნის targeted შეტყობინებას (`targetUserIds`) → user-ის
      unread-count 0→1 → სია აჩვენებს snippet-ს/`isRead:false` → დეტალის გახსნა ავტომატურად
      მარკავს read-ად → unread-count ისევ 0 → broadcast შეტყობინება (`targetUserIds` გამოტოვებული)
      ყველა user-ს ეგზავნება → `read-all` bulk-mark მუშაობს → non-admin-ის მცდელობა
      `POST /admin/notifications`-ზე 403-ს აბრუნებს → admin history სია და cascade `DELETE` მუშაობს
