import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FloorMapPreview } from '../components/FloorMapPreview';
import { Dashboard, fetchDashboard, fetchFloorMap, FloorMapData } from '../api/admin';
import { BOOKING_STATUS, SEAT_STATUS } from '../lib/statusLabels';

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
  const [floor, setFloor] = useState<FloorMapData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchFloorMap()])
      .then(([d, f]) => {
        setData(d);
        setFloor(f);
      })
      .catch(() => setError('Не удалось загрузить дашборд'));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Загрузка…</p>;

  const totalSeats =
    data.seatsByStatus.free +
    data.seatsByStatus.occupied +
    data.seatsByStatus.reserved +
    data.seatsByStatus.repair;

  return (
    <>
      <h1 className="page-title">Дашборд</h1>

      {(data.pendingVerifications ?? 0) > 0 ? (
        <Link to="/verifications" className="card dashboard-task-card">
          <div className="dashboard-task-head">
            <span className="dashboard-task-badge">{data.pendingVerifications}</span>
            <strong>Верификация — нужно закрыть</strong>
          </div>
          <p className="muted dashboard-task-desc">
            {data.pendingVerifications === 1
              ? '1 заявка на проверке паспорта. Откройте раздел и примите или отклоните.'
              : `${data.pendingVerifications} заявок на проверке. Без ответа за 5 минут клиент пройдёт автоматически.`}
          </p>
          <span className="dashboard-task-cta">Перейти к верификации →</span>
        </Link>
      ) : null}

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

      <div className="card dashboard-map-card">
        <div className="section-head">
          <h2 className="section-title">Зал сейчас</h2>
          <span className="muted dashboard-map-meta">
            {totalSeats} мест · занято {data.seatsByStatus.occupied + data.seatsByStatus.reserved}
          </span>
        </div>
        {floor ? (
          <FloorMapPreview seats={floor.seats} zones={floor.zones} />
        ) : (
          <p className="muted">Карта загружается…</p>
        )}
        <div className="dashboard-status-chips">
          {(
            [
              ['free', data.seatsByStatus.free],
              ['occupied', data.seatsByStatus.occupied],
              ['reserved', data.seatsByStatus.reserved],
              ['repair', data.seatsByStatus.repair],
            ] as const
          ).map(([status, count]) => (
            <span key={status} className={`status-chip status-chip-${status}`}>
              {SEAT_STATUS[status]}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="dashboard-split">
        <div className="card">
          <h3>Последние отзывы</h3>
          {data.recentFeedback.length === 0 && <p className="muted">Пока нет</p>}
          {data.recentFeedback.map((f) => (
            <p key={f.id} className="feedback-line">
              ★{f.rating} <strong>{f.userName}</strong>: {f.message.slice(0, 100)}
            </p>
          ))}
        </div>
        <div className="card">
          <h3>Быстро</h3>
          <p className="muted">
            Управление: «Места и зоны», «Брони»,{' '}
            {(data.pendingVerifications ?? 0) > 0 ? (
              <Link to="/verifications">верификация ({data.pendingVerifications})</Link>
            ) : (
              'верификация'
            )}{' '}
            в меню слева.
          </p>
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
