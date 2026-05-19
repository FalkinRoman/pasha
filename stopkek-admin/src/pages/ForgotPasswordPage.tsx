import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/admin';
import { ApiError } from '../api/client';
import { StopLogo } from '../components/StopLogo';
import './LoginPage.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
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
        <h1 className="login-title">Восстановление пароля</h1>
        <p className="muted">Отправим ссылку на email</p>
        <label>
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Введите email"
            autoComplete="email"
            required
          />
        </label>
        {message && <p className="login-success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Отправка…' : 'Отправить ссылку'}
        </button>
        <Link to="/login" className="login-link">
          ← Назад ко входу
        </Link>
      </form>
    </div>
  );
}
