type Props = {
  colSpan: number;
  message?: string;
};

/** Пустая таблица — стандартная подпись по центру */
export function TableEmptyRow({
  colSpan,
  message = 'Данных пока нет',
}: Props) {
  return (
    <tr>
      <td colSpan={colSpan} className="table-empty">
        {message}
      </td>
    </tr>
  );
}
