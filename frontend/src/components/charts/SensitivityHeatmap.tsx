import React, { useState } from 'react';
import { formatCurrencyCr, formatPercent } from '@/utils/formatters';
import { ChartStatusBadge } from './ChartStatusBadge';

export interface HeatmapCellData {
  output: number | boolean | null;
  is_feasible?: boolean;
  diagnostics?: string[];
  x_value?: number | null;
  y_value?: number | null;
}

export type HeatmapCellInput = number | null | HeatmapCellData;

export interface SensitivityHeatmapProps {
  rowVariable?: string;
  rowAxisTitle?: string;
  rowValues?: number[];
  rowLabels?: (string | number)[];
  colVariable?: string;
  colAxisTitle?: string;
  colValues?: number[];
  colLabels?: (string | number)[];
  matrix: HeatmapCellInput[][];
  baseRowIdx?: number;
  baseColIdx?: number;
  formatRow?: (val: number) => string;
  formatCol?: (val: number) => string;
  formatCell?: (val: number) => string;
  unitLabel?: string;
  colorMode?: 'sequential' | 'diverging';
  selectedCell?: { r: number; c: number } | null;
  onCellClick?: (cell: {
    r: number;
    c: number;
    rowLabel: string;
    colLabel: string;
    rowVal?: number;
    colVal?: number;
    output: number | null;
    isFeasible: boolean;
    diagnostics?: string[];
  }) => void;
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
  colorMode = 'sequential',
  selectedCell,
  onCellClick,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  const effectiveRowTitle = rowVariable || rowAxisTitle || 'WACC';
  const effectiveColTitle = colVariable || colAxisTitle || 'Terminal Growth (g)';

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

  // Extract cell value and feasibility safely
  const extractCell = (cellInput: HeatmapCellInput) => {
    if (cellInput === null || cellInput === undefined) {
      return { output: null, isFeasible: true, diagnostics: [] };
    }
    if (typeof cellInput === 'number') {
      return { output: cellInput, isFeasible: true, diagnostics: [] };
    }
    const out = typeof cellInput.output === 'number' ? cellInput.output : null;
    return {
      output: out,
      isFeasible: cellInput.is_feasible !== false,
      diagnostics: cellInput.diagnostics || [],
    };
  };

  // Find valid min/max for color scale
  const validValues: number[] = [];
  matrix.forEach((row) => {
    row.forEach((cellInput) => {
      const { output, isFeasible } = extractCell(cellInput);
      if (output !== null && isFeasible && !isNaN(output)) {
        validValues.push(output);
      }
    });
  });

  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1;
  const maxAbsVal = Math.max(Math.abs(minVal), Math.abs(maxVal)) || 1;
  const valRange = maxVal - minVal || 1;

  // Compute background color based on colorMode and feasibility
  const getCellBg = (output: number | null, isFeasible: boolean, isBase: boolean) => {
    if (!isFeasible) {
      return 'rgba(239, 68, 68, 0.12)'; // Infeasible / Cash deficit
    }
    if (output === null) {
      return 'rgba(255, 255, 255, 0.03)'; // Undefined / Unavailable
    }

    if (colorMode === 'diverging') {
      // Accretive / Dilutive color scale
      if (output > 0) {
        const intensity = Math.min(1, Math.max(0.18, (output / maxAbsVal) * 0.85));
        return `rgba(34, 197, 94, ${intensity})`; // Green for accretive
      } else if (output < 0) {
        const intensity = Math.min(1, Math.max(0.18, (Math.abs(output) / maxAbsVal) * 0.85));
        return `rgba(239, 68, 68, ${intensity})`; // Red for dilutive
      }
      return 'rgba(148, 163, 184, 0.15)'; // Neutral 0%
    }

    // Default sequential blue gradient
    if (isBase) return 'rgba(59, 130, 246, 0.45)';
    const ratio = Math.max(0, Math.min(1, (output - minVal) / valRange));
    return `rgba(37, 99, 235, ${0.15 + ratio * 0.55})`;
  };

  const activeHover = hoveredCell ? extractCell(matrix[hoveredCell.r]?.[hoveredCell.c]) : null;
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
                  width: '130px',
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
                    const rawCell = matrix[rIdx]?.[cIdx];
                    const { output, isFeasible, diagnostics } = extractCell(rawCell);
                    const isBaseCell = isBaseRow && cIdx === baseColIdx;
                    const isHovered = hoveredCell?.r === rIdx && hoveredCell?.c === cIdx;
                    const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                    const colLabel = getColLabel(cIdx);

                    return (
                      <td
                        key={cIdx}
                        onMouseEnter={() => setHoveredCell({ r: rIdx, c: cIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => {
                          onCellClick?.({
                            r: rIdx,
                            c: cIdx,
                            rowLabel,
                            colLabel,
                            rowVal: rowValues?.[rIdx],
                            colVal: colValues?.[cIdx],
                            output,
                            isFeasible,
                            diagnostics,
                          });
                        }}
                        style={{
                          textAlign: 'center',
                          padding: '8px 6px',
                          borderBottom: '1px solid var(--line)',
                          borderRight: '1px solid var(--line)',
                          background: getCellBg(output, isFeasible, isBaseCell),
                          color: !isFeasible
                            ? 'var(--negative)'
                            : output !== null
                            ? '#FFFFFF'
                            : 'var(--text-muted)',
                          fontWeight: isBaseCell || isSelected ? 700 : output !== null ? 500 : 400,
                          cursor: 'pointer',
                          position: 'relative',
                          outline: isSelected
                            ? '2px solid var(--accent-line)'
                            : isBaseCell
                            ? '2px solid #F59E0B'
                            : isHovered
                            ? '2px solid var(--focus)'
                            : !isFeasible
                            ? '1px dashed rgba(239, 68, 68, 0.5)'
                            : 'none',
                          outlineOffset: '-2px',
                          transition: 'outline var(--transition-fast)',
                        }}
                        title={
                          !isFeasible
                            ? `${effectiveRowTitle}: ${rowLabel} | ${effectiveColTitle}: ${colLabel} => INFEASIBLE (Cash Deficit)`
                            : output !== null
                            ? `${effectiveRowTitle}: ${rowLabel} | ${effectiveColTitle}: ${colLabel} => ${formatCell(output)} ${unitLabel}`
                            : 'Unavailable'
                        }
                      >
                        {!isFeasible ? (
                          <span style={{ fontSize: '10px', color: 'var(--negative)', fontWeight: 600 }}>
                            INFEASIBLE
                          </span>
                        ) : output !== null ? (
                          formatCell(output)
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Institutional Hover Tooltip Summary Card */}
        {hoveredCell && activeHover && (
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
                <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Output:</span>
                <strong
                  style={{
                    color: !activeHover.isFeasible
                      ? 'var(--negative)'
                      : activeHover.output !== null && activeHover.output >= 0
                      ? 'var(--positive)'
                      : 'var(--negative)',
                  }}
                >
                  {!activeHover.isFeasible
                    ? 'INFEASIBLE (Cash Deficit)'
                    : activeHover.output !== null
                    ? `${formatCell(activeHover.output)} ${unitLabel}`
                    : '—'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Status:</span>
                <ChartStatusBadge status={activeHover.isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
              </div>
            </div>
            <div style={{ color: hoveredIsBase ? '#F59E0B' : 'var(--text-label)', fontSize: '10px' }}>
              {hoveredIsBase ? '★ Base Case Model Parameters' : onCellClick ? 'Click to inspect in detail panel' : 'Sensitized Matrix Output'}
            </div>
          </div>
        )}

        {/* Footer Notes & Legend */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            {colorMode === 'diverging' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', background: 'var(--positive)', borderRadius: '2px' }} />
                  <span>Accretive (+)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', background: 'var(--negative)', borderRadius: '2px' }} />
                  <span>Dilutive (-)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', border: '1px dashed var(--negative)', borderRadius: '2px' }} />
                  <span>Infeasible</span>
                </div>
              </>
            )}
          </div>

          <div>Values in {unitLabel}</div>
        </div>
      </div>
    </div>
  );
};
