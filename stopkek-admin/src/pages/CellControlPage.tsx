import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AcceptanceReportRow,
  LockerLogRow,
  fetchAcceptanceReports,
  fetchCellControl,
  lockerLogPhotoPath,
  resolveAcceptanceReport,
} from '../api/admin';
import { API_URL, getToken } from '../api/client';
import { TableEmptyRow } from '../components/TableEmptyRow';
import './CellControlPage.css';

type Tab = 'journal' | 'issues';
type EventType = LockerLogRow['type'] | 'all';

const TYPE_LABEL: Record<string, string> = {
  lock_open_main: 'Дверь',
  lock_open_cell: 'Открытие',
  acceptance: 'Приёмка',
  checkout: 'Сдача',
};

const TYPE_BADGE: Record<string, string> = {
  lock_open_main: 'cell-badge--main',
  lock_open_cell: 'cell-badge--cell',
  acceptance: 'cell-badge--acceptance',
  checkout: 'cell-badge--checkout',
};

const TYPE_CHIPS: { id: EventType; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'acceptance', label: 'Приёмка' },
  { id: 'checkout', label: 'Сдача' },
  { id: 'lock_open_cell', label: 'Открытия' },
  { id: 'lock_open_main', label: 'Дверь' },
];

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function missingItems(items: Record<string, boolean>) {
  return Object.entries(items)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
}

async function fetchPhotoBlob(logId: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${lockerLogPhotoPath(logId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.blob();
}

export function CellControlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'issues' ? 'issues' : 'journal';

  const [rows, setRows] = useState<LockerLogRow[]>([]);
  const [issues, setIssues] = useState<AcceptanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [seatFilter, setSeatFilter] = useState('');
  const [cellFilter, setCellFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType>('all');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const blobUrls = useRef<string[]>([]);

  const rememberBlob = (url: string) => {
    blobUrls.current.push(url);
    return url;
  };

  const setTab = (t: Tab) => {
    setSearchParams(t === 'issues' ? { tab: 'issues' } : {});
  };

  const loadJournal = useCallback(() => {
    setLoading(true);
    const seatNumber = seatFilter.trim()
      ? Number(seatFilter.trim())
      : undefined;
    const cellLock = cellFilter.trim() || undefined;
    fetchCellControl({
      seatNumber: Number.isFinite(seatNumber) ? seatNumber : undefined,
      cellLock,
      limit: 150,
    })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [seatFilter, cellFilter]);

  const loadIssues = useCallback(() => {
    setIssuesLoading(true);
    fetchAcceptanceReports(false)
      .then(setIssues)
      .finally(() => setIssuesLoading(false));
  }, []);

  const loadAll = useCallback(() => {
    loadJournal();
    loadIssues();
  }, [loadJournal, loadIssues]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  const openPhoto = async (logId: string) => {
    if (thumbs[logId]) {
      setLightbox(thumbs[logId]);
      return;
    }
    const blob = await fetchPhotoBlob(logId);
    if (!blob) return;
    const url = rememberBlob(URL.createObjectURL(blob));
    setThumbs((prev) => ({ ...prev, [logId]: url }));
    setLightbox(url);
  };

  const resolveIssue = (id: string) => {
    resolveAcceptanceReport(id).then(loadAll);
  };

  return (
    <div className="cell-page-full">
      <h1 className="page-title">Ячейки</h1>
      <p className="muted page-subtitle">Журнал событий и заявки приёмки</p>

      <div className="cell-tabs">
        <button
          type="button"
          className={`cell-tab ${tab === 'journal' ? 'active' : ''}`}
          onClick={() => setTab('journal')}
        >
          Журнал
        </button>
        <button
          type="button"
          className={`cell-tab ${tab === 'issues' ? 'active' : ''}`}
          onClick={() => setTab('issues')}
        >
          Заявки приёмки
          {issues.length > 0 ? (
            <span className="cell-tab-badge">{issues.length}</span>
          ) : null}
        </button>
      </div>

      {tab === 'issues' ? (
        <div className="card cell-table-card">
          <div className="table-wrap">
            <table className="table cell-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Место</th>
                  <th>Клиент</th>
                  <th>Не хватает</th>
                  <th>Комментарий</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {issuesLoading ? (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      Загрузка…
                    </td>
                  </tr>
                ) : (
                  <>
                    {issues.length === 0 && <TableEmptyRow colSpan={6} />}
                    {issues.map((r) => {
                      const missing = missingItems(r.items);
                      return (
                        <tr key={r.id}>
                          <td className="col-time">
                            {fmtShort(r.createdAt)}
                          </td>
                          <td>#{r.seatNumber}</td>
                          <td className="col-client">
                            {r.userName}
                            <span className="phone">{r.userPhone}</span>
                          </td>
                          <td>
                            <span className="cell-issues-missing">
                              {missing.length
                                ? missing.join(', ')
                                : '—'}
                            </span>
                          </td>
                          <td className="muted">{r.comment || '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => resolveIssue(r.id)}
                            >
                              Решено
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="cell-toolbar">
            <input
              className="input"
              type="number"
              min={1}
              placeholder="Место №"
              value={seatFilter}
              onChange={(e) => setSeatFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadJournal()}
            />
            <input
              className="input"
              placeholder="cell-7"
              value={cellFilter}
              onChange={(e) => setCellFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadJournal()}
            />
            <button type="button" className="btn btn-sm" onClick={loadJournal}>
              Найти
            </button>
            <div className="cell-toolbar-chips">
              {TYPE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cell-chip ${typeFilter === c.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card cell-table-card">
            <div className="table-wrap">
              <table className="table cell-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Событие</th>
                    <th>Место</th>
                    <th>Ячейка</th>
                    <th>Клиент</th>
                    <th>Фото</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        Загрузка…
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filtered.length === 0 && <TableEmptyRow colSpan={6} />}
                      {filtered.map((r) => (
                        <tr key={r.id}>
                          <td className="col-time">{fmtShort(r.createdAt)}</td>
                          <td>
                            <span
                              className={`cell-badge ${TYPE_BADGE[r.type] ?? 'cell-badge--cell'}`}
                            >
                              {TYPE_LABEL[r.type] ?? r.type}
                            </span>
                          </td>
                          <td>#{r.seatNumber}</td>
                          <td>
                            <span className="cell-lock">{r.cellLock}</span>
                          </td>
                          <td className="col-client">
                            {r.userName}
                            <span className="phone">{r.userPhone}</span>
                          </td>
                          <td>
                            {r.hasPhoto ? (
                              <button
                                type="button"
                                className="cell-photo-link"
                                title="Открыть фото"
                                onClick={() => openPhoto(r.id)}
                              >
                                {thumbs[r.id] ? (
                                  <img src={thumbs[r.id]} alt="" />
                                ) : (
                                  <span>Фото</span>
                                )}
                              </button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {lightbox && (
        <div
          className="cell-lightbox"
          role="dialog"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="cell-lightbox-close"
            aria-label="Закрыть"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
