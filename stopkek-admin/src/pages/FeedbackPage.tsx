import { useEffect, useState } from 'react';
import { FeedbackRow, fetchFeedback } from '../api/admin';

export function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);

  useEffect(() => {
    fetchFeedback().then(setRows);
  }, []);

  return (
    <>
      <h1 className="page-title">Обратная связь</h1>
      <div className="card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Оценка</th>
              <th>Сообщение</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{new Date(f.createdAt).toLocaleString('ru-RU')}</td>
                <td>
                  {f.userName}
                  <br />
                  <span className="muted">{f.userPhone}</span>
                </td>
                <td>★{f.rating}</td>
                <td>{f.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
