import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ClubLocks,
  fetchClubLocks,
  fetchLockEvents,
  LockEventRow,
  testLockOpen,
  updateClubLocks,
} from '../api/admin';

export function ClubLocksSettings() {
  const [provider, setProvider] = useState<ClubLocks['lockProvider']>('mock');
  const [mainDoorLockId, setMainDoorLockId] = useState('');
  const [lockHttpBaseUrl, setLockHttpBaseUrl] = useState('');
  const [lockHttpToken, setLockHttpToken] = useState('');
  const [lockMqttTopic, setLockMqttTopic] = useState('');
  const [ready, setReady] = useState(false);
  const [readyHint, setReadyHint] = useState('');
  const [pulseSeconds, setPulseSeconds] = useState(5);
  const [cooldownSeconds, setCooldownSeconds] = useState(30);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState<LockEventRow[]>([]);

  const loadEvents = useCallback(() => {
    fetchLockEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  const load = useCallback(() => {
    fetchClubLocks().then((c) => {
      setProvider(c.lockProvider);
      setMainDoorLockId(c.mainDoorLockId ?? '');
      setLockHttpBaseUrl(c.lockHttpBaseUrl ?? '');
      setLockHttpToken('');
      setLockMqttTopic(c.lockMqttTopic ?? '');
      setReady(!!c.ready);
      setReadyHint(c.readyHint ?? '');
      setPulseSeconds(c.pulseSeconds ?? 5);
      setCooldownSeconds(c.cooldownSeconds ?? 30);
    });
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const c = await updateClubLocks({
        lockProvider: provider,
        mainDoorLockId,
        lockHttpBaseUrl,
        ...(lockHttpToken.trim() ? { lockHttpToken } : {}),
        lockMqttTopic,
      });
      setReady(!!c.ready);
      setReadyHint(c.readyHint ?? '');
      setMessage('Сохранено');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const onTest = async () => {
    setError('');
    setMessage('');
    setTesting(true);
    try {
      const res = await testLockOpen();
      setMessage(res.message);
      loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка теста');
      loadEvents();
    } finally {
      setTesting(false);
    }
  };

  const showBridgeFields = provider === 'http' || provider === 'mqtt';

  return (
    <div className="card card-form">
      <form onSubmit={onSave}>
        <h3>Замки и API</h3>
        <p className="muted form-hint">
          Главная дверь клуба. Клиент жмёт в приложении → сервер шлёт команду.
          Для сторов держи <strong>mock</strong>: мобилка уже финальная — позже
          только смени провайдер и впиши URL/токен моста, без ребилда аппа.
        </p>

        <p className={ready ? 'muted' : 'error'} style={{ marginBottom: 12 }}>
          {ready ? '● Готов' : '○ Не готов'} — {readyHint || '—'}
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
            <option value="mock">
              mock — симуляция (сторы / тест, без железа)
            </option>
            <option value="http">http — боевой мост (Shelly / Pi)</option>
            <option value="mqtt">mqtt — через HTTP-мост /publish</option>
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

        {showBridgeFields ? (
          <>
            <label>
              HTTP base URL моста
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
          </>
        ) : null}

        {provider === 'mqtt' ? (
          <label>
            MQTT topic prefix
            <input
              className="input"
              value={lockMqttTopic}
              onChange={(e) => setLockMqttTopic(e.target.value)}
              placeholder="stopkek/locks"
            />
          </label>
        ) : null}

        <p className="muted form-hint">
          Импульс ~{pulseSeconds} с · кулдаун в приложении {cooldownSeconds} с
        </p>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        <div className="form-footer" style={{ gap: 8, display: 'flex', flexWrap: 'wrap' }}>
          <button type="submit" className="btn">
            Сохранить
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onTest}
            disabled={testing}
          >
            {testing ? 'Открываю…' : 'Тест: открыть дверь'}
          </button>
        </div>
      </form>

      <h4>Последние события замка</h4>
      <p className="muted form-hint">
        Mock и бой пишут сюда одинаково — видно, что сервер реально обработал
        команду.
      </p>
      {events.length === 0 ? (
        <p className="muted">Пока пусто — нажми тест или открой дверь из приложения</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Замок</th>
                <th>Провайдер</th>
                <th>Ок</th>
                <th>Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 20).map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.createdAt).toLocaleString('ru-RU')}</td>
                  <td>{ev.lockTarget}</td>
                  <td>{ev.provider}</td>
                  <td>{ev.success ? 'да' : 'нет'}</td>
                  <td>{ev.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={loadEvents}>
        Обновить журнал
      </button>
    </div>
  );
}
