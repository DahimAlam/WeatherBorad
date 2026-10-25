import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Bell, Check, ChevronDown, CloudOff, Compass, Download, Droplets, Eye, Heart, Leaf, LoaderCircle, MapPin, Moon, Navigation, Plus, RefreshCw, ShieldCheck, Sparkles, Sun, Sunrise, Sunset, Trash2, WifiOff, Wind, X } from 'lucide-react';
import CitySearch from './components/CitySearch';
import Modal from './components/Modal';
import ReminderSettings from './components/ReminderSettings';
import { WeatherArtwork, WeatherIcon } from './components/WeatherIcon';
import { cityKey, compass, DEFAULT_CITY, fetchWeather, formatCityDate, temperature, timeLabel } from './lib/weather';
import { addFavourite, isCity, loadFavourites, loadSnapshot, readStored, saveSnapshot, storageUnavailable, writeStored } from './lib/storage';
import { pushConfigured, readReminderPreference } from './lib/notifications';
import type { City, ForecastDay, Snapshot, Theme, Unit, Weather } from './types';

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function App() {
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [refresh, setRefresh] = useState(0);
  const [favourites, setFavourites] = useState(loadFavourites);
  const [unit, setUnit] = useState<Unit>(() => readStored<Unit>('unit', 'c') === 'f' ? 'f' : 'c');
  const [theme, setTheme] = useState<Theme>(() => { const value = readStored<Theme>('theme', 'system'); return ['light', 'dark', 'system'].includes(value) ? value : 'system'; });
  const [toast, setToast] = useState('');
  const [removeCity, setRemoveCity] = useState<City | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(() => pushConfigured && readReminderPreference().enabled);
  const [installOpen, setInstallOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const [forecastDetail, setForecastDetail] = useState<ForecastDay | null>(null);
  const [locating, setLocating] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [storageWarning, setStorageWarning] = useState(storageUnavailable());
  const searchRef = useRef<HTMLInputElement>(null);
  const cityCache = useRef(new Map<string, Snapshot>());
  const lastSnapshot = useRef<Snapshot | null>(null);
  const locationRequest = useRef(0);

  useEffect(() => {
    let active = true;
    void loadSnapshot().then(saved => {
      if (!active) return;
      if (saved) { setSnapshot(saved); lastSnapshot.current = saved; setCity(saved.city); cityCache.current.set(cityKey(saved.city), saved); }
      else { const lastCity = readStored<unknown>('city', null); if (isCity(lastCity)) setCity(lastCity); }
      setStorageWarning(storageUnavailable()); setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const cached = cityCache.current.get(cityKey(city));
    if (cached) { setSnapshot(cached); lastSnapshot.current = cached; }
    if (!online) {
      setLoading(false);
      setError(cached ? '' : `No offline weather saved for ${city.name}. Reconnect to load this city.`);
      return;
    }
    setLoading(true); setError('');
    void fetchWeather(city, controller.signal).then(async weather => {
      if (controller.signal.aborted) return;
      const next = { city, weather };
      cityCache.current.set(cityKey(city), next); lastSnapshot.current = next;
      setSnapshot(next); setLoading(false);
      if (!writeStored('city', city)) setStorageWarning(true);
      if (!await saveSnapshot(next)) setOfflineUnavailable(true);
    }).catch(e => {
      if (controller.signal.aborted) return;
      setError(`${e instanceof Error ? e.message : 'Could not load the forecast. Please try again.'}${lastSnapshot.current ? ' Your last loaded weather is still shown below.' : ''}`);
      setLoading(false);
    });
    return () => controller.abort();
  }, [city, online, refresh, ready]);

  useEffect(() => {
    const onOnline = () => setOnline(true), onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); setInstallOpen(false); setToast('WeatherBoard is now installed. Make yourself at home.'); };
    const onUnavailable = () => setOfflineUnavailable(true);
    const keyboard = (event: KeyboardEvent) => { if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !document.querySelector('dialog[open]')) { event.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall); window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('weatherboard:offline-unavailable', onUnavailable); window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('appinstalled', onInstalled); window.removeEventListener('weatherboard:offline-unavailable', onUnavailable); window.removeEventListener('keydown', keyboard); };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? preference.matches ? 'dark' : 'light' : theme; };
    apply(); preference.addEventListener('change', apply);
    return () => preference.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);

  function selectCity(next: City) { locationRequest.current++; setLocating(false); setCity(next); if (cityKey(next) === cityKey(city)) setRefresh(v => v + 1); }
  function saveFavourite() {
    if (!snapshot) return;
    const result = addFavourite(favourites, snapshot.city);
    if (result.error) { setToast(result.error); return; }
    setFavourites(result.cities); if (!writeStored('favourites', result.cities)) setStorageWarning(true);
    setToast(`${snapshot.city.name} added to your favourite places.`);
  }
  function removeFavourite() {
    if (!removeCity) return;
    const next = favourites.filter(c => cityKey(c) !== cityKey(removeCity));
    setFavourites(next); if (!writeStored('favourites', next)) setStorageWarning(true);
    setToast(`${removeCity.name} removed from favourites.`); setRemoveCity(null);
  }
  function locate() {
    if (!navigator.geolocation) { setToast('Location is not supported in this browser. Search for your city instead.'); return; }
    setLocating(true);
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      selectCity({ id: `location-${position.coords.latitude.toFixed(3)}-${position.coords.longitude.toFixed(3)}`, name: 'Your location', country: 'Local weather', latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, err => {
      if (request !== locationRequest.current) return;
      setLocating(false); setToast(err.code === 1 ? 'Location access is blocked. Search for a city, or allow location in your browser settings.' : 'Could not find your location. Check your connection or search for a city.');
    }, { timeout: 10000, maximumAge: 300000 });
  }
  async function install() {
    if (!installPrompt) { setInstallOpen(true); return; }
    await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null);
  }
  const weather = snapshot?.weather;
  const shownCity = snapshot?.city ?? city;
  const isFavourite = favourites.some(c => cityKey(c) === cityKey(shownCity));
  const stale = !!weather && Date.now() - weather.fetchedAt > 1800000;
  const greeting = weather && !weather.isDay ? 'A little clarity, day or night.' : 'A little clarity for your everyday.';

  return <>
    <a className="skip-link" href="#main">Skip to weather</a>
    <div className="app-shell">
      <aside className="sidebar" aria-label="Sidebar">
        <a className="brand" href="#" aria-label="WeatherBoard home"><span className="brand-mark"><Sun size={23} strokeWidth={1.7} /></span><span>weather<span className="brand-bold">board</span><span className="brand-dot">.</span></span></a>
        <div className="sidebar-main">
          <div className="workspace-label">YOUR DAILY OUTLOOK</div>
          <a className="nav-item active" href="#main"><div className="nav-icon"><Sun size={19} /></div>Overview<span className="nav-active-dot" /></a>
          <button className="nav-item" onClick={() => { document.getElementById('favourite-places')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); searchRef.current?.focus(); }}><div className="nav-icon"><Compass size={19} /></div>Explore places<ArrowUpRight size={15} className="nav-end" /></button>
          <div className="saved-header" id="favourite-places"><span>FAVOURITE PLACES</span><span className="count-badge">{favourites.length}/5</span></div>
          <div className="favourites-list">
            {favourites.map(saved => <div key={cityKey(saved)} className={`favourite-row ${cityKey(saved) === cityKey(shownCity) ? 'selected' : ''}`}>
              <button className="favourite-select" onClick={() => selectCity(saved)} aria-label={`View weather in ${saved.name}`}><MapPin size={16} /><span><strong>{saved.name}</strong><small>{saved.country}</small></span>{cityCache.current.get(cityKey(saved)) && <b>{temperature(cityCache.current.get(cityKey(saved))!.weather.temperature, unit)}°</b>}</button>
              <button className="icon-button remove-favourite" aria-label={`Remove ${saved.name} from favourites`} onClick={() => setRemoveCity(saved)}><X size={14} /></button>
            </div>)}
            {favourites.length === 0 && <div className="favourites-empty"><span className="tiny-heart"><Heart size={19} /></span><p>Your places, at a glance.</p><span>Save a city to keep its forecast close.</span></div>}
          </div>
          <button className="add-city" onClick={() => { searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus size={16} /> Add a favourite city</button>
          <div className="sidebar-note"><span className="note-illustration"><Sun size={33} strokeWidth={1.2} /><CloudOff size={22} strokeWidth={1.2} /></span><strong>A good day starts<br />with a little heads-up.</strong><p>Your morning forecast,<br />right when you need it.</p><button onClick={() => setRemindersOpen(true)}>Set a reminder <ArrowRight size={16} /></button></div>
        </div>
        <div className="sidebar-bottom"><span className="live-dot" /> Made for every kind of day <span>↗</span></div>
      </aside>

      <div className="main-shell">
        <header className="topbar"><div className="breadcrumb">Your workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-actions"><span className="today-date">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="topbar-divider" /><button className="icon-button theme-button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(next); if (!writeStored('theme', next)) setStorageWarning(true); }}>{document.documentElement.dataset.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><button className="icon-button notification-button" aria-label="Notification settings" onClick={() => setRemindersOpen(true)}><Bell size={19} />{reminderEnabled && <span className="notification-dot" />}</button><span className="avatar" aria-label="Personal workspace">W</span></div></header>
        <main id="main" className="main-content">
          <section className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> YOUR WORLD, AT A GLANCE</div><h1>Every day has an outlook<span>.</span></h1><p>{greeting}</p></div><button className="button install-button" onClick={() => void install()} disabled={installed}>{installed ? <Check size={17} /> : <Download size={17} />}{installed ? 'App installed' : 'Install app'}</button></section>
          <div className="search-row"><CitySearch onSelect={selectCity} inputRef={searchRef} /><button className="button location-button" disabled={locating || !online} onClick={locate}>{locating ? <LoaderCircle size={16} className="spin" /> : <Navigation size={16} />}<span>{locating ? 'Locating…' : 'Use my location'}</span></button><div className="unit-switch" role="group" aria-label="Temperature unit">{(['c', 'f'] as Unit[]).map(u => <button key={u} aria-pressed={unit === u} onClick={() => { setUnit(u); if (!writeStored('unit', u)) setStorageWarning(true); }}>°{u.toUpperCase()}</button>)}</div></div>
          {!online && <div className="status-banner offline" role="status"><WifiOff size={18} /><span>You’re offline. {snapshot ? `Showing saved weather for ${shownCity.name}.` : 'Connect to the internet to load your first forecast.'}</span></div>}
          {storageWarning && <div className="status-banner" role="status"><ShieldCheck size={18} /><span>Browser storage is unavailable. Your preferences will last for this visit.</span></div>}
          {offlineUnavailable && <div className="status-banner" role="status"><CloudOff size={18} /><span>Offline saving is unavailable in this browser. Your live forecast still works.</span></div>}
          {error && <div className="status-banner error-banner" role="alert"><CloudOff size={20} /><span>{error}</span><button onClick={() => setRefresh(v => v + 1)} disabled={!online || loading}>Try again <RefreshCw size={14} /></button></div>}
          {weather?.fallbackReason && <div className="status-banner" role="status"><RefreshCw size={16} /><span>{weather.fallbackReason}</span></div>}

          {weather ? <div className={`dashboard ${loading ? 'refreshing' : ''}`} aria-busy={loading}>
            <section className={`current-weather ${weather.isDay ? '' : 'after-dark'}`} aria-label="Current weather">
              <div className="current-top"><div className="city-label"><MapPin size={17} /><h2>{shownCity.name}</h2><span className="country-tag">{shownCity.country}</span></div><div className="current-actions"><span className="live-badge"><span />{loading ? 'UPDATING' : !online || stale ? 'SAVED WEATHER' : 'LIVE WEATHER'}</span><button className={`icon-button favourite-toggle ${isFavourite ? 'is-favourite' : ''}`} aria-label={isFavourite ? `Remove ${shownCity.name} from favourites` : `Save ${shownCity.name} to favourites`} aria-pressed={isFavourite} onClick={() => isFavourite ? setRemoveCity(shownCity) : saveFavourite()}><Heart size={19} fill={isFavourite ? 'currentColor' : 'none'} /></button></div></div>
              <div className="current-body"><div className="current-information"><p className="current-date">{formatCityDate(weather, { weekday: 'long', month: 'long', day: 'numeric' })}</p><div className="temperature-display">{temperature(weather.temperature, unit)}<span>°</span><small>{unit.toUpperCase()}</small></div><div className="current-description">{weather.description}</div><div className="current-range"><span>Feels like {temperature(weather.feelsLike, unit)}°</span><span className="range-divider" /><span><ArrowUp size={13} />{temperature(weather.high, unit)}°</span><span><ArrowDown size={13} />{temperature(weather.low, unit)}°</span></div></div><WeatherArtwork condition={weather.condition} isDay={weather.isDay} /></div>
              <div className="current-bottom"><span><Sparkles size={15} />{weather.condition === 'rain' || weather.condition === 'storm' ? 'An umbrella might be your best companion today.' : weather.condition === 'clear' ? 'A little sunshine goes a long way.' : weather.condition === 'snow' ? 'Layer up. There’s a little winter magic outside.' : 'Whatever the sky brings, make the day yours.'}</span><button aria-label="Refresh weather" disabled={loading || !online} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={14} className={loading ? 'spin' : ''} /><span>{loading ? 'Refreshing…' : 'Refresh'}</span></button></div>
            </section>

            <section className="forecast-card card" aria-labelledby="forecast-heading"><div className="section-heading"><h2 id="forecast-heading">The next few days</h2><span className="subtle-tag">5-day forecast</span></div><div className="forecast-list">{weather.forecast.map((day, i) => <button className="forecast-row" key={day.date} onClick={() => setForecastDetail(day)} aria-label={`Forecast for ${day.date}`}><span className="forecast-day"><strong>{day.date === formatCityDateISO(weather) ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></span><WeatherIcon condition={day.condition} size={25} /><span className="forecast-rain"><Droplets size={12} />{day.rainChance == null ? '—' : `${day.rainChance}%`}</span><span className="forecast-temp"><strong>{temperature(day.high, unit)}°</strong><small>{temperature(day.low, unit)}°</small></span><span className={`forecast-bar forecast-bar-${i}`} aria-hidden="true" /></button>)}</div><div className="forecast-footnote"><span>Good things on the horizon.</span><Sun size={14} /></div></section>

            <section className="highlights-section" aria-labelledby="highlights-heading"><div className="section-heading outside"><h2 id="highlights-heading">Today’s highlights</h2><span>The details that make a difference</span></div><div className="highlights-grid"><Metric title="Humidity" icon={<Droplets size={18} />} value={weather.humidity} unit="%" detail={weather.humidity > 70 ? 'A little humid out there' : weather.humidity < 30 ? 'On the drier side' : 'Comfortably balanced'}><div className="humidity-track"><span style={{ width: `${weather.humidity}%` }} /></div></Metric><Metric title="Wind speed" icon={<Wind size={18} />} value={Math.round(weather.windSpeed)} unit="km/h" detail={`${compass(weather.windDirection)} · ${weather.windSpeed < 12 ? 'A gentle breeze' : weather.windSpeed < 30 ? 'A steady breeze' : 'Hold on to your hat'}`}><Navigation className="wind-direction" size={32} strokeWidth={1.1} style={{ transform: `rotate(${weather.windDirection}deg)` }} /></Metric><Metric title="UV index" icon={<Sun size={18} />} value={weather.uv == null ? '—' : weather.uv.toFixed(1)} unit={weather.uv == null ? '' : weather.uv < 3 ? 'Low' : weather.uv < 6 ? 'Moderate' : 'High'} detail={weather.uv == null ? 'Not supplied by this source' : 'Today’s maximum UV index'}><div className="uv-track"><i style={{ left: `${Math.min(weather.uv ?? 0, 11) / 11 * 100}%` }} /></div></Metric><Metric title="Visibility" icon={<Eye size={18} />} value={weather.visibility == null ? '—' : Math.round(weather.visibility)} unit={weather.visibility == null ? '' : 'km'} detail={weather.visibility == null ? 'Not supplied by this source' : weather.visibility >= 10 ? 'A clear view ahead' : 'Take care on the roads'}><div className="visibility-lines" aria-hidden="true"><i /><i /><i /></div></Metric></div></section>

            <section className="hourly-card card" aria-labelledby="hourly-heading"><div className="section-heading"><div><h2 id="hourly-heading">A look at the hours ahead</h2><p>Your day, one hour at a time.</p></div><span className="subtle-tag">Temperature <ChevronDown size={13} /></span></div><HourlyChart weather={weather} unit={unit} /></section>
            <section className="sun-card card" aria-labelledby="sun-heading"><div className="section-heading"><h2 id="sun-heading">Chasing daylight</h2><Sun size={18} /></div><div className="sun-arc" aria-hidden="true"><svg viewBox="0 0 260 100"><defs><linearGradient id="sunset-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ebc88a" stopOpacity="0.3" /><stop offset="100%" stopColor="#ebc88a" stopOpacity="0" /></linearGradient></defs><path d="M20 88 Q130 -45 240 88 Z" fill="url(#sunset-fill)"/><path d="M20 88 Q130 -45 240 88" fill="none" stroke="#d5b680" strokeWidth="1.6" strokeDasharray="4 5"/><path d="M10 88H250" stroke="currentColor" strokeOpacity="0.12"/><circle cx="130" cy="21.5" r="12" fill="#e9bb67"/><circle cx="130" cy="21.5" r="19" fill="#e9bb67" fillOpacity="0.14"/></svg></div><div className="sun-times"><div><span><Sunrise size={17} />Sunrise</span><strong>{timeLabel(weather.sunrise)}</strong></div><div><span><Sunset size={17} />Sunset</span><strong>{timeLabel(weather.sunset)}</strong></div></div><p className="daylight-caption">{daylightLabel(weather)}</p></section>
          </div> : loading ? <div className="loading-dashboard" role="status" aria-label="Loading weather"><div className="skeleton skeleton-hero" /><div className="skeleton skeleton-forecast" /><div className="loading-label"><LoaderCircle size={21} className="spin" /> Looking up the skies in {city.name}…</div></div> : <div className="empty-weather card"><CloudOff size={45} strokeWidth={1.3} /><h2>A small pause in the forecast.</h2><p>{online ? 'We couldn’t load the weather. Try again, or search for a different city.' : 'Connect to the internet to save your first city for offline visits.'}</p><button className="button primary" disabled={!online} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16} />Try again</button></div>}

          <section className="bottom-banner"><div className="bottom-banner-icon"><Leaf size={22} strokeWidth={1.4} /></div><div><strong>Less guessing. More living.</strong><p>A quick check now. A better-prepared day ahead.</p></div><button onClick={() => setRemindersOpen(true)}>{reminderEnabled ? 'Manage reminder' : 'Make it a morning ritual'}<ArrowUpRight size={17} /></button></section>
          <footer className="footer"><div><span className={`live-dot ${online ? '' : 'offline-dot'}`} /><span>{weather ? `${online && !stale ? 'Weather' : 'Saved weather'} by ${weather.source}` : 'Powered by public weather data'}<span className="footer-dot">·</span>{weather ? `Updated ${new Date(weather.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Built for wherever you are'}</span></div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data credits<ArrowUpRight size={12} /></a><span className="footer-signoff">A little perspective on the sky.</span></footer>
        </main>
      </div>
    </div>
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}><X size={16} /></button></div>}
    {removeCity && <Modal title={`Remove ${removeCity.name}?`} onClose={() => setRemoveCity(null)}><p className="modal-intro">This city will be removed from your favourites. You can always find it again with search.</p><div className="modal-actions"><button className="button secondary" onClick={() => setRemoveCity(null)}>Keep city</button><button className="button danger" onClick={removeFavourite}><Trash2 size={16} />Remove city</button></div></Modal>}
    {remindersOpen && <ReminderSettings onClose={() => setRemindersOpen(false)} onChanged={() => setReminderEnabled(pushConfigured && readReminderPreference().enabled)} />}
    {installOpen && <Modal title="A home for your daily outlook." onClose={() => setInstallOpen(false)}><div className="modal-feature-icon"><Download size={25} /></div><p className="modal-intro">Keep WeatherBoard one tap away. Once you’ve loaded a forecast, your last-viewed city is available offline.</p><div className="install-instructions"><h3>On iPhone or iPad</h3><p>Open in Safari, tap Share, then choose <strong>Add to Home Screen</strong>.</p><h3>On Android or desktop</h3><p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If the option isn’t visible, visit using Chrome or Edge over HTTPS.</p></div><button className="button primary full-width" onClick={() => setInstallOpen(false)}>Got it</button></Modal>}
    {forecastDetail && weather && <Modal title={new Date(`${forecastDetail.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} onClose={() => setForecastDetail(null)}><div className="forecast-detail"><WeatherIcon condition={forecastDetail.condition} size={70} /><h3>{shownCity.name}</h3><p className="forecast-detail-temps">{temperature(forecastDetail.high, unit)}° <span>/ {temperature(forecastDetail.low, unit)}°</span></p><p>{forecastDetail.condition.replace('-', ' ')} · {forecastDetail.rainChance == null ? 'Rain probability unavailable' : `${forecastDetail.rainChance}% chance of precipitation`}</p><span className="muted">Forecast by {weather.source}</span></div></Modal>}
  </>;
}

function formatCityDateISO(weather: Weather): string { return new Date(Date.now() + weather.utcOffset * 1000).toISOString().slice(0, 10); }
function daylightLabel(weather: Weather): string {
  if (!weather.sunrise || !weather.sunset) return 'Daylight times are unavailable for this location.';
  const duration = (new Date(weather.sunset).getTime() - new Date(weather.sunrise).getTime()) / 60000;
  if (!Number.isFinite(duration) || duration < 0) return 'Follow the rhythm of the day.';
  return `${Math.floor(duration / 60)} hours ${Math.round(duration % 60)} minutes of daylight`;
}
function Metric({ title, icon, value, unit, detail, children }: { title: string; icon: React.ReactNode; value: string | number; unit: string; detail: string; children: React.ReactNode }) {
  return <article className="metric-card card"><div className="metric-title">{icon}<h3>{title}</h3></div><div className="metric-value">{value}<span>{unit}</span></div>{children}<p>{detail}</p></article>;
}
function HourlyChart({ weather, unit }: { weather: Weather; unit: Unit }) {
  const hours = weather.hourly;
  if (!hours.length) return <p className="notice">Hourly data is unavailable from this source.</p>;
  const min = Math.min(...hours.map(h => h.temperature)) - 2, max = Math.max(...hours.map(h => h.temperature)) + 2;
  const coordinates = hours.map((hour, i) => [35 + i * (630 / Math.max(hours.length - 1, 1)), 70 - (hour.temperature - min) / (max - min) * 55]);
  const path = coordinates.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return <div className="hourly-scroll"><div className="hourly-inner"><div className="hourly-labels">{hours.map((hour, i) => <div key={hour.time}><span>{i === 0 && weather.source === 'Open-Meteo' ? 'Now' : timeLabel(hour.time).replace(':00', '').toLowerCase()}</span><WeatherIcon condition={hour.condition} size={22} /><strong>{temperature(hour.temperature, unit)}°</strong></div>)}</div><svg className="hourly-chart" viewBox="0 0 700 100" preserveAspectRatio="none" role="img" aria-label={`Temperature trend from ${temperature(hours[0].temperature, unit)} to ${temperature(hours.at(-1)!.temperature, unit)} degrees`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8bc78" stopOpacity="0.24" /><stop offset="100%" stopColor="#a8bc78" stopOpacity="0" /></linearGradient></defs><path d={`${path} L665,100 L35,100 Z`} fill="url(#chart-fill)" /><path d={path} stroke="#8da567" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />{coordinates.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#8da567" stroke="var(--surface)" strokeWidth="2" />)}</svg></div></div>;
}
