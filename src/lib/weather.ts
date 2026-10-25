import type { City, Condition, ForecastDay, Weather, Unit } from '../types';

export const DEFAULT_CITY: City = { id: '2643743', name: 'London', country: 'United Kingdom', region: 'England', latitude: 51.50853, longitude: -0.12574 };
export const SUGGESTED_CITIES: City[] = [DEFAULT_CITY,
  { id: '5128581', name: 'New York', country: 'United States', region: 'New York', latitude: 40.71427, longitude: -74.00597 },
  { id: '1850147', name: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.69171 },
  { id: '1174872', name: 'Karachi', country: 'Pakistan', latitude: 24.8608, longitude: 67.0104 },
];

export const conditionLabels: Record<Condition, string> = { clear: 'Clear skies', 'partly-cloudy': 'Partly cloudy', cloudy: 'Overcast', rain: 'Rainy', snow: 'Snowy', storm: 'Thunderstorms', fog: 'Foggy' };
export function wmoCondition(code: number): Condition {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if (code >= 95) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  return 'rain';
}
export function owmCondition(code: number): Condition {
  if (code === 800) return 'clear';
  if (code === 801 || code === 802) return 'partly-cloudy';
  if (code >= 803) return 'cloudy';
  if (code >= 700) return 'fog';
  if (code >= 600) return 'snow';
  if (code >= 300) return 'rain';
  return 'storm';
}
export function temperature(value: number, unit: Unit): number { return Math.round(unit === 'f' ? value * 9 / 5 + 32 : value); }
export function compass(degrees: number): string { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]; }
export function cityKey(city: City): string { return `${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}`; }
export function cityDate(weather: Weather, date = Date.now()): Date { return new Date(date + weather.utcOffset * 1000); }
export function formatCityDate(weather: Weather, options: Intl.DateTimeFormatOptions): string { return cityDate(weather).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }); }
export function timeLabel(iso: string | null): string {
  if (!iso) return '—';
  const time = iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso;
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export function validateSearch(value: string): string {
  if (!value.trim()) return 'Enter a city name to find its weather.';
  if (value.trim().length < 2) return 'Type at least 2 characters to search for a city.';
  if (value.trim().length > 100) return 'Use a city name shorter than 100 characters.';
  return '';
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
export async function requestJson<T>(url: string, signal?: AbortSignal, headers?: HeadersInit): Promise<T> {
  const timeout = AbortSignal.timeout(12000);
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers });
    if (!response.ok) throw new ApiError(response.status === 429 ? 'The weather service is busy. Please try again in a minute.' : response.status === 401 || response.status === 403 ? 'This data service could not authenticate. Please try the alternate weather source.' : 'The data service is temporarily unavailable. Please try again.', response.status);
    return await response.json() as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(timeout.aborted ? 'The request took too long. Check your connection and try again.' : 'Could not connect to the data service. Check your internet connection and try again.');
  }
}

const searchCache = new Map<string, { cities: City[]; time: number }>();
// Free GeoDB is the default. RapidAPI requires an explicit provider choice
// so adding an unsubscribed key cannot break the free deployment.
const cityProvider = () => import.meta.env.VITE_CITY_SEARCH_PROVIDER || 'geodb-free';
export const searchProvider = cityProvider() === 'open-meteo' ? 'Open-Meteo' : 'GeoDB Cities';
export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const normalized = query.trim().toLowerCase();
  const cacheKey = `${cityProvider()}:${normalized}`;
  if (validateSearch(normalized)) return [];
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 300000) return cached.cities;
  let cities: City[];
  if (cityProvider() !== 'open-meteo') {
    const rapidApi = cityProvider() === 'rapidapi';
    const host = rapidApi ? 'wft-geo-db.p.rapidapi.com' : 'geodb-free-service.wirefreethought.com';
    if (rapidApi && !import.meta.env.VITE_GEODB_API_KEY) throw new ApiError('City search needs a RapidAPI key, or select the free GeoDB provider.');
    const result = await requestJson<{ data: { id: number; city: string; name?: string; country: string; region: string; latitude: number; longitude: number }[] }>(`https://${host}/v1/geo/cities?namePrefix=${encodeURIComponent(query.trim())}&limit=5&sort=-population&types=CITY`, signal, rapidApi ? { 'X-RapidAPI-Key': import.meta.env.VITE_GEODB_API_KEY, 'X-RapidAPI-Host': host } : undefined).catch(error => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) throw new ApiError('City search is not authorized. Check that the RapidAPI application has an active GeoDB Cities subscription and a valid key.', error.status);
      if (error instanceof ApiError && error.status === 429) throw new ApiError('City search has reached its request limit. Wait a moment and try again.', 429);
      throw error;
    });
    if (!Array.isArray(result.data)) throw new ApiError('City search returned incomplete data. Please try again.');
    cities = result.data.map(c => ({ id: `geodb-${c.id}`, name: c.name ?? c.city, country: c.country, region: c.region, latitude: c.latitude, longitude: c.longitude }));
  } else {
    const result = await requestJson<{ results?: { id: number; name: string; country?: string; admin1?: string; latitude: number; longitude: number }[] }>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=en&format=json`, signal);
    cities = (result.results ?? []).map(c => ({ id: String(c.id), name: c.name, country: c.country ?? '', region: c.admin1, latitude: c.latitude, longitude: c.longitude }));
  }
  if (searchCache.size > 50) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(cacheKey, { cities, time: Date.now() });
  return cities;
}

interface MeteoResponse {
  timezone: string; utc_offset_seconds: number;
  current: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; wind_direction_10m: number; weather_code: number; is_day: number };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; sunrise: string[]; sunset: string[]; uv_index_max: (number | null)[]; precipitation_probability_max: (number | null)[] };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; visibility: (number | null)[] };
}
export function normalizeMeteo(data: MeteoResponse): Weather {
  if (!data.current || !Number.isFinite(data.current.temperature_2m) || data.daily?.time?.length < 5 || !data.hourly?.time?.length) throw new ApiError('The weather service returned incomplete data. Please refresh to try again.');
  const c = data.current, d = data.daily, h = data.hourly;
  const start = Math.max(0, h.time.findIndex(t => t >= c.time.slice(0, 13) + ':00'));
  const condition = wmoCondition(c.weather_code);
  return {
    temperature: c.temperature_2m, feelsLike: c.apparent_temperature, humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m, windDirection: c.wind_direction_10m, condition, description: conditionLabels[condition], isDay: c.is_day === 1,
    high: d.temperature_2m_max[0], low: d.temperature_2m_min[0], sunrise: d.sunrise[0], sunset: d.sunset[0], uv: d.uv_index_max[0], visibility: h.visibility[start] == null ? null : h.visibility[start]! / 1000,
    timezone: data.timezone, utcOffset: data.utc_offset_seconds,
    forecast: d.time.slice(0, 5).map((date, i) => ({ date, low: d.temperature_2m_min[i], high: d.temperature_2m_max[i], condition: wmoCondition(d.weather_code[i]), rainChance: d.precipitation_probability_max[i] })),
    hourly: h.time.slice(start, start + 8).map((time, i) => ({ time, temperature: h.temperature_2m[start + i], condition: wmoCondition(h.weather_code[start + i]) })),
    source: 'Open-Meteo', fetchedAt: Date.now(),
  };
}

async function fetchMeteo(city: City, signal?: AbortSignal): Promise<Weather> {
  const params = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max', hourly: 'temperature_2m,weather_code,visibility', timezone: 'auto', forecast_days: '6' });
  return normalizeMeteo(await requestJson<MeteoResponse>(`https://api.open-meteo.com/v1/forecast?${params}`, signal));
}
interface OwmItem {
  dt: number; main: { temp: number; feels_like: number; humidity: number; temp_min: number; temp_max: number };
  weather: { id: number; description: string; icon: string }[]; wind: { speed: number; deg: number }; visibility?: number; pop?: number;
}
interface OwmCurrent extends OwmItem { timezone: number; sys: { sunrise: number; sunset: number } }
export function normalizeOwm(current: OwmCurrent, forecast: { list: OwmItem[]; city: { timezone: number } }): Weather {
  if (!Number.isFinite(current.main?.temp) || !current.weather?.length || !forecast.list?.length) throw new ApiError('The weather service returned incomplete data. Please refresh to try again.');
  const offset = current.timezone;
  const localIso = (epoch: number) => new Date((epoch + offset) * 1000).toISOString().slice(0, 19);
  const groups = new Map<string, OwmItem[]>();
  for (const item of forecast.list) {
    const date = localIso(item.dt).slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), item]);
  }
  const days: ForecastDay[] = [...groups].slice(0, 5).map(([date, items]) => {
    const midday = [...items].sort((a, b) => Math.abs(Number(localIso(a.dt).slice(11, 13)) - 12) - Math.abs(Number(localIso(b.dt).slice(11, 13)) - 12))[0];
    return { date, low: Math.min(...items.map(i => i.main.temp_min)), high: Math.max(...items.map(i => i.main.temp_max)), condition: owmCondition(midday.weather[0].id), rainChance: Math.round(Math.max(...items.map(i => i.pop ?? 0)) * 100) };
  });
  return {
    temperature: current.main.temp, feelsLike: current.main.feels_like, humidity: current.main.humidity, windSpeed: current.wind.speed * 3.6, windDirection: current.wind.deg,
    condition: owmCondition(current.weather[0].id), description: current.weather[0].description, isDay: current.weather[0].icon.endsWith('d'),
    high: current.main.temp_max, low: current.main.temp_min, sunrise: localIso(current.sys.sunrise), sunset: localIso(current.sys.sunset), uv: null, visibility: current.visibility == null ? null : current.visibility / 1000,
    timezone: 'local', utcOffset: offset, forecast: days,
    hourly: forecast.list.slice(0, 8).map(i => ({ time: localIso(i.dt), temperature: i.main.temp, condition: owmCondition(i.weather[0].id) })), source: 'OpenWeatherMap', fetchedAt: Date.now(),
  };
}
export async function fetchWeather(city: City, signal?: AbortSignal): Promise<Weather> {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!key) return fetchMeteo(city, signal);
  const params = new URLSearchParams({ lat: String(city.latitude), lon: String(city.longitude), appid: key, units: 'metric' });
  try {
    const [current, forecast] = await Promise.all([
      requestJson<OwmCurrent>(`https://api.openweathermap.org/data/2.5/weather?${params}`, signal),
      requestJson<{ list: OwmItem[]; city: { timezone: number } }>(`https://api.openweathermap.org/data/2.5/forecast?${params}`, signal),
    ]);
    return normalizeOwm(current, forecast);
  } catch (error) {
    if (signal?.aborted) throw error;
    const weather = await fetchMeteo(city, signal);
    return { ...weather, fallbackReason: 'OpenWeatherMap is unavailable. Showing live weather from Open-Meteo.' };
  }
}
