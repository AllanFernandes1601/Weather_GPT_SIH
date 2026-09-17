export interface CreateSmsSubscriptionPayload {
  phoneNumber: string;
  location: {
    name?: string;
    district?: string;
    state?: string;
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  alertTypes: string[];
  minSeverity?: 'moderate' | 'high' | 'severe';
  preferredLanguage?: 'en' | 'hi' | 'kn';
}

export interface PublicSmsSubscription {
  id: string;
  phoneNumber: string;
  phoneMasked?: string;
  location: {
    name?: string;
    district?: string;
    state?: string;
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  alertTypes: string[];
  minSeverity: string;
  preferredLanguage: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmsSubscriptionResponse {
  message: string;
  subscription: PublicSmsSubscription;
}

/**
 * Submits a new SMS weather-alert subscription to the backend.
 * Full phone number is passed strictly over HTTP to the backend and never stored in localStorage.
 */
export async function createSmsSubscription(
  payload: CreateSmsSubscriptionPayload
): Promise<CreateSmsSubscriptionResponse> {
  const response = await fetch('/api/sms/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Failed to parse server response');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Subscription failed with status ${response.status}`);
  }

  return data as CreateSmsSubscriptionResponse;
}
