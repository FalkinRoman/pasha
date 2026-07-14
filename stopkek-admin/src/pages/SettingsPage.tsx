import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ClubSettings,
  clubImageSrc,
  fetchClubSettings,
  updateClubSettings,
  uploadClubImage,
} from '../api/admin';
import { ClubLocksSettings } from '../components/ClubLocksSettings';
import { ClubPaymentSettings } from '../components/ClubPaymentSettings';
import { TestNotifications } from '../components/TestNotifications';

export function SettingsPage() {
  const [club, setClub] = useState<ClubSettings | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [rating, setRating] = useState('5');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportTelegram, setSupportTelegram] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [inn, setInn] = useState('');
  const [ogrnip, setOgrnip] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetchClubSettings()
      .then((c) => {
        setClub(c);
        setName(c.name);
        setAddress(c.address);
        setHours(c.hours);
        setRating(String(c.rating));
        setSupportPhone(c.supportPhone ?? '');
        setSupportTelegram(c.supportTelegram ?? '');
        setSupportEmail(c.supportEmail ?? '');
        setOperatorName(c.operatorName ?? '');
        setInn(c.inn ?? '');
        setOgrnip(c.ogrnip ?? '');
        setLegalAddress(c.legalAddress ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateClubSettings({
        name: name.trim(),
        address: address.trim(),
        hours: hours.trim(),
        rating: Number(rating),
        supportPhone: supportPhone.trim(),
        supportTelegram: supportTelegram.trim(),
        supportEmail: supportEmail.trim(),
        operatorName: operatorName.trim(),
        inn: inn.trim(),
        ogrnip: ogrnip.trim(),
        legalAddress: legalAddress.trim(),
      });
      setClub(updated);
      setMessage('Сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не сохранено');
    } finally {
      setSaving(false);
    }
  };

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const updated = await uploadClubImage(file);
      setClub(updated);
      setMessage('Фото обновлено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не загружено');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const preview = club ? clubImageSrc(club.imageUrl) : null;

  return (
    <>
      <h1 className="page-title">Настройки клуба</h1>
      <p className="muted page-subtitle">
        Адрес, контакты и реквизиты — в приложении и на сайте stopkek.site
      </p>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="settings-stack">
          <div className="card settings-photo-card">
            <h3>Фото клуба</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Показывается на экране «О клубе» в приложении
            </p>
            {preview ? (
              <img src={preview} alt="Клуб" className="settings-club-photo" />
            ) : (
              <div className="settings-club-photo placeholder">Фото не загружено</div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => onImage(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 12 }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Загрузка…' : preview ? 'Заменить фото' : 'Загрузить фото'}
            </button>
          </div>

          <form className="card card-form" onSubmit={onSave}>
            <h3>Информация</h3>
            <label>
              Название
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Адрес
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ул. Примерная, 1"
              />
            </label>
            <label>
              Часы работы
              <input
                className="input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="круглосуточно / 10:00–02:00"
              />
            </label>
            <label>
              Рейтинг (0–5)
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </label>

            <h3>Поддержка</h3>
            <p className="muted form-hint">
              Телефон, Telegram и почта — в приложении на экране «Поддержка» и при входе
            </p>
            <label>
              Телефон
              <input
                className="input"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
              />
            </label>
            <label>
              Telegram
              <input
                className="input"
                value={supportTelegram}
                onChange={(e) => setSupportTelegram(e.target.value)}
                placeholder="@stopkek или https://t.me/stopkek"
              />
            </label>
            <label>
              Email
              <input
                className="input"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@stopkek.ru"
              />
            </label>

            <h3>Сайт stopkek.site</h3>
            <p className="muted form-hint">
              Реквизиты ИП и контакты в футере на главной, /support, /privacy, /terms, /offer
            </p>
            <label>
              Оператор (ИП / юр. лицо)
              <input
                className="input"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="ИП Иванов Иван Иванович"
              />
            </label>
            <label>
              ИНН
              <input
                className="input"
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                placeholder="774395265597"
              />
            </label>
            <label>
              ОГРНИП / ОГРН
              <input
                className="input"
                value={ogrnip}
                onChange={(e) => setOgrnip(e.target.value)}
                placeholder="321774600480472"
              />
            </label>
            <label>
              Юридический адрес
              <input
                className="input"
                value={legalAddress}
                onChange={(e) => setLegalAddress(e.target.value)}
                placeholder="125183, г. Москва, ул. …"
              />
            </label>

            <div className="form-footer">
              {error ? <p className="error">{error}</p> : null}
              {message ? <p className="muted">{message}</p> : null}
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>

          <ClubPaymentSettings />
          <ClubLocksSettings />
          <TestNotifications />
        </div>
      )}
    </>
  );
}
