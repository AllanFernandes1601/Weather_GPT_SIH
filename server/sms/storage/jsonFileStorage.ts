import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { SmsSubscription, SmsDeliveryRecord, SmsAlertType } from '../types';
import {
  ISmsSubscriptionStorage,
  ISmsDeliveryStorage,
  CreateSubscriptionInput,
  UpdateSubscriptionInput
} from './storage.interface';

/**
 * JSON file-based subscription storage designed for local development and hackathons.
 *
 * Guarantees:
 * - Atomic writes via temporary files and rename to avoid partial/corrupt files.
 * - Concurrency safety via an in-process serialized execution queue.
 * - Automatic directory and file provisioning on initial read/write.
 */
export class JsonFileSubscriptionStorage implements ISmsSubscriptionStorage {
  private readonly filePath: string;
  private readonly dataDir: string;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), 'data', 'sms_subscriptions.json');
    this.dataDir = path.dirname(this.filePath);
  }

  /**
   * Serializes operations to avoid overlapping file writes.
   */
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next;
    return next;
  }

  /**
   * Ensures the storage file and enclosing directory exist.
   */
  private async ensureInitialized(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      // File does not exist, initialize with empty array atomically
      await this.writeRawRecords([]);
    }
  }

  /**
   * Reads raw subscriptions from JSON file.
   */
  private async readRawRecords(): Promise<SmsSubscription[]> {
    await this.ensureInitialized();
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      console.error('[JsonFileStorage] Failed reading subscription file, resetting to empty:', err.message);
      return [];
    }
  }

  /**
   * Atomically writes subscription array to disk using a temporary file and rename.
   */
  private async writeRawRecords(records: SmsSubscription[]): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const tmpPath = `${this.filePath}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
    const dataString = JSON.stringify(records, null, 2);

    try {
      await fs.writeFile(tmpPath, dataString, 'utf-8');
      try {
        await fs.rename(tmpPath, this.filePath);
      } catch (renameErr: any) {
        // Fallback for Windows locking anomalies
        if (renameErr.code === 'EEXIST' || renameErr.code === 'EPERM') {
          await fs.unlink(this.filePath).catch(() => {});
          await fs.rename(tmpPath, this.filePath);
        } else {
          throw renameErr;
        }
      }
    } finally {
      // Clean up tmp file if still present
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SmsSubscription> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      const now = new Date().toISOString();

      const newSubscription: SmsSubscription = {
        id: `sub_${randomUUID()}`,
        phoneNumber: input.phoneNumber,
        location: {
          name: input.location.name,
          district: input.location.district,
          state: input.location.state,
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          radiusKm: input.location.radiusKm
        },
        alertTypes: input.alertTypes,
        minSeverity: input.minSeverity,
        preferredLanguage: input.preferredLanguage,
        isActive: input.isActive,
        isVerified: input.isVerified,
        createdAt: now,
        updatedAt: now
      };

      records.push(newSubscription);
      await this.writeRawRecords(records);
      return newSubscription;
    });
  }

  async getSubscriptionById(id: string): Promise<SmsSubscription | null> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      const found = records.find((item) => item.id === id);
      return found || null;
    });
  }

  async getAllActiveSubscriptions(): Promise<SmsSubscription[]> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      return records.filter((item) => item.isActive);
    });
  }

  async updateSubscription(
    id: string,
    updates: UpdateSubscriptionInput
  ): Promise<SmsSubscription | null> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      const index = records.findIndex((item) => item.id === id);
      if (index === -1) return null;

      const existing = records[index];
      const now = new Date().toISOString();

      const updated: SmsSubscription = {
        ...existing,
        location: updates.location
          ? {
              ...existing.location,
              ...updates.location
            }
          : existing.location,
        alertTypes: updates.alertTypes !== undefined ? updates.alertTypes : existing.alertTypes,
        minSeverity: updates.minSeverity !== undefined ? updates.minSeverity : existing.minSeverity,
        preferredLanguage:
          updates.preferredLanguage !== undefined ? updates.preferredLanguage : existing.preferredLanguage,
        isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
        isVerified: updates.isVerified !== undefined ? updates.isVerified : existing.isVerified,
        updatedAt: now
      };

      records[index] = updated;
      await this.writeRawRecords(records);
      return updated;
    });
  }

  async deleteSubscription(id: string): Promise<boolean> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      const index = records.findIndex((item) => item.id === id);
      if (index === -1) return false;

      // Soft-delete / deactivation for MVP
      records[index].isActive = false;
      records[index].updatedAt = new Date().toISOString();

      await this.writeRawRecords(records);
      return true;
    });
  }
}

/**
 * JSON file-based delivery audit record storage.
 *
 * Guarantees:
 * - Writes to data/sms_deliveries.json
 * - Atomic temp file write + rename
 * - Serialized write queue
 * - Never stores full phone numbers (SmsDeliveryRecord uses phoneMasked exclusively)
 */
export class JsonFileDeliveryStorage implements ISmsDeliveryStorage {
  private readonly filePath: string;
  private readonly dataDir: string;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), 'data', 'sms_deliveries.json');
    this.dataDir = path.dirname(this.filePath);
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next;
    return next;
  }

  private async ensureInitialized(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeRawRecords([]);
    }
  }

  private async readRawRecords(): Promise<SmsDeliveryRecord[]> {
    await this.ensureInitialized();
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      console.error('[JsonFileDeliveryStorage] Error reading deliveries, fallback empty:', err.message);
      return [];
    }
  }

  private async writeRawRecords(records: SmsDeliveryRecord[]): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const tmpPath = `${this.filePath}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
    const dataString = JSON.stringify(records, null, 2);

    try {
      await fs.writeFile(tmpPath, dataString, 'utf-8');
      try {
        await fs.rename(tmpPath, this.filePath);
      } catch (renameErr: any) {
        if (renameErr.code === 'EEXIST' || renameErr.code === 'EPERM') {
          await fs.unlink(this.filePath).catch(() => {});
          await fs.rename(tmpPath, this.filePath);
        } else {
          throw renameErr;
        }
      }
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  async recordDelivery(record: SmsDeliveryRecord): Promise<void> {
    await this.runExclusive(async () => {
      const records = await this.readRawRecords();
      records.push(record);
      await this.writeRawRecords(records);
    });
  }

  async getRecentDeliveriesForSubscription(
    subscriptionId: string,
    alertType?: SmsAlertType,
    windowMs?: number
  ): Promise<SmsDeliveryRecord[]> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      const now = Date.now();

      return records.filter((r) => {
        if (r.subscriptionId !== subscriptionId) return false;
        if (alertType && r.alertType !== alertType) return false;
        if (windowMs !== undefined && windowMs > 0) {
          const sentTime = new Date(r.sentAt).getTime();
          if (isNaN(sentTime) || now - sentTime > windowMs) return false;
        }
        return true;
      });
    });
  }

  async getAllDeliveries(limit?: number): Promise<SmsDeliveryRecord[]> {
    return this.runExclusive(async () => {
      const records = await this.readRawRecords();
      if (limit !== undefined && limit > 0) {
        return records.slice(-limit);
      }
      return records;
    });
  }
}
