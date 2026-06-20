import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 30000; // 30 секунд

export function StaffQuitModal({ open, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError('');
      setAttempts(0);
      setIsLocked(false);
      setLockoutTime(0);
    }
  }, [open]);

  useEffect(() => {
    if (!isLocked || lockoutTime <= 0) return;

    const timer = setInterval(() => {
      setLockoutTime((t) => {
        if (t <= 1000) {
          setIsLocked(false);
          setError('');
          return 0;
        }
        return t - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockoutTime]);

  if (!open) return null;

  const dismiss = () => {
    window.stopkekKiosk?.dismissStaffQuit();
    onClose();
  };

  const submit = async () => {
    if (isLocked) {
      const seconds = Math.ceil(lockoutTime / 1000);
      setError(`Попыток исчерпано. Повторите через ${seconds} сек`);
      return;
    }

    setError('');
    const ok = await window.stopkekKiosk?.verifyStaffPassword(password);
    if (ok) {
      window.stopkekKiosk?.confirmStaffQuit();
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      setIsLocked(true);
      setLockoutTime(LOCKOUT_TIME);
      setPassword('');
      setError(`❌ Неверный пароль. Доступ заблокирован на 30 секунд (${MAX_ATTEMPTS}/${MAX_ATTEMPTS} попыток)`);
      return;
    }

    const remaining = MAX_ATTEMPTS - newAttempts;
    setPassword('');
    setError(`❌ Неверный пароль (осталось ${remaining} ${remaining === 1 ? 'попытка' : 'попыток'})`);
  };

  return (
    <div className="staff-modal-backdrop" onClick={dismiss}>
      <div
        className="staff-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Выход для персонала"
      >
        <h3>Выход для персонала</h3>
        <p>Пароль администратора клуба</p>
        <input
          type="password"
          className="staff-modal-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') dismiss();
          }}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <div className="staff-modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void submit()}
            disabled={isLocked}
          >
            {isLocked
              ? `Заблокирована ${Math.ceil(lockoutTime / 1000)}s`
              : 'Выйти из программы'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={dismiss}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
