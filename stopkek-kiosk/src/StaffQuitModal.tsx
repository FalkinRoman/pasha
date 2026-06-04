import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function StaffQuitModal({ open, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    setError('');
    const ok = await window.stopkekKiosk?.verifyStaffPassword(password);
    if (ok) {
      window.stopkekKiosk?.confirmStaffQuit();
      return;
    }
    setError('Неверный пароль');
  };

  return (
    <div className="staff-modal-backdrop" onClick={onClose}>
      <div
        className="staff-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Выход для персонала"
      >
        <h3>Выход для персонала</h3>
        <p>Пароль администратора клуба</p>
        <input
          type="password"
          className="staff-modal-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <div className="staff-modal-actions">
          <button type="button" className="btn" onClick={() => void submit()}>
            Выйти из программы
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
