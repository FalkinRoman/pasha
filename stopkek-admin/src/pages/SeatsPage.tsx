import { useEffect, useState } from 'react';
import { SeatRow, fetchSeats, updateSeat } from '../api/admin';
import { SEAT_STATUS } from '../lib/statusLabels';

const STATUSES = ['free', 'occupied', 'reserved', 'repair'] as const;

export function SeatsPage() {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchSeats()
      .then(setSeats)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onStatus = async (id: string, status: string) => {
    await updateSeat(id, status);
    load();
  };

  const counts = STATUSES.reduce(
    (acc, s) => {
      acc[s] = seats.filter((x) => x.status === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <h1 className="page-title">Места ПК</h1>
      <p className="muted page-desc">
        Свободно {counts.free} · Занято {counts.occupied} · Бронь {counts.reserved} · Ремонт{' '}
        {counts.repair}
      </p>
      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Зона</th>
                  <th className="hide-mobile">Железо</th>
                  <th>₽/ч</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {seats.map((s) => (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{s.zoneName}</td>
                    <td className="muted hide-mobile">{s.specs}</td>
                    <td>{s.pricePerHour}</td>
                    <td>
                      <select
                        className="input"
                        style={{ width: '100%', maxWidth: 160 }}
                        value={s.status}
                        onChange={(e) => onStatus(s.id, e.target.value)}
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {SEAT_STATUS[st]}
                          </option>
                        ))}
                      </select>
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
