export function meteoFixture() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const days = Array.from({ length: 6 }, (_, i) => new Date(now.getTime() + i * 86400000).toISOString().slice(0, 10));
  return {
    timezone: 'Europe/London', utc_offset_seconds: 0,
    current: { time: `${date}T12:00`, temperature_2m: 22, apparent_temperature: 24, relative_humidity_2m: 64, wind_speed_10m: 12, wind_direction_10m: 225, weather_code: 2, is_day: 1 },
    daily: { time: days, temperature_2m_max: [24, 23, 22, 21, 25, 24], temperature_2m_min: [16, 15, 14, 15, 16, 15], weather_code: [2, 0, 61, 3, 0, 1], sunrise: days.map(d => `${d}T06:12`), sunset: days.map(d => `${d}T18:42`), uv_index_max: [4, 5, 3, 4, 6, 5], precipitation_probability_max: [10, 0, 70, 20, 5, 10] },
    hourly: { time: Array.from({ length: 24 }, (_, i) => `${date}T${String(i).padStart(2, '0')}:00`), temperature_2m: Array.from({ length: 24 }, (_, i) => 18 + Math.sin(i / 5) * 5), weather_code: Array(24).fill(2), visibility: Array(24).fill(24000) },
  };
}
export const citiesFixture = { results: [
  { id: 2988507, name: 'Paris', latitude: 48.8534, longitude: 2.3488, country: 'France', admin1: 'Île-de-France' },
  { id: 4717560, name: 'Paris', latitude: 33.66, longitude: -95.55, country: 'United States', admin1: 'Texas' },
] };

export function geodbFixture(results = citiesFixture.results) {
  return { data: results.map(city => ({ id: city.id, city: city.name, country: city.country, region: city.admin1, latitude: city.latitude, longitude: city.longitude })) };
}

export function owmFixture() {
  const now = Math.floor(Date.now() / 1000);
  const item = { dt: now, main: { temp: 22, feels_like: 24, humidity: 64, temp_min: 16, temp_max: 24 }, weather: [{ id: 801, description: 'few clouds', icon: '02d' }], wind: { speed: 12 / 3.6, deg: 225 }, visibility: 24000, pop: .1 };
  return { current: { ...item, timezone: 0, sys: { sunrise: now - 21600, sunset: now + 21600 } }, forecast: { list: Array.from({ length: 40 }, (_, i) => ({ ...item, dt: now + i * 10800 })), city: { timezone: 0 } } };
}
