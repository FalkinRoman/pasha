import { FormEvent, useEffect, useState } from 'react';
import { TableEmptyRow } from '../components/TableEmptyRow';
import { ZoneRow, fetchZones, updateZone } from '../api/admin';

export function ZonesPage() {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [name, setName] = useState('');
  const [specs, setSpecs] = useState('');
  const [price, setPrice] = useState('');

  const load = () => fetchZones().then(setZones);

  useEffect(() => {
    load();
  }, []);

  const openEdit = (z: ZoneRow) => {
    setEditing(z);
    setName(z.name);
    setSpecs(z.specs);
    setPrice(String(z.pricePerHour));
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updateZone(editing.id, {
      name: name.trim(),
      specs: specs.trim(),
      pricePerHour: Number(price),
    });
    setEditing(null);
    load();
  };

  return (
    <>
      <h1 className="page-title">Зоны</h1>
      <div className="card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Название</th>
              <th>Железо</th>
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
                <td>{z.specs}</td>
                <td>{z.pricePerHour}</td>
                <td>{z.seatsCount}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(z)}>
                    Изменить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <form className="card" style={{ marginTop: 16 }} onSubmit={onSave}>
          <h3>Редактировать: {editing.slug}</h3>
          <label>
            Название
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Железо
            <input className="input" value={specs} onChange={(e) => setSpecs(e.target.value)} />
          </label>
          <label>
            Цена за час (₽)
            <input
              className="input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </>
  );
}
