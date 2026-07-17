import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  fetchClubLocks,
  fetchLockEvents,
  LockEventRow,
  testLockOpen,
  updateClubLocks,
} from '../api/admin';
import { TableEmptyRow } from '../components/TableEmptyRow';

const PAGE_SIZE = 20;

export function LocksPage() {
  const [liveMode, setLiveMode] = useState(false);
  const [mainDoorLockId, setMainDoorLockId] = useState('main-door');
  const [lockHttpBaseUrl, setLockHttpBaseUrl] = useState('');
  const [lockHttpToken, setLockHttpToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [events, setEvents] = useState<LockEventRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadEvents = useCallback(async (p: number) => {
    setEventsLoading(true);
    try {
      const res = await fetchLockEvents({ page: p, pageSize: PAGE_SIZE });
      setEvents(res.items);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const c = await fetchClubLocks();
    setLiveMode(c.lockProvider !== 'mock');
    setMainDoorLockId(c.mainDoorLockId || 'main-door');
    setLockHttpBaseUrl(c.lockHttpBaseUrl ?? '');
    setLockHttpToken('');
    setTokenSet(!!c.lockHttpToken);
  }, []);

  useEffect(() => {
    loadConfig().catch(() => setError('Не удалось загрузить настройки замка'));
    loadEvents(1);
  }, [loadConfig, loadEvents]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      if (!liveMode) {
        await updateClubLocks({
          lockProvider: 'mock',
          mainDoorLockId: mainDoorLockId.trim() || 'main-door',
        });
        setMessage('Сохранено: симуляция');
      } else {
        if (!mainDoorLockId.trim()) {
          throw new Error('Укажи ID замка, например main-door');
        }
        if (!lockHttpBaseUrl.trim()) {
          throw new Error('Укажи URL моста');
        }
        await updateClubLocks({
          lockProvider: 'http',
          mainDoorLockId: mainDoorLockId.trim(),
          lockHttpBaseUrl: lockHttpBaseUrl.trim(),
          ...(lockHttpToken.trim() ? { lockHttpToken } : {}),
        });
        setMessage('Сохранено: боевой мост');
      }
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setError('');
    setMessage('');
    setTesting(true);
    try {
      const res = await testLockOpen();
      setMessage(res.message);
      await loadEvents(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка теста');
      await loadEvents(page);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Замок</h1>
      <p className="muted page-subtitle">
        Главная дверь клуба. Клиент открывает из приложения — команда всегда идёт
        через сервер.
      </p>

      <form className="card card-form" onSubmit={onSave}>
        <h3>Режим</h3>

        <div className="mode-switch" role="group" aria-label="Режим замка">
          <button
            type="button"
            className={!liveMode ? 'active' : undefined}
            onClick={() => {
              setLiveMode(false);
              setError('');
              setMessage('');
            }}
          >
            Симуляция
          </button>
          <button
            type="button"
            className={liveMode ? 'active' : undefined}
            onClick={() => {
              setLiveMode(true);
              setError('');
              setMessage('');
            }}
          >
            Боевой
          </button>
        </div>

        {!liveMode ? (
          <p className="muted form-hint">
            Без железа. Приложение работает как обычно — дверь «открывается» на
            сервере. Для сторов и теста этого достаточно. Когда появится мост —
            переключи на «Боевой» и впиши URL.
          </p>
        ) : (
          <>
            <p className="muted form-hint">
              Сервер шлёт команду на мост в клубе (Pi / Shelly). Нужны URL моста и
              токен.
            </p>
            <label>
              ID замка
              <input
                className="input"
                value={mainDoorLockId}
                onChange={(e) => setMainDoorLockId(e.target.value)}
                placeholder="main-door"
              />
            </label>
            <label>
              URL моста
              <input
                className="input"
                value={lockHttpBaseUrl}
                onChange={(e) => setLockHttpBaseUrl(e.target.value)}
                placeholder="https://locks.example.com/api"
              />
            </label>
            <label>
              Токен
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={lockHttpToken}
                onChange={(e) => setLockHttpToken(e.target.value)}
                placeholder={
                  tokenSet ? '•••••••• (пусто = не менять)' : 'Bearer-токен моста'
                }
              />
            </label>
          </>
        )}

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        <div className="form-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
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

      <div className="card" style={{ marginTop: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Журнал замка</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => loadEvents(page)}
            disabled={eventsLoading}
          >
            Обновить
          </button>
        </div>
        <p className="muted form-hint">
          Открытия из приложения и тесты. Всего: {total}
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Замок</th>
                <th>Режим</th>
                <th>Ок</th>
                <th>Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <TableEmptyRow
                  colSpan={5}
                  message={
                    eventsLoading
                      ? 'Загрузка…'
                      : 'Пока пусто — нажми тест или открой дверь из приложения'
                  }
                />
              )}
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.createdAt).toLocaleString('ru-RU')}</td>
                  <td>{ev.lockTarget}</td>
                  <td>{ev.provider === 'mock' ? 'симуляция' : ev.provider}</td>
                  <td>{ev.success ? 'да' : 'нет'}</td>
                  <td className="muted">{ev.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={page <= 1 || eventsLoading}
            onClick={() => loadEvents(page - 1)}
          >
            ← Назад
          </button>
          <span className="muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages || eventsLoading}
            onClick={() => loadEvents(page + 1)}
          >
            Вперёд →
          </button>
        </div>
      </div>
    </>
  );
}
