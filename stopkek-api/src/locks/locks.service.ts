import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LockProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type OpenLockParams = {
  lockId: string;
  userId?: string;
  bookingId?: string;
  provider: LockProvider;
  httpBaseUrl?: string | null;
  httpToken?: string | null;
  mqttTopic?: string | null;
};

@Injectable()
export class LocksService {
  private readonly logger = new Logger(LocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async open(params: OpenLockParams): Promise<{ ok: boolean; error?: string }> {
    const provider = params.provider ?? 'mock';
    let success = false;
    let error: string | undefined;

    try {
      if (provider === 'mock') {
        this.logger.log(`LOCK MOCK open main-door lockId=${params.lockId}`);
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

    return { ok: success, error };
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
    const topicPrefix = params.mqttTopic || this.config.get('LOCK_MQTT_TOPIC', 'stopkek/locks');
    const topic = `${topicPrefix}/${params.lockId}/open`;
    const token = params.httpToken || this.config.get('LOCK_HTTP_TOKEN', '');
    const res = await fetch(`${base}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ topic, payload: '1' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MQTT bridge ${res.status}: ${text || res.statusText}`);
    }
  }

  async getClubLockConfig() {
    const club = await this.prisma.club.findFirst();
    if (!club) return null;
    return {
      lockProvider: club.lockProvider,
      mainDoorLockId: club.mainDoorLockId,
      lockHttpBaseUrl: club.lockHttpBaseUrl,
      lockHttpToken: club.lockHttpToken ? '••••••••' : null,
      lockMqttTopic: club.lockMqttTopic,
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
    return this.prisma.club.update({ where: { id: club.id }, data: update });
  }

  listEvents(limit = 50) {
    return this.prisma.lockEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
