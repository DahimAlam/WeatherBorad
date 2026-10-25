export interface City {
  id: string;
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
}

export type Condition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';
export interface ForecastDay {
  date: string;
  low: number;
  high: number;
  condition: Condition;
  rainChance: number | null;
}
export interface HourWeather {
  time: string;
  temperature: number;
  condition: Condition;
}
export interface Weather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  condition: Condition;
  description: string;
  isDay: boolean;
  high: number;
  low: number;
  sunrise: string | null;
  sunset: string | null;
  uv: number | null;
  visibility: number | null;
  timezone: string;
  utcOffset: number;
  forecast: ForecastDay[];
  hourly: HourWeather[];
  source: 'Open-Meteo' | 'OpenWeatherMap';
  fetchedAt: number;
  fallbackReason?: string;
}
export interface Snapshot { city: City; weather: Weather }
export type Unit = 'c' | 'f';
export type Theme = 'light' | 'dark' | 'system';
