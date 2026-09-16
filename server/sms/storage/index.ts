import { ISmsSubscriptionStorage, ISmsDeliveryStorage } from './storage.interface';
import { JsonFileSubscriptionStorage, JsonFileDeliveryStorage } from './jsonFileStorage';

export * from './storage.interface';
export * from './jsonFileStorage';

let defaultSubscriptionStorage: ISmsSubscriptionStorage | null = null;
let defaultDeliveryStorage: ISmsDeliveryStorage | null = null;

/**
 * Returns the active ISmsSubscriptionStorage instance.
 */
export function getSubscriptionStorage(): ISmsSubscriptionStorage {
  if (!defaultSubscriptionStorage) {
    defaultSubscriptionStorage = new JsonFileSubscriptionStorage();
  }
  return defaultSubscriptionStorage;
}

/**
 * Returns the active ISmsDeliveryStorage instance.
 */
export function getDeliveryStorage(): ISmsDeliveryStorage {
  if (!defaultDeliveryStorage) {
    defaultDeliveryStorage = new JsonFileDeliveryStorage();
  }
  return defaultDeliveryStorage;
}
