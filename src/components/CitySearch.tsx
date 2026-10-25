import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { searchCities, SUGGESTED_CITIES, validateSearch } from '../lib/weather';
import type { City } from '../types';

export default function CitySearch({ onSelect, inputRef }: { onSelect: (city: City) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const selectionRef = useRef(false);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setActive(-1); setCities([]); setSearched(false);
    if (validateSearch(query)) { setLoading(false); return; }
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchCities(query, controller.signal);
        if (!controller.signal.aborted) { setCities(results); setSearched(true); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'City search could not connect. Please try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const options = query.trim().length < 2 ? SUGGESTED_CITIES : cities;
  function select(city: City) { selectionRef.current = true; onSelect(city); setQuery(''); setError(''); setOpen(false); inputRef.current?.blur(); queueMicrotask(() => { selectionRef.current = false; }); }

  return <div className="search-wrap" ref={container}>
    <form className={`search-field ${error ? 'invalid' : ''}`} role="search" onSubmit={e => {
      e.preventDefault(); const validation = validateSearch(query);
      if (validation) { setError(validation); setOpen(true); return; }
      if (options.length && !loading) select(options[active >= 0 ? active : 0]);
      else { setOpen(true); if (!loading) setError('No matching city. Try a nearby city or a different spelling.'); }
    }}>
      <Search size={19} aria-hidden="true" />
      <input ref={inputRef} type="text" role="combobox" aria-label="Search for a city" aria-autocomplete="list" aria-expanded={open} aria-controls="city-results" aria-activedescendant={open && active >= 0 ? `city-option-${active}` : undefined} aria-invalid={!!error} aria-describedby={error ? 'search-error' : undefined} autoComplete="off" placeholder="Search for a city..." value={query} maxLength={100}
        onChange={e => { setQuery(e.target.value); setError(''); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={e => { if (selectionRef.current || container.current?.contains(e.relatedTarget)) return; setError(validateSearch(query)); setOpen(false); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(i => e.key === 'ArrowDown' ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0)); }
        }} />
      {loading ? <LoaderCircle size={18} className="spin" aria-label="Searching" /> : query ? <button type="button" className="search-clear icon-button" aria-label="Clear search" onClick={() => { setQuery(''); setError(''); inputRef.current?.focus(); }}><X size={16} /></button> : <kbd>/</kbd>}
    </form>
    {error && <p className="field-error" id="search-error" role="alert">{error}</p>}
    {open && <div className="search-popover">
      <div className="search-caption">{query.trim().length < 2 ? 'A FEW PLACES TO EXPLORE' : 'MATCHING PLACES'}</div>
      {loading && <div className="search-message" role="status"><LoaderCircle size={17} className="spin" /> Finding your next destination…</div>}
      {!loading && searched && !cities.length && !error && <div className="search-message" role="status">No cities found. Check the spelling or try a nearby city.</div>}
      <ul id="city-results" role="listbox" aria-label="City suggestions">
        {!loading && options.map((city, i) => <li key={city.id} id={`city-option-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onPointerDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => select(city)}>
          <MapPin size={18} /><span><strong>{city.name}</strong><small>{[city.region, city.country].filter(Boolean).join(', ')}</small></span><ArrowUpRight size={16} />
        </li>)}
      </ul>
      <div className="search-footnote"><span>↑ ↓ to navigate</span><span>↵ to explore</span></div>
    </div>}
  </div>;
}
