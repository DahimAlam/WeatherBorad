import type { City, Snapshot } from '../types';
import { cityKey } from './weather';

const memory = new Map<string, unknown>();
let unavailable = false;
export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`weatherboard:${key}`);
    return value == null ? (memory.get(key) as T ?? fallback) : JSON.parse(value) as T;
  } catch { unavailable = true; return memory.get(key) as T ?? fallback; }
}
export function writeStored(key: string, value: unknown): boolean {
  memory.set(key, value);
  try { localStorage.setItem(`weatherboard:${key}`, JSON.stringify(value)); return true; }
  catch { unavailable = true; return false; }
}
export function storageUnavailable(): boolean { return unavailable; }
export function isCity(value: unknown): value is City {
  if (!value || typeof value !== 'object') return false;
  const c = value as City;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.country === 'string' && Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90 && Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180;
}
export function loadFavourites(): City[] {
  const value = readStored<unknown>('favourites', []);
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(isCity).filter(c => { const key = cityKey(c); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 5);
}
export function addFavourite(favourites: City[], city: City): { cities: City[]; error?: string } {
  if (favourites.some(c => cityKey(c) === cityKey(city))) return { cities: favourites, error: 'This city is already in your favourites.' };
  if (favourites.length >= 5) return { cities: favourites, error: 'Your five favourite spots are full. Remove a city to make room.' };
  return { cities: [...favourites, city] };
}
export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot;
  return isCity(s.city) && !!s.weather && Number.isFinite(s.weather.temperature) && Number.isFinite(s.weather.fetchedAt) && Number.isFinite(s.weather.utcOffset) && Array.isArray(s.weather.forecast) && s.weather.forecast.length > 0 && Array.isArray(s.weather.hourly);
}
const CACHE = 'weatherboard-data-v1';
const SNAPSHOT_URL = '/__weatherboard_snapshot__';
export async function saveSnapshot(snapshot: Snapshot): Promise<boolean> {
  const stored = writeStored('last-viewed', snapshot);
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE);
      await cache.put(SNAPSHOT_URL, new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } }));
      return true;
    }
  } catch { /* localStorage is the secondary cache */ }
  return stored;
}
export async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE);
      const response = await cache.match(SNAPSHOT_URL);
      if (response) { const value: unknown = await response.json(); if (isSnapshot(value)) return value; }
    }
  } catch { /* fall back to local storage */ }
  const value = readStored<unknown>('last-viewed', null);
  return isSnapshot(value) ? value : null;
}
