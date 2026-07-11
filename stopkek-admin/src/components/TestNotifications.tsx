import { useEffect, useState } from 'react';
import {
  SeatRow,
  TestPushResult,
  fetchSeats,
  sendTestNotice,
  sendTestPush,
} from '../api/admin';

/**
 * Dev/support tools: fire a test toast at a specific club PC, and a test push at
 * a user (by phone). The push result shows Expo tickets/receipts so the reason a
 * push does or doesn't arrive is visible right here.
 */
export function TestNotifications() {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [seatNumber, setSeatNumber] = useState<number | ''>('');
  const [noticeText, setNoticeText] = useState('Тестовое уведомление');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeErr, setNoticeErr] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [pushTitle, setPushTitle] = useState('Тест уведомления');
  const [pushBody, setPushBody] = useState('Проверка пуш-уведомлений стопкек');
  const [pushErr, setPushErr] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<TestPushResult | null>(null);

  useEffect(() => {
    fetchSeats()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => a.number - b.number);
        setSeats(sorted);
        if (sorted.length) setSeatNumber(sorted[0].number);
      })
      .catch(() => {});
  }, []);

  const onSendNotice = async () => {
    if (seatNumber === '' || !noticeText.trim()) return;
    setNoticeBusy(true);
    setNoticeErr('');
    setNoticeMsg('');
    try {
      const r = await sendTestNotice(Number(seatNumber), noticeText.trim());
      setNoticeMsg(`Отправлено на ПК #${r.seatNumber} — появится при следующем опросе (несколько секунд)`);
    } catch (e) {
      setNoticeErr(e instanceof Error ? e.message : 'Не отправлено');
    } finally {
      setNoticeBusy(false);
    }
  };

  const onSendPush = async () => {
    if (!phone.trim()) return;
    setPushBusy(true);
    setPushErr('');
    setPushResult(null);
    try {
      const r = await sendTestPush(phone.trim(), pushTitle.trim(), pushBody.trim());
      setPushResult(r);
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : 'Не отправлено');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="card card-form">
      <h3>Тест-уведомления</h3>
      <p className="muted form-hint">
        Отладочные инструменты: тост на конкретный ПК и пуш пользователю по номеру
      </p>

      <h4 style={{ marginBottom: 8 }}>Тост на ПК</h4>
      <label>
        ПК (место)
        <select
          className="input"
          value={seatNumber}
          onChange={(e) => setSeatNumber(e.target.value === '' ? '' : Number(e.target.value))}
        >
          {seats.map((s) => (
            <option key={s.id} value={s.number}>
              #{s.number} · {s.zoneName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Текст
        <input
          className="input"
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
          maxLength={200}
        />
      </label>
      <div className="form-footer">
        {noticeErr ? <p className="error">{noticeErr}</p> : null}
        {noticeMsg ? <p className="muted">{noticeMsg}</p> : null}
        <button
          type="button"
          className="btn"
          disabled={noticeBusy || seatNumber === '' || !noticeText.trim()}
          onClick={onSendNotice}
        >
          {noticeBusy ? 'Отправка…' : 'Отправить на ПК'}
        </button>
      </div>

      <h4 style={{ margin: '16px 0 8px' }}>Пуш по номеру телефона</h4>
      <label>
        Телефон
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 900 000-00-00"
        />
      </label>
      <label>
        Заголовок
        <input className="input" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
      </label>
      <label>
        Текст
        <input className="input" value={pushBody} onChange={(e) => setPushBody(e.target.value)} />
      </label>
      <div className="form-footer">
        {pushErr ? <p className="error">{pushErr}</p> : null}
        <button
          type="button"
          className="btn"
          disabled={pushBusy || !phone.trim()}
          onClick={onSendPush}
        >
          {pushBusy ? 'Отправка…' : 'Отправить пуш'}
        </button>
      </div>

      {pushResult ? (
        <div className="card" style={{ marginTop: 12, fontSize: 13 }}>
          <p>
            <b>{pushResult.user.name || 'Без имени'}</b> · {pushResult.user.phone}
          </p>
          <p className={pushResult.ok ? 'muted' : 'error'}>
            {pushResult.ok
              ? `Отправлено (${pushResult.reason}), токенов: ${pushResult.tokenCount}`
              : pushResult.reason === 'no_tokens'
                ? 'У пользователя нет зарегистрированных пуш-токенов (приложение не получило токен) — см. диагностику'
                : `Отклонено (${pushResult.reason}), токенов: ${pushResult.tokenCount}`}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            tickets: {JSON.stringify(pushResult.tickets, null, 1)}
            {'\n'}receipts: {JSON.stringify(pushResult.receipts, null, 1)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
