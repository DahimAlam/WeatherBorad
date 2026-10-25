import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react';
import type { Condition } from '../types';

export function WeatherIcon({ condition, size = 30, isDay = true, className = '' }: { condition: Condition; size?: number; isDay?: boolean; className?: string }) {
  const Icon = condition === 'clear' ? (isDay ? Sun : Moon) : { 'partly-cloudy': CloudSun, cloudy: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudFog }[condition] ?? CloudDrizzle;
  return <Icon size={size} strokeWidth={1.5} className={`weather-icon weather-${condition} ${className}`} aria-hidden="true" />;
}

export function WeatherArtwork({ condition, isDay }: { condition: Condition; isDay: boolean }) {
  const wet = ['rain', 'storm', 'snow'].includes(condition);
  return <div className={`weather-art ${isDay ? '' : 'night'} ${wet ? 'wet' : ''}`} aria-hidden="true">
    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <div className="art-sun"><div className="sun-glow" /></div>
    {condition !== 'clear' && <><div className="art-cloud cloud-back" /><div className="art-cloud cloud-front" /></>}
    {wet && <div className="art-rain"><i /><i /><i /></div>}
    <span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span>
  </div>;
}
