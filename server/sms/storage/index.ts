import { ISmsSubscriptionStorage } from './storage.interface';
import { JsonFileSubscriptionStorage } from './jsonFileStorage';

export * from './storage.interface';
export * from './jsonFileStorage';

let defaultStorage: ISmsSubscriptionStorage | null = null;

/**
 * Returns the active ISmsSubscriptionStorage instance.
 */
export function getSubscriptionStorage(): ISmsSubscriptionStorage {
  if (!defaultStorage) {
    defaultStorage = new JsonFileSubscriptionStorage();
  }
  return defaultStorage;
}
