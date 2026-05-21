import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  SeatRow,
  ZoneRow,
  createSeat,
  createZone,
  deleteSeat,
  deleteZone,
  fetchSeats,
  fetchZones,
  updateSeat,
  updateZone,
} from '../api/admin';
import { Modal } from '../components/Modal';
import { TableEmptyRow } from '../components/TableEmptyRow';
import { SEAT_STATUS } from '../lib/statusLabels';

const STATUSES = ['free', 'occupied', 'reserved', 'repair'] as const;

function placeWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'место';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'места';
  return 'мест';
}

export function SeatsPage() {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [zoneForm, setZoneForm] = useState<'create' | ZoneRow | null>(null);
  const [zoneSlug, setZoneSlug] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneSpecs, setZoneSpecs] = useState('');
  const [zonePrice, setZonePrice] = useState('150');

  const [seatForm, setSeatForm] = useState<'create' | SeatRow | null>(null);
  const [seatNumber, setSeatNumber] = useState('');
  const [seatZoneId, setSeatZoneId] = useState('');
  const [seatStatus, setSeatStatus] = useState<string>('free');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [z, s] = await Promise.all([fetchZones(), fetchSeats()]);
      setZones(z);
      setSeats(s);
      if (!seatZoneId && z[0]) setSeatZoneId(z[0].id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showErr = (e: unknown) => {
    setError(e instanceof ApiError ? e.message : 'Ошибка');
  };

  const openCreateZone = () => {
    setZoneForm('create');
    setZoneSlug('');
    setZoneName('');
    setZoneSpecs('');
    setZonePrice('150');
  };

  const openEditZone = (z: ZoneRow) => {
    setZoneForm(z);
    setZoneSlug(z.slug);
    setZoneName(z.name);
    setZoneSpecs(z.specs);
    setZonePrice(String(z.pricePerHour));
  };

  const onSaveZone = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const price = Number(zonePrice);
      if (!price || price < 1) {
        setError('Цена должна быть ≥ 1');
        return;
      }
      if (zoneForm === 'create') {
        await createZone({
          slug: zoneSlug.trim().toLowerCase(),
          name: zoneName.trim(),
          specs: zoneSpecs.trim(),
          pricePerHour: price,
        });
      } else if (zoneForm) {
        await updateZone(zoneForm.id, {
          name: zoneName.trim(),
          specs: zoneSpecs.trim(),
          pricePerHour: price,
        });
      }
      setZoneForm(null);
      await load();
    } catch (err) {
      showErr(err);
    }
  };

  const onDeleteZone = async (z: ZoneRow) => {
    if (!confirm(`Удалить зону «${z.name}»?`)) return;
    setError('');
    try {
      await deleteZone(z.id);
      await load();
    } catch (err) {
      showErr(err);
    }
  };

  const openCreateSeat = () => {
    const nextNum =
      seats.length > 0 ? Math.max(...seats.map((s) => s.number)) + 1 : 1;
    setSeatForm('create');
    setSeatNumber(String(nextNum));
    setSeatZoneId(zones[0]?.id ?? '');
    setSeatStatus('free');
  };

  const openEditSeat = (s: SeatRow) => {
    setSeatForm(s);
    setSeatNumber(String(s.number));
    setSeatZoneId(s.zoneId);
    setSeatStatus(s.status);
  };

  const onSaveSeat = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const num = Number(seatNumber);
    if (!num || num < 1) {
      setError('Номер места ≥ 1');
      return;
    }
    try {
      if (seatForm === 'create') {
        await createSeat({ zoneId: seatZoneId, number: num, status: seatStatus });
      } else if (seatForm) {
        await updateSeat(seatForm.id, {
          zoneId: seatZoneId,
          number: num,
          status: seatStatus,
        });
      }
      setSeatForm(null);
      await load();
    } catch (err) {
      showErr(err);
    }
  };

  const onDeleteSeat = async (s: SeatRow) => {
    if (!confirm(`Удалить место №${s.number}?`)) return;
    setError('');
    try {
      await deleteSeat(s.id);
      await load();
    } catch (err) {
      showErr(err);
    }
  };

  const onQuickStatus = async (id: string, status: string) => {
    setError('');
    try {
      await updateSeat(id, { status });
      await load();
    } catch (err) {
      showErr(err);
    }
  };

  const counts = STATUSES.reduce(
    (acc, st) => {
      acc[st] = seats.filter((x) => x.status === st).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const zoneModalTitle =
    zoneForm === 'create' ? 'Новая зона' : zoneForm ? `Зона: ${zoneForm.slug}` : '';

  const seatModalTitle =
    seatForm === 'create'
      ? 'Новое место'
      : seatForm
        ? `Место №${seatForm.number}`
        : '';

  return (
    <>
      <h1 className="page-title">Места и зоны</h1>
      <p className="muted page-desc">
        Свободно {counts.free ?? 0} · Занято {counts.occupied ?? 0} · Бронь{' '}
        {counts.reserved ?? 0} · Ремонт {counts.repair ?? 0}
      </p>
      {error && <p className="error">{error}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-head">
          <h2 className="section-title">Зоны</h2>
          <button type="button" className="btn btn-sm" onClick={openCreateZone}>
            + Зона
          </button>
        </div>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Название</th>
                  <th className="hide-mobile">Железо</th>
                  <th>₽/час</th>
                  <th>Мест</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 && <TableEmptyRow colSpan={6} />}
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td>{z.slug}</td>
                    <td>{z.name}</td>
                    <td className="muted hide-mobile">{z.specs || '—'}</td>
                    <td>{z.pricePerHour}</td>
                    <td>{z.seatsCount}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEditZone(z)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => onDeleteZone(z)}
                        disabled={z.seatsCount > 0}
                        title={
                          z.seatsCount > 0
                            ? `Сначала удалите ${z.seatsCount} ${placeWord(z.seatsCount)} в этой зоне`
                            : 'Удалить зону'
                        }
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={zoneForm !== null}
        title={zoneModalTitle}
        onClose={() => setZoneForm(null)}
      >
        <form onSubmit={onSaveZone}>
          {zoneForm === 'create' && (
            <label>
              Slug (латиница)
              <input
                className="input"
                value={zoneSlug}
                onChange={(e) => setZoneSlug(e.target.value)}
                placeholder="vip-3"
                required
              />
            </label>
          )}
          <label>
            Название
            <input
              className="input"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              required
            />
          </label>
          <label>
            Железо / описание
            <input
              className="input"
              value={zoneSpecs}
              onChange={(e) => setZoneSpecs(e.target.value)}
            />
          </label>
          <label>
            Цена за час (₽)
            <input
              className="input"
              type="number"
              min={1}
              value={zonePrice}
              onChange={(e) => setZonePrice(e.target.value)}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="submit" className="btn">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setZoneForm(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">Места ПК</h2>
          <button
            type="button"
            className="btn btn-sm"
            onClick={openCreateSeat}
            disabled={zones.length === 0}
          >
            + Место
          </button>
        </div>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Зона</th>
                  <th className="hide-mobile">Железо</th>
                  <th>₽/ч</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {seats.length === 0 && (
                  <TableEmptyRow
                    colSpan={6}
                    message="Данных пока нет — добавьте зону и место"
                  />
                )}
                {seats.map((s) => (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{s.zoneName}</td>
                    <td className="muted hide-mobile">{s.specs || '—'}</td>
                    <td>{s.pricePerHour}</td>
                    <td>
                      <select
                        className="input"
                        style={{ width: '100%', maxWidth: 160 }}
                        value={s.status}
                        onChange={(e) => onQuickStatus(s.id, e.target.value)}
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {SEAT_STATUS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEditSeat(s)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => onDeleteSeat(s)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={seatForm !== null}
        title={seatModalTitle}
        onClose={() => setSeatForm(null)}
      >
        <form onSubmit={onSaveSeat}>
          <label>
            Номер ПК
            <input
              className="input"
              type="number"
              min={1}
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              required
            />
          </label>
          <label>
            Зона
            <select
              className="input"
              value={seatZoneId}
              onChange={(e) => setSeatZoneId(e.target.value)}
              required
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.pricePerHour} ₽/ч)
                </option>
              ))}
            </select>
          </label>
          <label>
            Статус
            <select
              className="input"
              value={seatStatus}
              onChange={(e) => setSeatStatus(e.target.value)}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {SEAT_STATUS[st]}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="submit" className="btn">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSeatForm(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
