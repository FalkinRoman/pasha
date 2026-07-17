import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LockProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Как у Shelly-импульса: дверь «открыта» ~N секунд. Mock и real отдают одно и то же. */
export const LOCK_PULSE_SECONDS = 5;
/** Имитация сетевой задержки моста в mock (мс). */
const MOCK_LATENCY_MS = 450;
/** Кулдаун повторного открытия из приложения (мс) — зеркало в BookingsService. */
export const LOCK_OPEN_COOLDOWN_MS = 30_000;

export type OpenLockParams = {
  lockId: string;
  userId?: string;
  bookingId?: string;
  provider: LockProvider;
  httpBaseUrl?: string | null;
  httpToken?: string | null;
  mqttTopic?: string | null;
};

export type OpenLockResult = {
  ok: boolean;
  error?: string;
  provider: LockProvider;
  pulseSeconds: number;
  simulated: boolean;
};

@Injectable()
export class LocksService {
  private readonly logger = new Logger(LocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async open(params: OpenLockParams): Promise<OpenLockResult> {
    const provider = params.provider ?? 'mock';
    let success = false;
    let error: string | undefined;

    try {
      if (provider === 'mock') {
        await this.sleep(MOCK_LATENCY_MS);
        this.logger.log(
          `LOCK MOCK open lockId=${params.lockId} pulse=${LOCK_PULSE_SECONDS}s`
        );
        success = true;
      } else if (provider === 'http') {
        await this.openHttp(params);
        success = true;
      } else if (provider === 'mqtt') {
        await this.openMqtt(params);
        success = true;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка замка';
      this.logger.warn(`Lock open failed: ${error}`);
    }

    await this.prisma.lockEvent.create({
      data: {
        userId: params.userId,
        bookingId: params.bookingId,
        lockType: 'main',
        lockTarget: params.lockId,
        provider,
        success,
        error,
      },
    });

    return {
      ok: success,
      error,
      provider,
      pulseSeconds: LOCK_PULSE_SECONDS,
      simulated: provider === 'mock',
    };
  }

  /**
   * Админский тест без брони: шлёт ту же команду, что приложение.
   * В mock — полный цикл + запись LockEvent. При http/mqtt — реальный импульс.
   */
  async testOpen() {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new NotFoundException('Клуб не найден');

    const lockId = club.mainDoorLockId?.trim();
    if (!lockId) {
      throw new BadRequestException(
        'Сначала укажи ID замка главной двери и сохрани'
      );
    }

    const readiness = this.computeReadiness(club);
    if (!readiness.ready && club.lockProvider !== 'mock') {
      throw new BadRequestException(readiness.hint);
    }

    const result = await this.open({
      lockId,
      provider: club.lockProvider,
      httpBaseUrl: club.lockHttpBaseUrl,
      httpToken: club.lockHttpToken,
      mqttTopic: club.lockMqttTopic,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error ?? 'Не удалось открыть замок');
    }

    return {
      ok: true,
      lockId,
      provider: result.provider,
      pulseSeconds: result.pulseSeconds,
      simulated: result.simulated,
      message: result.simulated
        ? `Mock: команда принята, импульс ~${result.pulseSeconds} с (железа нет)`
        : `Команда отправлена на мост, импульс ~${result.pulseSeconds} с`,
    };
  }

  private async openHttp(params: OpenLockParams) {
    const base = String(
      params.httpBaseUrl || this.config.get('LOCK_HTTP_BASE_URL') || ''
    ).replace(/\/$/, '');
    if (!base) throw new Error('LOCK_HTTP_BASE_URL не задан');
    const token = params.httpToken || this.config.get('LOCK_HTTP_TOKEN', '');
    const url = `${base}/open`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        lockId: params.lockId,
        action: 'open',
        type: 'main',
        pulseSeconds: LOCK_PULSE_SECONDS,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
  }

  /** MQTT через HTTP-мост (Home Assistant, Node-RED, Shelly и т.д.) */
  private async openMqtt(params: OpenLockParams) {
    const base = String(
      params.httpBaseUrl || this.config.get('LOCK_HTTP_BASE_URL') || ''
    ).replace(/\/$/, '');
    if (!base) throw new Error('LOCK_HTTP_BASE_URL (MQTT bridge) не задан');
    const topicPrefix =
      params.mqttTopic || this.config.get('LOCK_MQTT_TOPIC', 'stopkek/locks');
    const topic = `${topicPrefix}/${params.lockId}/open`;
    const token = params.httpToken || this.config.get('LOCK_HTTP_TOKEN', '');
    const res = await fetch(`${base}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        topic,
        payload: '1',
        pulseSeconds: LOCK_PULSE_SECONDS,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MQTT bridge ${res.status}: ${text || res.statusText}`);
    }
  }

  async getClubLockConfig() {
    const club = await this.prisma.club.findFirst();
    if (!club) return null;
    const readiness = this.computeReadiness(club);
    return {
      lockProvider: club.lockProvider,
      mainDoorLockId: club.mainDoorLockId,
      lockHttpBaseUrl: club.lockHttpBaseUrl,
      lockHttpToken: club.lockHttpToken ? '••••••••' : null,
      lockMqttTopic: club.lockMqttTopic,
      pulseSeconds: LOCK_PULSE_SECONDS,
      cooldownSeconds: Math.round(LOCK_OPEN_COOLDOWN_MS / 1000),
      ready: readiness.ready,
      readyHint: readiness.hint,
    };
  }

  private computeReadiness(club: {
    lockProvider: LockProvider;
    mainDoorLockId: string | null;
    lockHttpBaseUrl: string | null;
    lockHttpToken: string | null;
    lockMqttTopic: string | null;
  }): { ready: boolean; hint: string } {
    if (!club.mainDoorLockId?.trim()) {
      return {
        ready: false,
        hint: 'Укажи ID замка (например main-door) и сохрани',
      };
    }
    if (club.lockProvider === 'mock') {
      return {
        ready: true,
        hint: 'Mock включён: приложение и тест работают без железа. Позже смени на HTTP и впиши URL моста.',
      };
    }
    const base =
      club.lockHttpBaseUrl?.trim() ||
      String(this.config.get('LOCK_HTTP_BASE_URL') || '').trim();
    if (!base) {
      return {
        ready: false,
        hint: 'Для http/mqtt нужен HTTP base URL моста (или LOCK_HTTP_BASE_URL в env)',
      };
    }
    if (club.lockProvider === 'mqtt' && !club.lockMqttTopic?.trim()) {
      return {
        ready: true,
        hint: 'MQTT: topic не задан — будет stopkek/locks по умолчанию',
      };
    }
    return {
      ready: true,
      hint:
        club.lockProvider === 'http'
          ? 'HTTP: готов к боевому мосту'
          : 'MQTT: готов (через HTTP-мост /publish)',
    };
  }

  async updateClubLockConfig(data: {
    lockProvider?: LockProvider;
    mainDoorLockId?: string;
    lockHttpBaseUrl?: string;
    lockHttpToken?: string;
    lockMqttTopic?: string;
  }) {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new Error('Клуб не найден');
    const update: Record<string, unknown> = {};
    if (data.lockProvider !== undefined) update.lockProvider = data.lockProvider;
    if (data.mainDoorLockId !== undefined) {
      update.mainDoorLockId = data.mainDoorLockId.trim() || null;
    }
    if (data.lockHttpBaseUrl !== undefined) {
      update.lockHttpBaseUrl = data.lockHttpBaseUrl.trim() || null;
    }
    if (data.lockHttpToken !== undefined && data.lockHttpToken !== '••••••••') {
      update.lockHttpToken = data.lockHttpToken.trim() || null;
    }
    if (data.lockMqttTopic !== undefined) {
      update.lockMqttTopic = data.lockMqttTopic.trim() || null;
    }
    await this.prisma.club.update({ where: { id: club.id }, data: update });
    return this.getClubLockConfig();
  }

  async listEvents(page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.lockEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.lockEvent.count(),
    ]);

    const userIds = [
      ...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)),
    ];
    const users =
      userIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, phone: true, name: true, deletedPhone: true },
          });
    const byId = new Map(users.map((u) => [u.id, u]));

    const items = rows.map((r) => {
      const u = r.userId ? byId.get(r.userId) : undefined;
      const phone = u?.phone || u?.deletedPhone || null;
      const name = u?.name?.trim() || null;
      let openedBy: string;
      if (u) {
        openedBy = name ? `${name} · ${phone}` : phone || 'Клиент';
      } else if (!r.userId) {
        openedBy = 'Админ (тест)';
      } else {
        openedBy = 'Клиент удалён';
      }
      return {
        id: r.id,
        lockType: r.lockType,
        lockTarget: r.lockTarget,
        provider: r.provider,
        success: r.success,
        error: r.error,
        createdAt: r.createdAt,
        bookingId: r.bookingId,
        userId: r.userId,
        userPhone: phone,
        userName: name,
        openedBy,
      };
    });

    return {
      items,
      total,
      page: Math.max(1, page),
      pageSize: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
