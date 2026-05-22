import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClubLocks,
  fetchClubLocks,
  updateClubLocks,
} from '../api/admin';

export function ClubLocksSettings() {
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
      setLockHttpToken('');
      setLockMqttTopic(c.lockMqttTopic ?? '');
    });
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
        ...(lockHttpToken.trim() ? { lockHttpToken } : {}),
        lockMqttTopic,
      });
      setMessage('Сохранено');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <form className="card card-form" onSubmit={onSave}>
      <h3>Замки и API</h3>
      <p className="muted form-hint">
        <strong>Главная дверь</strong> — ID ниже. <strong>Боксы</strong> — ID замка у каждого места в{' '}
        <Link to="/seats">Места и зоны</Link>.
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
          <option value="mock">mock (тест, без реального замка)</option>
          <option value="http">HTTP API</option>
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
          type="password"
          autoComplete="new-password"
          value={lockHttpToken}
          onChange={(e) => setLockHttpToken(e.target.value)}
          placeholder="новый токен (пусто = не менять)"
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
  );
}
