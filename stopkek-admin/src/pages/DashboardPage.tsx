import { useEffect, useState } from 'react';
import { Dashboard, fetchDashboard } from '../api/admin';
import { BOOKING_STATUS } from '../lib/statusLabels';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setError('Не удалось загрузить дашборд'));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Загрузка…</p>;

  return (
    <>
      <h1 className="page-title">Дашборд</h1>
      <div className="grid-stats">
        <div className="card">
          <div className="stat-value">{data.usersCount}</div>
          <div className="stat-label">Клиентов</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.bookingsToday}</div>
          <div className="stat-label">Броней сегодня</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.revenueTodayRub.toLocaleString('ru-RU')} ₽</div>
          <div className="stat-label">Выручка сегодня</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.occupancyPercent}%</div>
          <div className="stat-label">Занятость зала</div>
        </div>
      </div>

      <div className="dashboard-split">
        <div className="card">
          <h3>Места</h3>
          <p className="muted">Свободно: {data.seatsByStatus.free}</p>
          <p className="muted">Занято: {data.seatsByStatus.occupied}</p>
          <p className="muted">Забронировано: {data.seatsByStatus.reserved}</p>
          <p className="muted">Ремонт: {data.seatsByStatus.repair}</p>
        </div>
        <div className="card">
          <h3>Последние отзывы</h3>
          {data.recentFeedback.length === 0 && <p className="muted">Пока нет</p>}
          {data.recentFeedback.map((f) => (
            <p key={f.id} className="feedback-line">
              ★{f.rating} <strong>{f.userName}</strong>: {f.message.slice(0, 100)}
            </p>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Последние брони</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Места</th>
                <th>Статус</th>
                <th className="hide-mobile">Сумма</th>
                <th className="hide-mobile">Создана</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.userPhone}</td>
                  <td>{b.seats.map((s) => `#${s.number}`).join(', ')}</td>
                  <td>
                    <span className={`badge badge-${b.status}`}>
                      {BOOKING_STATUS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="hide-mobile">{b.totalPriceRub} ₽</td>
                  <td className="hide-mobile">{fmtDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
