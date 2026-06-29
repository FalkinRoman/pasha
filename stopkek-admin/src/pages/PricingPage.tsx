import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  DurationPackageRow,
  NightPricingRow,
  PricingData,
  createDurationPackage,
  createNightPricing,
  deleteDurationPackage,
  deleteNightPricing,
  fetchPricing,
  updateDurationPackage,
  updateNightPricing,
  updateZone,
} from '../api/admin';
import { Modal } from '../components/Modal';
import { TableEmptyRow } from '../components/TableEmptyRow';

const emptyPkg = () => ({
  zoneId: '',
  minHours: '3',
  discountPercent: '7',
  label: '',
  badge: '',
  recommended: false,
  active: true,
});

const emptyWindow = () => ({
  zoneId: '',
  startHour: '10',
  endHour: '16',
  discountPercent: '26',
  active: true,
});

function padHour(h: number) {
  return String(h).padStart(2, '0');
}

function formatWindow(start: number, end: number) {
  return `${padHour(start)}:00–${padHour(end)}:00`;
}

function windowTypeLabel(startHour: number): string {
  if (startHour >= 21 || startHour <= 5) return 'Ночной';
  if (startHour >= 6 && startHour <= 12) return 'Утренний';
  return 'Дневной';
}

export function PricingPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pkgForm, setPkgForm] = useState<'create' | DurationPackageRow | null>(null);
  const [pkgFields, setPkgFields] = useState(emptyPkg);

  const [windowForm, setWindowForm] = useState<'create' | NightPricingRow | null>(null);
  const [windowFields, setWindowFields] = useState(emptyWindow);

  const [zonePrices, setZonePrices] = useState<Record<string, string>>({});
  const [savingZone, setSavingZone] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchPricing();
      setData(d);
      setZonePrices(
        Object.fromEntries(d.zones.map((z) => [z.id, String(z.pricePerHour)]))
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreatePkg = () => {
    setPkgForm('create');
    setPkgFields(emptyPkg());
  };

  const openEditPkg = (p: DurationPackageRow) => {
    setPkgForm(p);
    setPkgFields({
      zoneId: p.zoneId ?? '',
      minHours: String(p.minHours),
      discountPercent: String(p.discountPercent),
      label: p.label,
      badge: p.badge ?? '',
      recommended: p.recommended,
      active: p.active,
    });
  };

  const savePkg = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      zoneId: pkgFields.zoneId || null,
      minHours: Number(pkgFields.minHours),
      discountPercent: Number(pkgFields.discountPercent),
      label: pkgFields.label.trim(),
      badge: pkgFields.badge.trim() || null,
      recommended: pkgFields.recommended,
      active: pkgFields.active,
    };
    try {
      if (pkgForm === 'create') {
        await createDurationPackage(body);
      } else if (pkgForm) {
        await updateDurationPackage(pkgForm.id, body);
      }
      setPkgForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения');
    }
  };

  const removePkg = async (id: string) => {
    if (!confirm('Удалить пакет?')) return;
    try {
      await deleteDurationPackage(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка удаления');
    }
  };

  const openCreateWindow = () => {
    setWindowForm('create');
    setWindowFields(emptyWindow());
  };

  const openEditWindow = (w: NightPricingRow) => {
    setWindowForm(w);
    setWindowFields({
      zoneId: w.zoneId ?? '',
      startHour: String(w.startHour),
      endHour: String(w.endHour),
      discountPercent: String(w.discountPercent),
      active: w.active,
    });
  };

  const saveWindow = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      zoneId: windowFields.zoneId || null,
      startHour: Number(windowFields.startHour),
      endHour: Number(windowFields.endHour),
      discountPercent: Number(windowFields.discountPercent),
      active: windowFields.active,
    };
    try {
      if (windowForm === 'create') {
        await createNightPricing(body);
      } else if (windowForm) {
        await updateNightPricing(windowForm.id, body);
      }
      setWindowForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения тарифа');
    }
  };

  const removeWindow = async (id: string) => {
    if (!confirm('Удалить правило?')) return;
    try {
      await deleteNightPricing(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка удаления');
    }
  };

  const saveZonePrice = async (zoneId: string) => {
    const v = Number(zonePrices[zoneId]);
    if (!Number.isFinite(v) || v < 0) {
      setError('Неверная цена за час');
      return;
    }
    setSavingZone(zoneId);
    setError('');
    try {
      await updateZone(zoneId, { pricePerHour: v });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения цены');
    } finally {
      setSavingZone(null);
    }
  };

  const zoneName = (zoneId: string | null) =>
    !zoneId ? 'Все зоны' : data?.zones.find((z) => z.id === zoneId)?.name ?? zoneId;

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div className="page">
      <h1>Тарифы и скидки</h1>
      <p className="muted page-lead">
        Базовая цена за час, скидки по времени суток и пакеты по длительности. Итог в
        приложении считается на сервере.
      </p>
      {error ? <p className="error-text">{error}</p> : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Базовая цена (₽ / час)
        </h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Зона</th>
                <th>₽ / час</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data?.zones.length ? (
                <TableEmptyRow colSpan={3} message="Нет зон" />
              ) : (
                data.zones.map((z) => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        style={{ maxWidth: 120 }}
                        value={zonePrices[z.id] ?? ''}
                        onChange={(e) =>
                          setZonePrices((m) => ({ ...m, [z.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={savingZone === z.id}
                        onClick={() => saveZonePrice(z.id)}
                      >
                        {savingZone === z.id ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Полная ставка вне скидочных интервалов. Скидки по времени и пакеты считаются от
          неё.
        </p>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-head">
          <h2 className="section-title">Скидки по времени суток</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateWindow}>
            Добавить интервал
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Интервал</th>
                <th>Скидка</th>
                <th>Зона</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data?.nightRules.length ? (
                <TableEmptyRow
                  colSpan={6}
                  message="Нет правил — добавьте ночной (23–08) и утренний (10–16)"
                />
              ) : (
                data.nightRules.map((w) => (
                  <tr key={w.id}>
                    <td>{windowTypeLabel(w.startHour)}</td>
                    <td>{formatWindow(w.startHour, w.endHour)}</td>
                    <td>−{w.discountPercent}%</td>
                    <td>{zoneName(w.zoneId)}</td>
                    <td>{w.active ? 'Вкл' : 'Выкл'}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditWindow(w)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeWindow(w.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Скидка применяется только к минутам брони, попавшим в интервал (например ночь
          23:00–08:00 −36%, утро 10:00–16:00 −26%).
        </p>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-head">
          <h2 className="section-title">Пакеты по часам</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreatePkg}>
            Добавить пакет
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>От, ч</th>
                <th>Скидка</th>
                <th>Название</th>
                <th>Бейдж</th>
                <th>Зона</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data?.packages.length ? (
                <TableEmptyRow colSpan={7} message="Нет пакетов" />
              ) : (
                data.packages.map((p) => (
                  <tr key={p.id}>
                    <td>{p.minHours}+</td>
                    <td>−{p.discountPercent}%</td>
                    <td>
                      {p.label}
                      {p.recommended ? ' ★' : ''}
                    </td>
                    <td>{p.badge ?? '—'}</td>
                    <td>{zoneName(p.zoneId)}</td>
                    <td>{p.active ? 'Вкл' : 'Выкл'}</td>
                    <td className="table-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditPkg(p)}>
                        Изменить
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePkg(p.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={windowForm !== null}
        title={windowForm === 'create' ? 'Новый интервал' : 'Редактировать интервал'}
        onClose={() => setWindowForm(null)}
      >
        <form onSubmit={saveWindow} className="card-form">
          <label>
            С (час, 0–23)
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={windowFields.startHour}
              onChange={(e) => setWindowFields((f) => ({ ...f, startHour: e.target.value }))}
              required
            />
          </label>
          <label>
            До (час, 0–23)
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={windowFields.endHour}
              onChange={(e) => setWindowFields((f) => ({ ...f, endHour: e.target.value }))}
              required
            />
          </label>
          <label>
            Скидка, %
            <input
              className="input"
              type="number"
              min={0}
              max={90}
              value={windowFields.discountPercent}
              onChange={(e) => setWindowFields((f) => ({ ...f, discountPercent: e.target.value }))}
              required
            />
          </label>
          <label>
            Зона (пусто = все)
            <select
              className="input"
              value={windowFields.zoneId}
              onChange={(e) => setWindowFields((f) => ({ ...f, zoneId: e.target.value }))}
            >
              <option value="">Все зоны</option>
              {data?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pricing-night-check">
            <input
              type="checkbox"
              checked={windowFields.active}
              onChange={(e) => setWindowFields((f) => ({ ...f, active: e.target.checked }))}
            />
            Активен
          </label>
          <div className="form-footer">
            <button type="submit" className="btn btn-primary btn-block">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setWindowForm(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pkgForm !== null}
        title={pkgForm === 'create' ? 'Новый пакет' : 'Редактировать пакет'}
        onClose={() => setPkgForm(null)}
      >
        <form onSubmit={savePkg} className="card-form">
          <label>
            Минимум часов
            <input
              className="input"
              type="number"
              min={1}
              max={12}
              value={pkgFields.minHours}
              onChange={(e) => setPkgFields((f) => ({ ...f, minHours: e.target.value }))}
              required
            />
          </label>
          <label>
            Скидка, %
            <input
              className="input"
              type="number"
              min={0}
              max={90}
              value={pkgFields.discountPercent}
              onChange={(e) => setPkgFields((f) => ({ ...f, discountPercent: e.target.value }))}
              required
            />
          </label>
          <label>
            Название
            <input
              className="input"
              value={pkgFields.label}
              onChange={(e) => setPkgFields((f) => ({ ...f, label: e.target.value }))}
              placeholder="Пакет 6 ч"
              required
            />
          </label>
          <label>
            Бейдж в приложении
            <input
              className="input"
              value={pkgFields.badge}
              onChange={(e) => setPkgFields((f) => ({ ...f, badge: e.target.value }))}
              placeholder="−13%"
            />
          </label>
          <label>
            Зона (пусто = все)
            <select
              className="input"
              value={pkgFields.zoneId}
              onChange={(e) => setPkgFields((f) => ({ ...f, zoneId: e.target.value }))}
            >
              <option value="">Все зоны</option>
              {data?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pricing-night-check">
            <input
              type="checkbox"
              checked={pkgFields.recommended}
              onChange={(e) => setPkgFields((f) => ({ ...f, recommended: e.target.checked }))}
            />
            Рекомендуем в приложении
          </label>
          <label className="pricing-night-check">
            <input
              type="checkbox"
              checked={pkgFields.active}
              onChange={(e) => setPkgFields((f) => ({ ...f, active: e.target.checked }))}
            />
            Активен
          </label>
          <div className="form-footer">
            <button type="submit" className="btn btn-primary btn-block">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setPkgForm(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
