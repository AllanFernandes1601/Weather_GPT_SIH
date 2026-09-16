import { SmsSubscription } from '../types';

export type CreateSubscriptionInput = Omit<SmsSubscription, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateSubscriptionInput = Partial<
  Omit<SmsSubscription, 'id' | 'createdAt' | 'updatedAt' | 'phoneNumber'>
>;

/**
 * Storage interface for managing SMS weather-alert subscriptions.
 */
export interface ISmsSubscriptionStorage {
  /**
   * Creates and stores a new subscription with server-generated ID and timestamps.
   */
  createSubscription(input: CreateSubscriptionInput): Promise<SmsSubscription>;

  /**
   * Retrieves a single subscription by its unique ID.
   */
  getSubscriptionById(id: string): Promise<SmsSubscription | null>;

  /**
   * Retrieves all currently active subscriptions (isActive === true).
   */
  getAllActiveSubscriptions(): Promise<SmsSubscription[]>;

  /**
   * Updates an existing subscription by ID.
   */
  updateSubscription(id: string, updates: UpdateSubscriptionInput): Promise<SmsSubscription | null>;

  /**
   * Deactivates an existing subscription (sets isActive = false).
   */
  deleteSubscription(id: string): Promise<boolean>;
}
