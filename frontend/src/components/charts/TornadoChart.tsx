import React, { useState, useMemo } from 'react';
import { formatSignedPercent } from '@/utils/formatters';

export interface TornadoVariableDriver {
  key: string;
  label: string;
  downsideValue: string | number;
  upsideValue: string | number;
  downsideOutput: number; // e.g. Year 1 A/D %
  baseOutput: number;
  upsideOutput: number;
  isDownsideFeasible?: boolean;
  isUpsideFeasible?: boolean;
}

export interface TornadoChartProps {
  baseValue: number;
  drivers: TornadoVariableDriver[];
  unitLabel?: string;
  formatOutput?: (val: number) => string;
  height?: number;
  onDriverClick?: (driver: TornadoVariableDriver) => void;
}

export const TornadoChart: React.FC<TornadoChartProps> = ({
  baseValue,
  drivers,
  unitLabel = 'Year 1 A/D',
  formatOutput = (val) => formatSignedPercent(val, 2, false),
  height,
  onDriverClick,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Sort drivers by total impact swing descending (largest driver on top)
  const sortedDrivers = useMemo(() => {
    return [...drivers].sort((a, b) => {
      const spreadA = Math.abs(a.upsideOutput - a.downsideOutput);
      const spreadB = Math.abs(b.upsideOutput - b.downsideOutput);
      return spreadB - spreadA;
    });
  }, [drivers]);

  // Determine min and max scale bounds across all points
  const { minVal, maxVal } = useMemo(() => {
    let min = baseValue;
    let max = baseValue;
    drivers.forEach((d) => {
      min = Math.min(min, d.downsideOutput, d.upsideOutput);
      max = Math.max(max, d.downsideOutput, d.upsideOutput);
    });
    // Add 10% breathing room
    const padding = Math.max(Math.abs(max - min) * 0.12, 1.0);
    return {
      minVal: min - padding,
      maxVal: max + padding,
    };
  }, [baseValue, drivers]);

  const range = maxVal - minVal || 1;
  const getPercent = (val: number) => ((val - minVal) / range) * 100;
  const basePct = getPercent(baseValue);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top Scale Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)',
          padding: '0 4px',
        }}
      >
        <span>Drivers sorted by absolute {unitLabel} impact</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', background: 'var(--negative)', borderRadius: '2px' }} />
            Dilutive Impact
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', background: 'var(--positive)', borderRadius: '2px' }} />
            Accretive Impact
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '2px', height: '12px', background: 'var(--focus)' }} />
            Base Case ({formatOutput(baseValue)})
          </span>
        </div>
      </div>

      {/* Main Chart Graphic Canvas */}
      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: height || `${sortedDrivers.length * 48 + 40}px`,
        }}
      >
        {/* Base Case Vertical Reference Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(180px + (100% - 240px) * ${basePct / 100})`,
            width: '2px',
            background: 'var(--focus)',
            zIndex: 2,
            boxShadow: '0 0 4px rgba(59, 130, 246, 0.4)',
          }}
          title={`Base Case: ${formatOutput(baseValue)}`}
        >
          <div
            style={{
              position: 'absolute',
              top: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--focus)',
              borderRadius: 'var(--radius-xs)',
              padding: '1px 5px',
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--focus)',
              whiteSpace: 'nowrap',
            }}
          >
            BASE
          </div>
        </div>

        {/* Drivers List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
          {sortedDrivers.map((driver) => {
            const isHovered = hoveredKey === driver.key;
            const downPct = getPercent(driver.downsideOutput);
            const upPct = getPercent(driver.upsideOutput);
            const leftPct = Math.min(downPct, upPct);
            const rightPct = Math.max(downPct, upPct);
            const widthPct = Math.max(0.5, rightPct - leftPct);

            const spread = Math.abs(driver.upsideOutput - driver.downsideOutput);

            return (
              <div
                key={driver.key}
                onMouseEnter={() => setHoveredKey(driver.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onDriverClick?.(driver)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '32px',
                  cursor: onDriverClick ? 'pointer' : 'default',
                  background: isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  borderRadius: 'var(--radius-xs)',
                  padding: '2px 6px',
                  transition: 'background var(--transition-fast)',
                }}
              >
                {/* Left Label: Driver Name */}
                <div
                  style={{
                    width: '180px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isHovered ? 'var(--text-primary)' : 'var(--text-body)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {driver.label}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    Swing: ±{(spread / 2).toFixed(1)}%
                  </span>
                </div>

                {/* Right Bar Area */}
                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {/* Subtle track background */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '2px',
                    }}
                  />

                  {/* Horizontal Tornado Impact Bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '14px',
                      borderRadius: 'var(--radius-xs)',
                      background:
                        driver.upsideOutput >= baseValue && driver.downsideOutput <= baseValue
                          ? `linear-gradient(to right, var(--negative) ${
                              basePct > leftPct && widthPct > 0
                                ? ((basePct - leftPct) / widthPct) * 100
                                : 50
                            }%, var(--positive) 0%)`
                          : driver.upsideOutput < baseValue
                          ? 'var(--negative)'
                          : 'var(--positive)',
                      opacity: isHovered ? 1 : 0.85,
                      boxShadow: isHovered ? '0 0 8px rgba(255, 255, 255, 0.15)' : 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  />

                  {/* Left End Value Tag */}
                  <span
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPct}% - 6px)`,
                      transform: 'translateX(-100%)',
                      fontSize: '10px',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color:
                        driver.downsideOutput < baseValue
                          ? 'var(--negative)'
                          : 'var(--positive)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatOutput(Math.min(driver.downsideOutput, driver.upsideOutput))}
                  </span>

                  {/* Right End Value Tag */}
                  <span
                    style={{
                      position: 'absolute',
                      left: `calc(${rightPct}% + 6px)`,
                      fontSize: '10px',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color:
                        driver.upsideOutput >= baseValue
                          ? 'var(--positive)'
                          : 'var(--negative)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatOutput(Math.max(driver.downsideOutput, driver.upsideOutput))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Driver Inspection Details */}
      {hoveredKey && (
        (() => {
          const d = drivers.find((x) => x.key === hoveredKey);
          if (!d) return null;
          return (
            <div
              style={{
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
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Driver:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{d.label}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Downside Case:</span>
                  <span style={{ color: 'var(--text-body)' }}>{d.downsideValue} → </span>
                  <strong style={{ color: 'var(--negative)' }}>{formatOutput(d.downsideOutput)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Base Case:</span>
                  <strong style={{ color: 'var(--focus)' }}>{formatOutput(d.baseOutput)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Upside Case:</span>
                  <span style={{ color: 'var(--text-body)' }}>{d.upsideValue} → </span>
                  <strong style={{ color: 'var(--positive)' }}>{formatOutput(d.upsideOutput)}</strong>
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                Total Swing: ±{(Math.abs(d.upsideOutput - d.downsideOutput) / 2).toFixed(2)}%
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
