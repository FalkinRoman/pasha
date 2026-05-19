import { FormEvent, useEffect, useState } from 'react';
import { UserRow, adjustWallet, fetchUser, fetchUsers } from '../api/admin';
import { TX_TYPE } from '../lib/statusLabels';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchUser>> | null>(null);
  const [adjustRub, setAdjustRub] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const load = () => fetchUsers(search || undefined).then(setRows);

  useEffect(() => {
    load();
  }, []);

  const openUser = async (id: string) => {
    setSelectedId(id);
    setDetail(await fetchUser(id));
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    load();
  };

  const onAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const rub = Number(adjustRub);
    if (!Number.isFinite(rub) || rub === 0) return;
    await adjustWallet(selectedId, Math.round(rub * 100), adjustNote || undefined);
    setAdjustRub('');
    openUser(selectedId);
    load();
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
              Баланс: <strong>{detail.balanceRub.toLocaleString('ru-RU')} ₽</strong>
            </p>
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
