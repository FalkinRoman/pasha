import { FormEvent, useEffect, useState } from 'react';
import {
  fetchClubPayments,
  updateClubPayments,
} from '../api/admin';

export function ClubPaymentSettings() {
  const [yookassaEnabled, setYookassaEnabled] = useState(true);
  const [mockTopupEnabled, setMockTopupEnabled] = useState(false);
  const [yookassaConfigured, setYookassaConfigured] = useState(false);
  const [effectiveYookassa, setEffectiveYookassa] = useState(false);
  const [effectiveMock, setEffectiveMock] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetchClubPayments().then((c) => {
      setYookassaEnabled(c.yookassaEnabled);
      setMockTopupEnabled(c.mockTopupEnabled);
      setYookassaConfigured(c.yookassaConfigured);
      setEffectiveYookassa(c.effectiveYookassaEnabled);
      setEffectiveMock(c.effectiveMockTopupEnabled);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const updated = await updateClubPayments({
        yookassaEnabled,
        mockTopupEnabled,
      });
      setYookassaConfigured(updated.yookassaConfigured);
      setEffectiveYookassa(updated.effectiveYookassaEnabled);
      setEffectiveMock(updated.effectiveMockTopupEnabled);
      setMessage('Сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <form className="card card-form" onSubmit={onSave}>
      <h3>Оплата в приложении</h3>
      <p className="muted form-hint">
        Пополнение баланса в приложении. Бронь оплачивается только с баланса.
      </p>

      {!yookassaConfigured ? (
        <p className="error" style={{ fontSize: 13 }}>
          ЮKassa не настроена на сервере (нет YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY в .env).
          Реальная оплата картой недоступна, пока ключи не добавлены.
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>
          Ключи ЮKassa на сервере: <strong>настроены</strong>
        </p>
      )}

      <label className="toggle-row">
        <span>
          <strong>ЮKassa</strong> — оплата картой / СБП
          {effectiveYookassa ? (
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              Сейчас активно в приложении
            </span>
          ) : null}
        </span>
        <input
          type="checkbox"
          checked={yookassaEnabled}
          onChange={(e) => setYookassaEnabled(e.target.checked)}
        />
      </label>

      <label className="toggle-row">
        <span>
          <strong>Тестовое пополнение</strong> — без списания с карты
          {effectiveMock ? (
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              Сейчас активно в приложении
            </span>
          ) : null}
        </span>
        <input
          type="checkbox"
          checked={mockTopupEnabled}
          onChange={(e) => setMockTopupEnabled(e.target.checked)}
        />
      </label>

      <p className="muted form-hint">
        Для тестов: выключите ЮKassa, включите тестовое пополнение.
        Для продакшена: включите ЮKassa, выключите тест.
        Webhook: <code>https://stopkek.site/api/payments/yookassa/webhook</code>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}
      <button type="submit" className="btn">
        Сохранить оплату
      </button>
    </form>
  );
}
