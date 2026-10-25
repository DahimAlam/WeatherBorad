import { readStored, writeStored } from './storage';

const pushUrl = import.meta.env.VITE_PUSH_API_URL?.replace(/\/$/, '');
const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
export const pushConfigured = !!pushUrl && !!vapidKey;
export function notificationsSupported(): boolean { return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window; }
export function validReminderTime(time: unknown): time is string { return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time); }
export interface ReminderPreference { enabled: boolean; time: string }
export function readReminderPreference(): ReminderPreference {
  const value = readStored<unknown>('reminder', null);
  if (!value || typeof value !== 'object') return { enabled: false, time: '08:00' };
  const saved = value as Partial<ReminderPreference>;
  if (!validReminderTime(saved.time)) return { enabled: false, time: '08:00' };
  return { enabled: saved.enabled === true, time: saved.time };
}
export function saveReminderPreference(time: string): boolean {
  if (!validReminderTime(time)) return false;
  const saved = readReminderPreference();
  // Editing an active reminder must not change the acknowledged schedule.
  // enableReminder persists the new time only after the service accepts it.
  if (saved.enabled) return true;
  return writeStored('reminder', { enabled: false, time });
}
async function workerReady(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) throw new Error('Offline setup is still finishing. Wait a moment, then try again.');
  return registration;
}
async function updateSchedule(method: 'POST' | 'DELETE', payload: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${pushUrl}/subscriptions`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error('Could not reach the reminder service. Check your connection and try again. Your previous schedule has not been changed in this app.');
  }
  if (!response.ok) throw new Error(method === 'POST' ? 'Your reminder could not be scheduled. Please try again.' : 'The reminder could not be turned off. Please try again.');
}
export async function requestPermission(): Promise<void> {
  if (!notificationsSupported()) throw new Error('This browser does not support reminders. Try Chrome or Edge, or install this app on a supported device.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Allow them in your browser’s site settings, then try again.');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Permission was not granted. You can continue using all weather features.');
}
export async function sendTestNotification(): Promise<void> {
  await requestPermission();
  const registration = await workerReady();
  await registration.showNotification('A little clarity for your day ☀', { body: 'Your WeatherBoard notifications are working. Open the dashboard for your latest forecast.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'weatherboard-test', data: { url: '/' } });
}
export async function enableReminder(time: string): Promise<void> {
  if (!validReminderTime(time)) throw new Error('Choose a valid reminder time.');
  if (!pushConfigured) throw new Error('Daily reminders are not available on this deployment yet. You can still send a test notification.');
  await requestPermission();
  const registration = await workerReady();
  const raw = atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/'));
  const applicationServerKey = Uint8Array.from(raw, c => c.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  await updateSchedule('POST', { subscription: subscription.toJSON(), time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  writeStored('reminder', { enabled: true, time });
}
export async function disableReminder(): Promise<void> {
  const saved = readReminderPreference();
  if (!pushConfigured) { writeStored('reminder', { enabled: false, time: saved.time }); return; }
  const registration = await workerReady();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await updateSchedule('DELETE', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
  writeStored('reminder', { enabled: false, time: saved.time });
}
