import { useEffect, useState } from 'react';
import { TransactionRow, fetchTransactions } from '../api/admin';
import { TableEmptyRow } from '../components/TableEmptyRow';
import { TX_TYPE } from '../lib/statusLabels';

export function TransactionsPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);

  useEffect(() => {
    fetchTransactions().then(setRows);
  }, []);

  return (
    <>
      <h1 className="page-title">Транзакции</h1>
      <div className="card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Тип</th>
              <th>Сумма</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <TableEmptyRow colSpan={5} />}
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.createdAt).toLocaleString('ru-RU')}</td>
                <td>{t.userPhone}</td>
                <td>{TX_TYPE[t.type] ?? t.type}</td>
                <td className={t.amountRub >= 0 ? 'amount-plus' : 'amount-minus'}>
                  {t.amountRub >= 0 ? '+' : ''}
                  {t.amountRub} ₽
                </td>
                <td className="muted">{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
