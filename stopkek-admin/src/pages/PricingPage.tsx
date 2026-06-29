import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  DurationPackageRow,
  PricingData,
  createDurationPackage,
  deleteDurationPackage,
  deleteNightPricing,
  fetchPricing,
  updateDurationPackage,
  updateZone,
  upsertNightPricing,
} from '../api/admin';
import { Modal } from '../components/Modal';
import { TableEmptyRow } from '../components/TableEmptyRow';

const emptyPkg = () => ({
  zoneId: '',
  minHours: '3',
  discountPercent: '10',
  label: '',
  badge: '',
  recommended: false,
  active: true,
});

export function PricingPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pkgForm, setPkgForm] = useState<'create' | DurationPackageRow | null>(null);
  const [pkgFields, setPkgFields] = useState(emptyPkg);

  const [nightStart, setNightStart] = useState('23');
  const [nightEnd, setNightEnd] = useState('7');
  const [nightDiscount, setNightDiscount] = useState('20');
  const [nightActive, setNightActive] = useState(true);
  const [nightId, setNightId] = useState<string | null>(null);
  const [savingNight, setSavingNight] = useState(false);

  // Дневной (базовый) тариф — цена за час по зонам.
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
      const global = d.nightRules.find((n) => !n.zoneId);
      if (global) {
        setNightId(global.id);
        setNightStart(String(global.startHour));
        setNightEnd(String(global.endHour));
        setNightDiscount(String(global.discountPercent));
        setNightActive(global.active);
      }
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

  const saveNight = async (e: FormEvent) => {
    e.preventDefault();
    setSavingNight(true);
    setError('');
    try {
      const row = await upsertNightPricing({
        zoneId: null,
        startHour: Number(nightStart),
        endHour: Number(nightEnd),
        discountPercent: Number(nightDiscount),
        active: nightActive,
      });
      setNightId(row.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения ночи');
    } finally {
      setSavingNight(false);
    }
  };

  const removeNight = async () => {
    if (!nightId || !confirm('Отключить ночной тариф?')) return;
    try {
      await deleteNightPricing(nightId);
      setNightId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
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
        Дневная цена за час, пакеты по длительности и ночной тариф. Цена в приложении
        считается на сервере.
      </p>
      {error ? <p className="error-text">{error}</p> : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Дневной тариф (цена за час)
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
          Базовая цена за час (день). Скидки пакетов и ночной тариф считаются от неё.
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
                <TableEmptyRow colSpan={7} message="Нет пакетов — npm run seed:pricing в API" />
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

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Ночной тариф (глобальный)
        </h2>
        <form onSubmit={saveNight} className="card-form pricing-night-form">
          <div className="pricing-night-fields">
            <label>
              С (час)
              <input
                className="input"
                type="number"
                min={0}
                max={23}
                value={nightStart}
                onChange={(e) => setNightStart(e.target.value)}
              />
            </label>
            <label>
              До (час)
              <input
                className="input"
                type="number"
                min={0}
                max={23}
                value={nightEnd}
                onChange={(e) => setNightEnd(e.target.value)}
              />
            </label>
            <label>
              Скидка, %
              <input
                className="input"
                type="number"
                min={0}
                max={90}
                value={nightDiscount}
                onChange={(e) => setNightDiscount(e.target.value)}
              />
            </label>
          </div>
          <label className="pricing-night-check">
            <input
              type="checkbox"
              checked={nightActive}
              onChange={(e) => setNightActive(e.target.checked)}
            />
            Активен
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={savingNight}>
              {savingNight ? 'Сохранение…' : 'Сохранить ночь'}
            </button>
            {nightId ? (
              <button type="button" className="btn btn-ghost" onClick={removeNight}>
                Удалить правило
              </button>
            ) : null}
          </div>
          <p className="pricing-night-hint">
            Скидка применяется только к минутам в этом интервале (например 23:00–07:00).
          </p>
        </form>
      </section>

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
              placeholder="Пакет 4 ч"
              required
            />
          </label>
          <label>
            Бейдж в приложении
            <input
              className="input"
              value={pkgFields.badge}
              onChange={(e) => setPkgFields((f) => ({ ...f, badge: e.target.value }))}
              placeholder="−15%"
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
