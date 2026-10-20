import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface DataQualityBadgeProps {
  label: string;
  tone?: 'warning' | 'info' | 'positive' | 'neutral';
  tooltip?: string;
  className?: string;
}

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
  label,
  tone = 'info',
  tooltip,
  className = '',
}) => {
  let bg = 'rgba(100, 116, 139, 0.12)';
  let border = 'var(--line-strong)';
  let color = 'var(--text-body)';
  let Icon = Info;

  if (tone === 'warning') {
    bg = 'var(--warning-bg)';
    border = 'rgba(245, 158, 11, 0.35)';
    color = 'var(--warning)';
    Icon = AlertTriangle;
  } else if (tone === 'positive') {
    bg = 'var(--positive-bg)';
    border = 'rgba(34, 197, 94, 0.35)';
    color = 'var(--positive)';
    Icon = CheckCircle2;
  } else if (tone === 'info') {
    bg = 'rgba(37, 99, 235, 0.12)';
    border = 'rgba(59, 130, 246, 0.35)';
    color = 'var(--focus)';
    Icon = Info;
  }

  return (
    <span
      className={`dealforge-quality-badge ${className}`}
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: 'var(--radius-xs)',
        background: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.2,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </span>
  );
};
