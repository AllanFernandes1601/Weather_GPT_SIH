import { Router, Request, Response } from 'express';
import {
  SmsAlertType,
  AlertSeverity,
  PreferredLanguage,
  SmsSubscription,
  isValidE164PhoneNumber,
  maskPhoneNumber
} from './types';
import { getSubscriptionStorage } from './storage';

export const smsRouter = Router();

const VALID_ALERT_TYPES: ReadonlySet<string> = new Set<SmsAlertType>([
  'heavy_rain',
  'flood',
  'thunderstorm',
  'strong_wind',
  'extreme_heat',
  'extreme_cold',
  'air_quality',
  'other'
]);

const VALID_SEVERITIES: ReadonlySet<string> = new Set<AlertSeverity>([
  'low',
  'moderate',
  'high',
  'severe'
]);

const VALID_LANGUAGES: ReadonlySet<string> = new Set<PreferredLanguage>([
  'en',
  'hi',
  'kn'
]);

/**
 * Strips/masks sensitive fields before returning subscriptions to clients.
 */
function toPublicSubscription(sub: SmsSubscription) {
  return {
    ...sub,
    phoneNumber: maskPhoneNumber(sub.phoneNumber)
  };
}

/**
 * POST /api/sms/subscriptions
 * Registers a new location-aware SMS alert subscription.
 */
smsRouter.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const {
      phoneNumber,
      location,
      alertTypes,
      minSeverity,
      preferredLanguage
    } = req.body || {};

    // 1. Phone number validation
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'phoneNumber is required and must be a string' });
    }
    const cleanPhone = phoneNumber.trim();
    if (!isValidE164PhoneNumber(cleanPhone)) {
      return res.status(400).json({
        error: 'Invalid phoneNumber: Must follow E.164 format (e.g. +919876543210)'
      });
    }

    // 2. Location validation
    if (!location || typeof location !== 'object' || Array.isArray(location)) {
      return res.status(400).json({ error: 'location object is required' });
    }

    const { latitude, longitude, radiusKm, name, district, state } = location;

    if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'location.latitude must be a valid number between -90 and 90' });
    }

    if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'location.longitude must be a valid number between -180 and 180' });
    }

    let parsedRadiusKm = 25; // Default radius
    if (radiusKm !== undefined && radiusKm !== null) {
      if (typeof radiusKm !== 'number' || isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
        return res.status(400).json({ error: 'location.radiusKm must be a positive number up to 100 km' });
      }
      parsedRadiusKm = radiusKm;
    }

    // 3. Alert types validation
    if (!Array.isArray(alertTypes) || alertTypes.length === 0) {
      return res.status(400).json({ error: 'alertTypes must be a non-empty array of valid alert types' });
    }

    const uniqueAlertTypes: SmsAlertType[] = [];
    for (const item of alertTypes) {
      if (typeof item !== 'string' || !VALID_ALERT_TYPES.has(item)) {
        return res.status(400).json({
          error: `Invalid alertType "${item}". Supported types: ${Array.from(VALID_ALERT_TYPES).join(', ')}`
        });
      }
      if (!uniqueAlertTypes.includes(item as SmsAlertType)) {
        uniqueAlertTypes.push(item as SmsAlertType);
      }
    }

    // 4. Minimum severity validation (default: high)
    let parsedSeverity: AlertSeverity = 'high';
    if (minSeverity !== undefined && minSeverity !== null) {
      if (typeof minSeverity !== 'string' || !VALID_SEVERITIES.has(minSeverity)) {
        return res.status(400).json({
          error: `Invalid minSeverity "${minSeverity}". Supported values: ${Array.from(VALID_SEVERITIES).join(', ')}`
        });
      }
      parsedSeverity = minSeverity as AlertSeverity;
    }

    // 5. Preferred language validation (default: en)
    let parsedLanguage: PreferredLanguage = 'en';
    if (preferredLanguage !== undefined && preferredLanguage !== null) {
      if (typeof preferredLanguage !== 'string' || !VALID_LANGUAGES.has(preferredLanguage)) {
        return res.status(400).json({
          error: `Invalid preferredLanguage "${preferredLanguage}". Supported values: ${Array.from(VALID_LANGUAGES).join(', ')}`
        });
      }
      parsedLanguage = preferredLanguage as PreferredLanguage;
    }

    const storage = getSubscriptionStorage();
    const created = await storage.createSubscription({
      phoneNumber: cleanPhone,
      location: {
        name: typeof name === 'string' ? name.trim() : undefined,
        district: typeof district === 'string' ? district.trim() : undefined,
        state: typeof state === 'string' ? state.trim() : undefined,
        latitude,
        longitude,
        radiusKm: parsedRadiusKm
      },
      alertTypes: uniqueAlertTypes,
      minSeverity: parsedSeverity,
      preferredLanguage: parsedLanguage,
      isActive: true,
      isVerified: false
    });

    return res.status(201).json({
      message: 'Subscription created successfully',
      subscription: toPublicSubscription(created)
    });
  } catch (error: any) {
    console.error('[SMS Subscriptions POST Error]:', error?.message || error);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * GET /api/sms/subscriptions/:id
 * Retrieves an existing subscription with masked phone privacy.
 */
smsRouter.get('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const storage = getSubscriptionStorage();
    const found = await storage.getSubscriptionById(id);

    if (!found) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    return res.json(toPublicSubscription(found));
  } catch (error: any) {
    console.error('[SMS Subscriptions GET Error]:', error?.message || error);
    return res.status(500).json({ error: 'Failed to retrieve subscription' });
  }
});

/**
 * PATCH /api/sms/subscriptions/:id
 * Updates alert preferences, location, or status of an existing subscription.
 */
smsRouter.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const storage = getSubscriptionStorage();
    const existing = await storage.getSubscriptionById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Explicitly reject attempts to change immutable fields
    if (req.body?.phoneNumber !== undefined && req.body.phoneNumber !== existing.phoneNumber) {
      return res.status(400).json({ error: 'Changing phoneNumber via PATCH is not allowed' });
    }
    if (req.body?.id !== undefined && req.body.id !== id) {
      return res.status(400).json({ error: 'Changing subscription id is not allowed' });
    }
    if (req.body?.createdAt !== undefined) {
      return res.status(400).json({ error: 'Changing createdAt is not allowed' });
    }

    const updates: Parameters<typeof storage.updateSubscription>[1] = {};

    // 1. Location updates
    if (req.body?.location !== undefined) {
      const loc = req.body.location;
      if (!loc || typeof loc !== 'object' || Array.isArray(loc)) {
        return res.status(400).json({ error: 'location must be an object' });
      }

      const targetLat = loc.latitude !== undefined ? loc.latitude : existing.location.latitude;
      const targetLon = loc.longitude !== undefined ? loc.longitude : existing.location.longitude;
      const targetRadius = loc.radiusKm !== undefined ? loc.radiusKm : existing.location.radiusKm;

      if (typeof targetLat !== 'number' || isNaN(targetLat) || targetLat < -90 || targetLat > 90) {
        return res.status(400).json({ error: 'location.latitude must be a valid number between -90 and 90' });
      }
      if (typeof targetLon !== 'number' || isNaN(targetLon) || targetLon < -180 || targetLon > 180) {
        return res.status(400).json({ error: 'location.longitude must be a valid number between -180 and 180' });
      }
      if (typeof targetRadius !== 'number' || isNaN(targetRadius) || targetRadius <= 0 || targetRadius > 100) {
        return res.status(400).json({ error: 'location.radiusKm must be a positive number up to 100 km' });
      }

      updates.location = {
        name: loc.name !== undefined ? (typeof loc.name === 'string' ? loc.name.trim() : undefined) : existing.location.name,
        district: loc.district !== undefined ? (typeof loc.district === 'string' ? loc.district.trim() : undefined) : existing.location.district,
        state: loc.state !== undefined ? (typeof loc.state === 'string' ? loc.state.trim() : undefined) : existing.location.state,
        latitude: targetLat,
        longitude: targetLon,
        radiusKm: targetRadius
      };
    }

    // 2. Alert types updates
    if (req.body?.alertTypes !== undefined) {
      if (!Array.isArray(req.body.alertTypes) || req.body.alertTypes.length === 0) {
        return res.status(400).json({ error: 'alertTypes must be a non-empty array' });
      }
      const uniqueAlertTypes: SmsAlertType[] = [];
      for (const item of req.body.alertTypes) {
        if (typeof item !== 'string' || !VALID_ALERT_TYPES.has(item)) {
          return res.status(400).json({
            error: `Invalid alertType "${item}". Supported types: ${Array.from(VALID_ALERT_TYPES).join(', ')}`
          });
        }
        if (!uniqueAlertTypes.includes(item as SmsAlertType)) {
          uniqueAlertTypes.push(item as SmsAlertType);
        }
      }
      updates.alertTypes = uniqueAlertTypes;
    }

    // 3. Minimum severity update
    if (req.body?.minSeverity !== undefined) {
      if (typeof req.body.minSeverity !== 'string' || !VALID_SEVERITIES.has(req.body.minSeverity)) {
        return res.status(400).json({
          error: `Invalid minSeverity "${req.body.minSeverity}". Supported values: ${Array.from(VALID_SEVERITIES).join(', ')}`
        });
      }
      updates.minSeverity = req.body.minSeverity as AlertSeverity;
    }

    // 4. Preferred language update
    if (req.body?.preferredLanguage !== undefined) {
      if (typeof req.body.preferredLanguage !== 'string' || !VALID_LANGUAGES.has(req.body.preferredLanguage)) {
        return res.status(400).json({
          error: `Invalid preferredLanguage "${req.body.preferredLanguage}". Supported values: ${Array.from(VALID_LANGUAGES).join(', ')}`
        });
      }
      updates.preferredLanguage = req.body.preferredLanguage as PreferredLanguage;
    }

    // 5. Active state update
    if (req.body?.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }
      updates.isActive = req.body.isActive;
    }

    const updated = await storage.updateSubscription(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    return res.json({
      message: 'Subscription updated successfully',
      subscription: toPublicSubscription(updated)
    });
  } catch (error: any) {
    console.error('[SMS Subscriptions PATCH Error]:', error?.message || error);
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * DELETE /api/sms/subscriptions/:id
 * Deactivates a subscription (soft-delete).
 */
smsRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const storage = getSubscriptionStorage();
    const success = await storage.deleteSubscription(id);

    if (!success) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    return res.json({
      success: true,
      message: 'Subscription deactivated successfully'
    });
  } catch (error: any) {
    console.error('[SMS Subscriptions DELETE Error]:', error?.message || error);
    return res.status(500).json({ error: 'Failed to deactivate subscription' });
  }
});
