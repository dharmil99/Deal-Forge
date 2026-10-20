import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className = '', id, disabled, style, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', ...style }}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: 'var(--text-label)',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 30px 0 10px',
              background: 'var(--bg-surface)',
              border: `1px solid ${error ? 'var(--negative)' : 'var(--line-strong)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-strong)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              appearance: 'none',
              opacity: disabled ? 0.5 : 1,
            }}
            className={`dealforge-select ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {error ? (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--negative)' }}>
            {error}
          </span>
        ) : helperText ? (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
