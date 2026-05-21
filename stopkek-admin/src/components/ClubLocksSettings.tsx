import { FormEvent, useEffect, useState } from 'react';
import {
  ClubLocks,
  fetchClubLocks,
  fetchLockEvents,
  LockEventRow,
  updateClubLocks,
} from '../api/admin';
import { TableEmptyRow } from './TableEmptyRow';

export function ClubLocksSettings() {
  const [events, setEvents] = useState<LockEventRow[]>([]);
  const [provider, setProvider] = useState<ClubLocks['lockProvider']>('mock');
  const [mainDoorLockId, setMainDoorLockId] = useState('');
  const [lockHttpBaseUrl, setLockHttpBaseUrl] = useState('');
  const [lockHttpToken, setLockHttpToken] = useState('');
  const [lockMqttTopic, setLockMqttTopic] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetchClubLocks().then((c) => {
      setProvider(c.lockProvider);
      setMainDoorLockId(c.mainDoorLockId ?? '');
      setLockHttpBaseUrl(c.lockHttpBaseUrl ?? '');
      setLockHttpToken(c.lockHttpToken ?? '');
      setLockMqttTopic(c.lockMqttTopic ?? '');
    });
    fetchLockEvents().then(setEvents);
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await updateClubLocks({
        lockProvider: provider,
        mainDoorLockId,
        lockHttpBaseUrl,
        lockHttpToken,
        lockMqttTopic,
      });
      setMessage('Сохранено');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <>
      <form className="card card-form" onSubmit={onSave}>
        <h3>Замки</h3>
        <p className="muted form-hint">
          mock — только лог. http — POST {'{base}'}/open. mqtt — через HTTP-мост.
          Замки ячеек — в «Места и зоны»: cellLock у каждого ПК.
        </p>
        <label>
          Провайдер
          <select
            className="input"
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as ClubLocks['lockProvider'])
            }
          >
            <option value="mock">mock (тест)</option>
            <option value="http">HTTP</option>
            <option value="mqtt">MQTT (через HTTP-мост)</option>
          </select>
        </label>
        <label>
          ID замка главной двери
          <input
            className="input"
            value={mainDoorLockId}
            onChange={(e) => setMainDoorLockId(e.target.value)}
            placeholder="main-door"
          />
        </label>
        <label>
          HTTP base URL
          <input
            className="input"
            value={lockHttpBaseUrl}
            onChange={(e) => setLockHttpBaseUrl(e.target.value)}
            placeholder="https://locks.example.com/api"
          />
        </label>
        <label>
          HTTP token (Bearer)
          <input
            className="input"
            value={lockHttpToken}
            onChange={(e) => setLockHttpToken(e.target.value)}
            placeholder="оставьте пустым, чтобы не менять"
          />
        </label>
        <label>
          MQTT topic prefix
          <input
            className="input"
            value={lockMqttTopic}
            onChange={(e) => setLockMqttTopic(e.target.value)}
            placeholder="stopkek/locks"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        <button type="submit" className="btn">
          Сохранить замки
        </button>
      </form>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Последние события замков</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Тип</th>
                <th>Замок</th>
                <th>OK</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && <TableEmptyRow colSpan={4} />}
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.createdAt).toLocaleString('ru-RU')}</td>
                  <td>{ev.lockType}</td>
                  <td>{ev.lockTarget}</td>
                  <td>{ev.success ? '✓' : ev.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
