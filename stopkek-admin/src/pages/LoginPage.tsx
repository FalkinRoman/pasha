import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { PasswordInput } from '../components/PasswordInput';
import { StopLogo } from '../components/StopLogo';
import './LoginPage.css';

export function LoginPage() {
  const { admin, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card card" onSubmit={onSubmit}>
        <StopLogo size={72} />
        <p className="brand-wordmark">стопкек</p>
        <p className="muted login-subtitle">Вход для управления клубом</p>
        <label>
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Введите email"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Пароль
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Введите пароль"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </button>
        <Link to="/forgot-password" className="login-link">
          Забыли пароль?
        </Link>
      </form>
    </div>
  );
}
