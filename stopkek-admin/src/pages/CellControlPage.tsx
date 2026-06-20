import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockerLogRow, fetchAccessLogs } from '../api/admin';
import { BOOKING_STATUS, SESSION_PHASE } from '../lib/statusLabels';
import { TableEmptyRow } from '../components/TableEmptyRow';
import './CellControlPage.css';

const TYPE_LABEL: Record<string, string> = {
  lock_open_main: 'Главная дверь',
  lock_open_cell: 'Бокс (архив)',
};

const TYPE_BADGE: Record<string, string> = {
  lock_open_main: 'cell-badge--main',
  lock_open_cell: 'cell-badge--cell',
};

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CellControlPage() {
  const [rows, setRows] = useState<LockerLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const q = search.trim();
      const asNum = q ? Number(q.replace(/\D/g, '')) : NaN;
      const isPlace = Number.isFinite(asNum) && asNum > 0;
      fetchAccessLogs({
        seatNumber: isPlace ? asNum : undefined,
        cellLock: !isPlace && q.length >= 2 ? q : undefined,
        limit: 150,
      })
        .then(setRows)
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="cell-page-full">
      <h1 className="page-title">Журнал доступа</h1>
      <p className="muted page-subtitle">
        Открытия главной двери из приложения. Настройка замка и API — в{' '}
        <Link to="/settings">Настройки</Link>.
      </p>

      <input
        className="input"
        style={{ maxWidth: 280, marginBottom: 16 }}
        placeholder="Место №"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card cell-table-card">
        <div className="table-wrap">
          <table className="table cell-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Событие</th>
                <th>Место</th>
                <th>Замок</th>
                <th>Клиент</th>
                <th>Бронь</th>
                <th>OK</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Загрузка…
                  </td>
                </tr>
              ) : (
                <>
                  {rows.length === 0 && <TableEmptyRow colSpan={7} />}
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="col-time">{fmtShort(r.createdAt)}</td>
                      <td>
                        <span
                          className={`cell-badge ${TYPE_BADGE[r.type] ?? 'cell-badge--cell'}`}
                        >
                          {TYPE_LABEL[r.type] ?? r.type}
                        </span>
                      </td>
                      <td>#{r.seatNumber}</td>
                      <td>
                        <span className="cell-lock">{r.cellLock}</span>
                      </td>
                      <td className="col-client">
                        {r.userName}
                        <span className="phone">{r.userPhone}</span>
                      </td>
                      <td className="col-booking">
                        {r.bookingId ? (
                          <>
                            <span className="muted" style={{ fontSize: 11 }}>
                              {r.bookingStatus
                                ? BOOKING_STATUS[r.bookingStatus] ?? r.bookingStatus
                                : '—'}
                              {r.bookingPhase
                                ? ` · ${SESSION_PHASE[r.bookingPhase] ?? r.bookingPhase}`
                                : ''}
                            </span>
                            {r.bookingStartAt ? (
                              <span className="phone">
                                {fmtShort(r.bookingStartAt)} —{' '}
                                {r.bookingEndAt ? fmtShort(r.bookingEndAt) : '…'}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{r.lockOk === false ? '✗' : r.lockOk === true ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
