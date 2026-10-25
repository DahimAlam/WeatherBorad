import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, cityDate, cityKey, compass, DEFAULT_CITY, fetchWeather, normalizeMeteo, normalizeOwm, owmCondition, requestJson, temperature, timeLabel, validateSearch, wmoCondition } from '../../src/lib/weather';
import { geodbFixture, meteoFixture, owmFixture } from '../fixtures';
import { searchCities } from '../../src/lib/weather';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('weather normalization and presentation', () => {
  it('normalizes current, five daily and eight hourly readings', () => {
    const weather = normalizeMeteo(meteoFixture());
    expect(weather.temperature).toBe(22); expect(weather.forecast).toHaveLength(5); expect(weather.hourly).toHaveLength(8);
    expect(weather.humidity).toBe(64); expect(weather.visibility).toBe(24); expect(weather.condition).toBe('partly-cloudy');
  });
  it('rejects incomplete provider data rather than displaying invented weather', () => {
    const data = meteoFixture(); data.daily.time = [];
    expect(() => normalizeMeteo(data)).toThrow(ApiError);
  });
  it('maps the supported WMO and OWM conditions', () => {
    expect([0, 2, 3, 45, 61, 73, 95].map(wmoCondition)).toEqual(['clear', 'partly-cloudy', 'cloudy', 'fog', 'rain', 'snow', 'storm']);
    expect([800, 801, 804, 741, 500, 601, 201].map(owmCondition)).toEqual(['clear', 'partly-cloudy', 'cloudy', 'fog', 'rain', 'snow', 'storm']);
  });
  it('converts temperatures without fetching and handles negative values', () => { expect(temperature(0, 'f')).toBe(32); expect(temperature(-40, 'f')).toBe(-40); expect(temperature(22.7, 'c')).toBe(23); });
  it('formats local times and wind directions', () => { expect(timeLabel('2026-10-25T00:05')).toBe('12:05 AM'); expect(timeLabel('2026-10-25T18:42')).toBe('6:42 PM'); expect(timeLabel(null)).toBe('—'); expect(compass(360)).toBe('N'); expect(compass(225)).toBe('SW'); });
  it('uses the city offset across date boundaries', () => { const weather = { ...normalizeMeteo(meteoFixture()), utcOffset: 18000 }; expect(cityDate(weather, Date.parse('2026-10-24T22:00:00Z')).toISOString()).toBe('2026-10-25T03:00:00.000Z'); });
  it('validates blank and short searches but permits international names', () => { expect(validateSearch(' ')).toContain('Enter'); expect(validateSearch('a')).toContain('2 characters'); expect(validateSearch('東京')).toBe(''); expect(validateSearch('São Paulo')).toBe(''); });
  it('identifies the same city across providers by coordinates', () => { expect(cityKey(DEFAULT_CITY)).toBe(cityKey({ ...DEFAULT_CITY, id: 'geodb-123' })); });
  it('groups OpenWeatherMap slots into city-local calendar days', () => {
    const item = { dt: Date.parse('2026-10-24T21:00:00Z') / 1000, main: { temp: 20, feels_like: 19, humidity: 50, temp_min: 18, temp_max: 22 }, weather: [{ id: 800, description: 'clear sky', icon: '01d' }], wind: { speed: 5, deg: 90 }, pop: .3 };
    const weather = normalizeOwm({ ...item, timezone: 18000, sys: { sunrise: item.dt, sunset: item.dt + 36000 } }, { list: [item, { ...item, dt: item.dt + 10800, main: { ...item.main, temp_min: 17, temp_max: 25 } }], city: { timezone: 18000 } });
    expect(weather.forecast[0]).toMatchObject({ date: '2026-10-25', low: 17, high: 25, rainChance: 30 }); expect(weather.windSpeed).toBe(18); expect(weather.uv).toBeNull();
  });
});
describe('network failures and fallback', () => {
  it('uses both OpenWeatherMap endpoints when configured', async () => {
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'test-only-key');
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/forecast?') ? owmFixture().forecast : owmFixture().current)));
    vi.stubGlobal('fetch', fetchMock);
    const weather = await fetchWeather(DEFAULT_CITY);
    expect(weather.source).toBe('OpenWeatherMap'); expect(weather.forecast).toHaveLength(5); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('normalizes GeoDB results and caches a repeated search', async () => {
    vi.stubEnv('VITE_CITY_SEARCH_PROVIDER', 'rapidapi');
    vi.stubEnv('VITE_GEODB_API_KEY', 'test-only-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(geodbFixture())));
    vi.stubGlobal('fetch', fetchMock);
    const cities = await searchCities('Paris cache test');
    expect(cities[0]).toMatchObject({ name: 'Paris', country: 'France', id: 'geodb-2988507' });
    expect(await searchCities('Paris cache test')).toEqual(cities); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers['X-RapidAPI-Host']).toBe('wft-geo-db.p.rapidapi.com');
  });
  it('explains a missing GeoDB subscription', async () => {
    vi.stubEnv('VITE_CITY_SEARCH_PROVIDER', 'rapidapi');
    vi.stubEnv('VITE_GEODB_API_KEY', 'test-only-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(searchCities('Unsubscribed')).rejects.toThrow('active GeoDB Cities subscription');
  });
  it('rejects malformed GeoDB responses', async () => {
    vi.stubEnv('VITE_GEODB_API_KEY', 'test-only-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(searchCities('Malformed')).rejects.toThrow('incomplete data');
  });
  it('uses free GeoDB without sending a saved RapidAPI credential', async () => {
    vi.stubEnv('VITE_CITY_SEARCH_PROVIDER', 'geodb-free');
    vi.stubEnv('VITE_GEODB_API_KEY', 'unused-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(geodbFixture())));
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchCities('Free Paris')).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toContain('https://geodb-free-service.wirefreethought.com/');
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
  });
  it('returns an actionable rate-limit error', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))); await expect(requestJson('/weather')).rejects.toThrow('try again in a minute'); });
  it('returns an actionable network error', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))); await expect(requestJson('/weather')).rejects.toThrow('internet connection'); });
  it('uses Open-Meteo when OpenWeatherMap rate-limits', async () => {
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'test-only-key');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('openweathermap') ? new Response('{}', { status: 429 }) : new Response(JSON.stringify(meteoFixture()))));
    const weather = await fetchWeather(DEFAULT_CITY); expect(weather.source).toBe('Open-Meteo'); expect(weather.fallbackReason).toContain('OpenWeatherMap');
  });
});
