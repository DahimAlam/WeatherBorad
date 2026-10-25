import { useState } from 'react';
import { Bell, Check, LoaderCircle, Send } from 'lucide-react';
import Modal from './Modal';
import { disableReminder, enableReminder, notificationsSupported, pushConfigured, readReminderPreference, saveReminderPreference, sendTestNotification, validReminderTime } from '../lib/notifications';

export default function ReminderSettings({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const saved = readReminderPreference();
  const [time, setTime] = useState(saved.time);
  const [enabled, setEnabled] = useState(pushConfigured && saved.enabled);
  const [scheduledTime, setScheduledTime] = useState(saved.time);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setStatus('');
    try { await action(); setStatus(success); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update notifications. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Your morning, a little clearer." onClose={onClose}>
    <div className="modal-feature-icon"><Bell size={25} /></div>
    <p className="modal-intro">A gentle nudge to check the forecast before you head out. We’ll ask your browser for permission only when you choose to enable notifications.</p>
    <label className="input-label" htmlFor="reminder-time">Your preferred time <span>({Intl.DateTimeFormat().resolvedOptions().timeZone})</span></label>
    <input id="reminder-time" className="time-input" type="time" value={time} aria-invalid={!!error} aria-describedby={error ? 'reminder-error' : undefined} onChange={e => { setTime(e.target.value); setError(''); setStatus(''); }} onBlur={() => { if (!validReminderTime(time)) setError('Choose a valid reminder time.'); else if (!saveReminderPreference(time)) setError('Your browser could not save this preference. It will last for this visit.'); }} />
    {enabled && time !== scheduledTime && <p className="notice" role="status">Your reminder is still scheduled for {scheduledTime}. Choose Update reminder to apply this new time.</p>}
    {!notificationsSupported() ? <p className="notice">Notifications aren’t supported in this browser. On iPhone or iPad, add WeatherBoard to your Home Screen first. Your weather dashboard still works normally.</p> : !pushConfigured ? <p className="notice">Daily reminders aren’t available on this deployment yet. You can save your preferred time and send a test notification.</p> : <p className="muted">Reminders arrive at your chosen time, even after you close this tab. Delivery can be delayed by device or network settings.</p>}
    {error && <p className="field-error" id="reminder-error" role="alert">{error}</p>}
    {status && <p className="success-message" role="status"><Check size={17} />{status}</p>}
    <div className="modal-actions stacked">
      {pushConfigured && <button className="button primary" disabled={busy || !notificationsSupported() || !validReminderTime(time)} onClick={() => void run(async () => { await enableReminder(time); setEnabled(true); setScheduledTime(time); }, 'Your daily reminder is scheduled.')}><Bell size={17} />{busy ? 'Saving…' : enabled ? 'Update reminder' : 'Enable daily reminder'}</button>}
      <button className="button secondary" disabled={busy || !notificationsSupported()} onClick={() => void run(sendTestNotification, 'Test notification sent. Check your device’s notifications.')}>
        {busy ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />} Send a test notification
      </button>
      {enabled && <button className="text-button" disabled={busy} onClick={() => void run(async () => { await disableReminder(); setEnabled(false); }, 'Your daily reminder is turned off.')}>Turn off daily reminder</button>}
    </div>
  </Modal>;
}
