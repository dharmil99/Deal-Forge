import React, { useState } from 'react';
import { formatCurrencyCr, formatPercent } from '@/utils/formatters';

export interface SensitivityHeatmapProps {
  rowVariable?: string;
  rowAxisTitle?: string;
  rowValues?: number[];
  rowLabels?: (string | number)[];
  colVariable?: string;
  colAxisTitle?: string;
  colValues?: number[];
  colLabels?: (string | number)[];
  matrix: (number | null)[][];
  baseRowIdx?: number;
  baseColIdx?: number;
  formatRow?: (val: number) => string;
  formatCol?: (val: number) => string;
  formatCell?: (val: number) => string;
  unitLabel?: string;
}

export const SensitivityHeatmap: React.FC<SensitivityHeatmapProps> = ({
  rowVariable,
  rowAxisTitle,
  rowValues,
  rowLabels,
  colVariable,
  colAxisTitle,
  colValues,
  colLabels,
  matrix,
  baseRowIdx,
  baseColIdx,
  formatRow = (v) => formatPercent(v),
  formatCol = (v) => formatPercent(v),
  formatCell = (v) => formatCurrencyCr(v, 0, false),
  unitLabel = '₹ Cr',
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  const effectiveRowTitle = rowVariable || rowAxisTitle || 'WACC';
  const effectiveColTitle = colVariable || colAxisTitle || 'Terminal Growth (g)';

  // Determine row count and column count safely
  const rowCount = Math.max(rowValues?.length || 0, rowLabels?.length || 0, matrix.length);
  const colCount = Math.max(colValues?.length || 0, colLabels?.length || 0, matrix[0]?.length || 0);

  const getRowLabel = (rIdx: number): string => {
    if (rowLabels && rowLabels[rIdx] != null) {
      return String(rowLabels[rIdx]);
    }
    if (rowValues && rowValues[rIdx] != null) {
      return formatRow(rowValues[rIdx]);
    }
    return `Row ${rIdx + 1}`;
  };

  const getColLabel = (cIdx: number): string => {
    if (colLabels && colLabels[cIdx] != null) {
      return String(colLabels[cIdx]);
    }
    if (colValues && colValues[cIdx] != null) {
      return formatCol(colValues[cIdx]);
    }
    return `Col ${cIdx + 1}`;
  };

  if (rowCount === 0 || colCount === 0 || matrix.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        Sensitivity matrix not available.
      </div>
    );
  }

  // Find valid min/max for color scale
  const validValues: number[] = [];
  matrix.forEach((row) => {
    row.forEach((val) => {
      if (val != null && typeof val === 'number' && !isNaN(val)) {
        validValues.push(val);
      }
    });
  });

  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1;
  const valRange = maxVal - minVal || 1;

  // Compute cell color intensity
  const getCellBg = (val: number | null, isBase: boolean) => {
    if (val == null) return 'rgba(239, 68, 68, 0.08)'; // Infeasible / undefined
    if (isBase) return 'rgba(59, 130, 246, 0.45)';
    const ratio = (val - minVal) / valRange; // 0..1
    // Range from deep blue to bright cyan-blue
    return `rgba(37, 99, 235, ${0.15 + ratio * 0.55})`;
  };

  const hoveredVal = hoveredCell ? matrix[hoveredCell.r]?.[hoveredCell.c] ?? null : null;
  const hoveredIsBase = hoveredCell ? hoveredCell.r === baseRowIdx && hoveredCell.c === baseColIdx : false;

  return (
    <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <div style={{ minWidth: '540px' }}>
        {/* Top Header: Column Variable */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            marginBottom: '8px',
          }}
        >
          {effectiveColTitle.toUpperCase()} →
        </div>

        {/* Heatmap Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  color: 'var(--text-label)',
                  fontWeight: 600,
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid var(--line)',
                  width: '120px',
                }}
              >
                {effectiveRowTitle.toUpperCase()} ↓
              </th>
              {Array.from({ length: colCount }, (_, cIdx) => {
                const isBaseCol = cIdx === baseColIdx;
                const colLabel = getColLabel(cIdx);
                return (
                  <th
                    key={cIdx}
                    style={{
                      textAlign: 'center',
                      padding: '6px 8px',
                      color: isBaseCol ? 'var(--focus)' : 'var(--text-muted)',
                      fontWeight: isBaseCol ? 700 : 500,
                      borderBottom: '1px solid var(--line)',
                      background: isBaseCol ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                  >
                    {colLabel}
                    {isBaseCol && <div style={{ fontSize: '9px', color: 'var(--focus)' }}>(Base)</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, rIdx) => {
              const isBaseRow = rIdx === baseRowIdx;
              const rowLabel = getRowLabel(rIdx);
              return (
                <tr key={rIdx}>
                  {/* Row Label */}
                  <td
                    style={{
                      padding: '8px 10px',
                      color: isBaseRow ? 'var(--focus)' : 'var(--text-strong)',
                      fontWeight: isBaseRow ? 700 : 500,
                      borderBottom: '1px solid var(--line)',
                      borderRight: '1px solid var(--line)',
                      background: isBaseRow ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                  >
                    {rowLabel}
                    {isBaseRow && <span style={{ fontSize: '9px', color: 'var(--focus)', marginLeft: '4px' }}>(Base)</span>}
                  </td>

                  {/* Matrix Cells */}
                  {Array.from({ length: colCount }, (_, cIdx) => {
                    const cellVal = matrix[rIdx]?.[cIdx] ?? null;
                    const isBaseCell = isBaseRow && cIdx === baseColIdx;
                    const isHovered = hoveredCell?.r === rIdx && hoveredCell?.c === cIdx;
                    const colLabel = getColLabel(cIdx);

                    return (
                      <td
                        key={cIdx}
                        onMouseEnter={() => setHoveredCell({ r: rIdx, c: cIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          textAlign: 'center',
                          padding: '8px 6px',
                          borderBottom: '1px solid var(--line)',
                          borderRight: '1px solid var(--line)',
                          background: getCellBg(cellVal, isBaseCell),
                          color: cellVal != null ? '#FFFFFF' : 'var(--text-muted)',
                          fontWeight: isBaseCell ? 700 : cellVal != null ? 500 : 400,
                          cursor: 'pointer',
                          position: 'relative',
                          outline: isBaseCell ? '2px solid #F59E0B' : isHovered ? '2px solid var(--accent-line)' : 'none',
                          outlineOffset: '-2px',
                          transition: 'outline var(--transition-fast)',
                        }}
                        title={
                          cellVal != null
                            ? `${effectiveRowTitle}: ${rowLabel} | ${effectiveColTitle}: ${colLabel} => ${formatCell(cellVal)} ${unitLabel}`
                            : 'Undefined / Infeasible'
                        }
                      >
                        {cellVal != null ? formatCell(cellVal) : 'N/A'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Institutional Hover Tooltip Summary Card */}
        {hoveredCell && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{effectiveRowTitle}:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{getRowLabel(hoveredCell.r)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{effectiveColTitle}:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{getColLabel(hoveredCell.c)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Implied Equity Value:</span>
                <strong style={{ color: 'var(--positive)' }}>
                  {hoveredVal != null ? `${formatCell(hoveredVal)} ${unitLabel}` : 'N/A'}
                </strong>
              </div>
            </div>
            <div style={{ color: hoveredIsBase ? '#F59E0B' : 'var(--text-label)', fontSize: '10px' }}>
              {hoveredIsBase ? '★ Base Case Model Parameters' : 'Sensitized DCF Output'}
            </div>
          </div>
        )}

        {/* Footer Notes */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            padding: '0 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                border: '2px solid #F59E0B',
                display: 'inline-block',
              }}
            />
            <span>Base Case Parameters</span>
          </div>

          <div>Values in {unitLabel} (Implied Equity Value)</div>
        </div>
      </div>
    </div>
  );
};
