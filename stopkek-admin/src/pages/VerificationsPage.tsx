import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, API_URL, getToken } from '../api/client';
import {
  VerificationRow,
  approveVerification,
  fetchVerifications,
  rejectVerification,
} from '../api/admin';
import { Modal } from '../components/Modal';

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VerificationsPage() {
  const [list, setList] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<VerificationRow | null>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await fetchVerifications();
      setList(data);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    for (const v of list) {
      if (photos[v.id]) continue;
      fetch(`${API_URL}${v.photoUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.blob())
        .then((b) => {
          const url = URL.createObjectURL(b);
          setPhotos((prev) => ({ ...prev, [v.id]: url }));
        })
        .catch(() => {});
    }
  }, [list, photos]);

  const onApprove = async (id: string) => {
    setError('');
    try {
      await approveVerification(id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка');
    }
  };

  const onReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    setError('');
    try {
      await rejectVerification(rejecting.id, reason.trim());
      setRejecting(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    }
  };

  return (
    <>
      <h1 className="page-title">Верификация</h1>
      <p className="muted page-desc">
        Проверка паспорта. Если не ответить за 5 минут — клиент пройдёт автоматически.
      </p>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <div className="card">
          <p className="muted">Нет заявок на проверке</p>
        </div>
      ) : (
        <div className="verification-grid">
          {list.map((v) => (
            <div key={v.id} className="card verification-card">
              <div className="verification-timer">
                Авто через {formatTimer(v.secondsUntilAutoApprove)}
              </div>
              <p>
                <strong>{v.userName}</strong>
              </p>
              <p className="muted">{v.userPhone}</p>
              <p className="muted" style={{ fontSize: 12 }}>
                {new Date(v.submittedAt).toLocaleString('ru-RU')}
              </p>
              {photos[v.id] ? (
                <img src={photos[v.id]} alt="Паспорт" className="verification-photo" />
              ) : (
                <div className="verification-photo placeholder">Загрузка фото…</div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onApprove(v.id)}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setRejecting(v)}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={rejecting !== null}
        title="Отклонить верификацию"
        onClose={() => {
          setRejecting(null);
          setReason('');
        }}
      >
        <form onSubmit={onReject}>
          <label>
            Причина (увидит клиент в приложении)
            <textarea
              className="input"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
            />
          </label>
          <div className="modal-actions">
            <button type="submit" className="btn">
              Отклонить
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRejecting(null)}
            >
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
