import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  selectedRowKey?: string | number;
  emptyMessage?: string;
  maxHeight?: string | number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedRowKey,
  emptyMessage = 'No records found matching criteria.',
  maxHeight,
  className = '',
}: DataTableProps<T>) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        overflowY: maxHeight ? 'auto' : 'visible',
        maxHeight: maxHeight,
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)',
      }}
      className={`dealforge-table-container ${className}`}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: 'var(--font-size-base)',
          fontFamily: 'var(--font-family)',
        }}
      >
        <thead>
          <tr
            style={{
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              height: '32px',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  textAlign: col.align || 'left',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--font-size-base)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowKey = keyExtractor(row, index);
              const isSelected = selectedRowKey !== undefined && selectedRowKey === rowKey;

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(row, index)}
                  style={{
                    height: '34px',
                    borderBottom: '1px solid var(--line)',
                    background: isSelected ? 'var(--accent-wash)' : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {columns.map((col) => {
                    const value = col.render
                      ? col.render(row, index)
                      : (row as Record<string, unknown>)[col.key] != null
                      ? String((row as Record<string, unknown>)[col.key])
                      : '—';

                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '6px 12px',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-strong)',
                          textAlign: col.align || 'left',
                          fontVariantNumeric: col.align === 'right' ? 'tabular-nums' : 'normal',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
