import { FormEvent, useEffect, useState } from 'react';
import { ApiError, API_URL, getToken } from '../api/client';
import { UserDetail, UserRow, adjustWallet, fetchUser, fetchUsers } from '../api/admin';
import { IDENTITY_STATUS, TX_TYPE } from '../lib/statusLabels';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU');
}

function identityBadgeClass(status: string, verified: boolean) {
  if (verified) return 'badge badge-verified';
  if (status === 'pending') return 'badge badge-pending';
  if (status === 'rejected') return 'badge badge-rejected';
  return 'badge badge-none';
}

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [adjustRub, setAdjustRub] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  const load = () => fetchUsers(search || undefined).then(setRows);

  useEffect(() => {
    load();
  }, []);

  const openUser = async (id: string) => {
    setSelectedId(id);
    setPhotoUrl(null);
    setPhotoError('');
    setDetail(await fetchUser(id));
  };

  useEffect(() => {
    const v = detail?.verification;
    if (!v?.photoUrl) {
      setPhotoUrl(null);
      return;
    }
    const token = getToken();
    if (!token) return;

    let revoked = false;
    fetch(`${API_URL}${v.photoUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Фото не найдено');
        return r.blob();
      })
      .then((b) => {
        if (revoked) return;
        setPhotoUrl(URL.createObjectURL(b));
        setPhotoError('');
      })
      .catch(() => {
        if (!revoked) setPhotoError('Не удалось загрузить фото');
      });

    return () => {
      revoked = true;
    };
  }, [detail?.verification?.id, detail?.verification?.photoUrl]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    load();
  };

  const onAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const rub = Number(adjustRub);
    if (!Number.isFinite(rub) || rub === 0) return;
    try {
      await adjustWallet(selectedId, Math.round(rub * 100), adjustNote || undefined);
      setAdjustRub('');
      openUser(selectedId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ошибка');
    }
  };

  return (
    <>
      <h1 className="page-title">Клиенты</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input
          className="input"
          style={{ flex: 1, maxWidth: 320 }}
          placeholder="Телефон или имя"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn">
          Найти
        </button>
      </form>

      <div className="users-split">
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th>Имя</th>
                  <th>Верификация</th>
                  <th>Баланс</th>
                  <th className="hide-mobile">Броней</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={selectedId === u.id ? 'row-selected' : ''}>
                    <td>{u.phone}</td>
                    <td>{u.name}</td>
                    <td>
                      <span
                        className={identityBadgeClass(
                          u.identityStatus,
                          u.identityVerified
                        )}
                      >
                        {IDENTITY_STATUS[u.identityStatus] ?? u.identityStatus}
                      </span>
                    </td>
                    <td>{u.balanceRub.toLocaleString('ru-RU')} ₽</td>
                    <td className="hide-mobile">{u.bookingsCount}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => openUser(u.id)}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detail && (
          <div className="card user-detail">
            <h3>{detail.name}</h3>
            <p className="muted">{detail.phone}</p>
            <p>
              <span
                className={identityBadgeClass(
                  detail.identityStatus,
                  detail.identityVerified
                )}
              >
                {IDENTITY_STATUS[detail.identityStatus] ?? detail.identityStatus}
              </span>
            </p>
            <p>
              Баланс: <strong>{detail.balanceRub.toLocaleString('ru-RU')} ₽</strong>
            </p>

            {detail.verification ? (
              <div className="user-verification-block">
                <h4>Верификация</h4>
                <p className="muted" style={{ fontSize: 13 }}>
                  Отправлено: {fmtDate(detail.verification.submittedAt)}
                  {detail.verification.resolvedAt
                    ? ` · Решение: ${fmtDate(detail.verification.resolvedAt)}`
                    : null}
                </p>
                {detail.verification.rejectReason ? (
                  <p className="error" style={{ fontSize: 13 }}>
                    Причина отклонения: {detail.verification.rejectReason}
                  </p>
                ) : null}
                {detail.identityVerified || detail.verification.status !== 'pending' ? (
                  photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Фото с паспортом"
                      className="verification-photo"
                    />
                  ) : photoError ? (
                    <p className="muted">{photoError}</p>
                  ) : (
                    <div className="verification-photo placeholder">Загрузка фото…</div>
                  )
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Активная заявка — фото в разделе «Верификация».
                  </p>
                )}
              </div>
            ) : (
              <p className="muted user-verification-block">
                Верификация не отправлялась
              </p>
            )}

            <form onSubmit={onAdjust} className="adjust-form">
              <h4>Корректировка баланса</h4>
              <input
                className="input"
                type="number"
                placeholder="Сумма ₽ (+ / −)"
                value={adjustRub}
                onChange={(e) => setAdjustRub(e.target.value)}
              />
              <input
                className="input"
                placeholder="Комментарий"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
              <button type="submit" className="btn">
                Применить
              </button>
            </form>
            <h4>Транзакции</h4>
            {detail.transactions.map((t) => (
              <p key={t.id} className="muted tx-line">
                {TX_TYPE[t.type] ?? t.type}: {t.amountRub >= 0 ? '+' : ''}
                {t.amountRub} ₽ — {t.description}
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
