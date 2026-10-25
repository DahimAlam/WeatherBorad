import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addFavourite, isSnapshot, loadFavourites, readStored, writeStored } from '../../src/lib/storage';
import { DEFAULT_CITY, normalizeMeteo } from '../../src/lib/weather';
import { validReminderTime } from '../../src/lib/notifications';
import { meteoFixture } from '../fixtures';

beforeEach(() => { const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }); });
describe('favourites and resilient persistence', () => {
  it('limits saved cities to five', () => { const cities = Array.from({ length: 5 }, (_, i) => ({ ...DEFAULT_CITY, id: String(i), latitude: i })); expect(addFavourite(cities, DEFAULT_CITY).error).toContain('five'); });
  it('prevents duplicate cities from different providers', () => { expect(addFavourite([DEFAULT_CITY], { ...DEFAULT_CITY, id: 'another-provider' }).error).toContain('already'); });
  it('persists and validates favourites', () => { writeStored('favourites', [DEFAULT_CITY, {}, DEFAULT_CITY]); expect(loadFavourites()).toEqual([DEFAULT_CITY]); });
  it('recovers from corrupted storage', () => { localStorage.setItem('weatherboard:corrupt-test', '{broken'); expect(readStored('corrupt-test', 'fallback')).toBe('fallback'); });
  it('continues in memory if storage access is blocked', () => { vi.stubGlobal('localStorage', { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } }); expect(writeStored('memory-test', 'saved')).toBe(false); expect(readStored('memory-test', '')).toBe('saved'); });
  it('accepts usable snapshots and rejects malformed ones', () => { expect(isSnapshot({ city: DEFAULT_CITY, weather: normalizeMeteo(meteoFixture()) })).toBe(true); expect(isSnapshot({ city: DEFAULT_CITY, weather: {} })).toBe(false); });
});
it('validates reminder times including midnight', () => { expect(validReminderTime('00:00')).toBe(true); expect(validReminderTime('08:30')).toBe(true); expect(validReminderTime('24:00')).toBe(false); expect(validReminderTime('')).toBe(false); });
