import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly bookings: BookingsService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    try {
      await this.bookings.syncSeatStates();
      await this.bookings.processNoShow();
      await this.notifications.processRemind15();
    } catch (e) {
      this.logger.error(`Scheduler tick failed: ${e}`);
    }
  }
}
