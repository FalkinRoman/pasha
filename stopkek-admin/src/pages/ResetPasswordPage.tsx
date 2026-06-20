import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/admin';
import { ApiError } from '../api/client';
import { PasswordInput } from '../components/PasswordInput';
import { StopLogo } from '../components/StopLogo';
import './LoginPage.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setError('Минимум 8 символов');
      return;
    }
    if (!token) {
      setError('Нет токена в ссылке');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card card" onSubmit={onSubmit}>
        <StopLogo size={72} />
        <p className="brand-wordmark">стопкек</p>
        <h1 className="login-title">Новый пароль</h1>
        {!token && <p className="error">Ссылка повреждена — запросите сброс снова</p>}
        <label>
          Новый пароль
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Новый пароль"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Повторите пароль
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Ещё раз"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {message && (
          <p className="login-success">
            {message}{' '}
            <Link to="/login" className="login-link">
              Войти
            </Link>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading || !token || !!message}>
          {loading ? 'Сохранение…' : 'Сохранить пароль'}
        </button>
        <Link to="/forgot-password" className="login-link">
          Запросить ссылку снова
        </Link>
      </form>
    </div>
  );
}
