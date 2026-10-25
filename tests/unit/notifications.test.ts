import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('reminder preferences', () => {
  it.each([null, [], { time: '25:00', enabled: true }, { time: 830, enabled: true }])('recovers from malformed saved state: %j', async value => {
    localStorage.setItem('weatherboard:reminder', JSON.stringify(value));
    const { readReminderPreference } = await import('../../src/lib/notifications');
    expect(readReminderPreference()).toEqual({ enabled: false, time: '08:00' });
  });
  it('does not overwrite an acknowledged schedule when the input loses focus', async () => {
    localStorage.setItem('weatherboard:reminder', JSON.stringify({ enabled: true, time: '08:00' }));
    const { readReminderPreference, saveReminderPreference } = await import('../../src/lib/notifications');
    saveReminderPreference('09:30');
    expect(readReminderPreference()).toEqual({ enabled: true, time: '08:00' });
  });
  it('saves a preferred time before activation', async () => {
    const { readReminderPreference, saveReminderPreference } = await import('../../src/lib/notifications');
    expect(saveReminderPreference('09:30')).toBe(true);
    expect(readReminderPreference()).toEqual({ enabled: false, time: '09:30' });
    expect(saveReminderPreference('')).toBe(false);
  });
});

describe('scheduler acknowledgement', () => {
  async function setup(status: number) {
    vi.stubEnv('VITE_PUSH_API_URL', 'https://scheduler.example');
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'dGVzdA');
    const notification = { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') };
    vi.stubGlobal('Notification', notification);
    vi.stubGlobal('window', { Notification: notification, PushManager: {} });
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { endpoint: 'https://push.example/subscription', toJSON: () => ({ endpoint: 'https://push.example/subscription' }), unsubscribe };
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    localStorage.setItem('weatherboard:reminder', JSON.stringify({ enabled: true, time: '08:00' }));
    return { api: await import('../../src/lib/notifications'), unsubscribe };
  }
  it('preserves the existing schedule after a rejected update', async () => {
    const { api } = await setup(503);
    await expect(api.enableReminder('09:30')).rejects.toThrow('could not be scheduled');
    expect(api.readReminderPreference()).toEqual({ enabled: true, time: '08:00' });
  });
  it('persists a new time only after a successful server response', async () => {
    const { api } = await setup(200);
    await api.enableReminder('09:30');
    expect(api.readReminderPreference()).toEqual({ enabled: true, time: '09:30' });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.time).toBe('09:30'); expect(body.timezone).toBeTruthy();
  });
  it('explains a network failure and preserves the last acknowledged time', async () => {
    const { api } = await setup(200);
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.enableReminder('09:30')).rejects.toThrow('Check your connection');
    expect(api.readReminderPreference()).toEqual({ enabled: true, time: '08:00' });
  });
  it('preserves the subscription if the server rejects cancellation', async () => {
    const { api, unsubscribe } = await setup(503);
    await expect(api.disableReminder()).rejects.toThrow('could not be turned off');
    expect(unsubscribe).not.toHaveBeenCalled(); expect(api.readReminderPreference().enabled).toBe(true);
  });
  it('cancels successfully without discarding the preferred time', async () => {
    const { api, unsubscribe } = await setup(200);
    await api.disableReminder();
    expect(unsubscribe).toHaveBeenCalledOnce(); expect(api.readReminderPreference()).toEqual({ enabled: false, time: '08:00' });
  });
});
