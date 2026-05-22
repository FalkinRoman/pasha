import { useEffect, useState } from 'react';
import { BookingRow, cancelBooking, fetchBookings } from '../api/admin';
import { TableEmptyRow } from '../components/TableEmptyRow';
import { BOOKING_STATUS, SESSION_PHASE } from '../lib/statusLabels';

const STATUSES = [
  '',
  'pending_payment',
  'paid',
  'active',
  'completed',
  'cancelled',
] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BookingsPage() {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchBookings(status || undefined)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status]);

  return (
    <>
      <h1 className="page-title">Бронирования</h1>
      <div className="toolbar">
        <select
          className="input"
          style={{ width: '100%', maxWidth: 220 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? BOOKING_STATUS[s] : 'Все статусы'}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Места</th>
                  <th className="hide-mobile">Начало</th>
                  <th className="hide-mobile">Конец</th>
                  <th>Статус</th>
                  <th className="hide-mobile">Этап</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <TableEmptyRow colSpan={8} />}
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.userPhone}</td>
                    <td>{b.seats.map((s) => `#${s.number}`).join(', ')}</td>
                    <td className="hide-mobile">{fmt(b.startAt)}</td>
                    <td className="hide-mobile">{fmt(b.endAt)}</td>
                    <td>
                      <span className={`badge badge-${b.status}`}>
                        {BOOKING_STATUS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="hide-mobile muted">
                      {b.sessionPhase
                        ? SESSION_PHASE[b.sessionPhase] ?? b.sessionPhase
                        : '—'}
                    </td>
                    <td>{b.totalPriceRub} ₽</td>
                    <td>
                      {['pending_payment', 'paid', 'active'].includes(b.status) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => cancelBooking(b.id).then(load)}
                        >
                          Отменить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
