import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      prefixElement,
      suffixElement,
      className = '',
      id,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', ...style }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: 'var(--text-label)',
            }}
          >
            {label}
          </label>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            width: '100%',
            height: '34px',
            background: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--negative)' : 'var(--line-strong)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '0 10px',
            transition: 'border-color var(--transition-fast)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {prefixElement && (
            <span
              style={{
                marginRight: '8px',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {prefixElement}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-strong)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              fontVariantNumeric: 'tabular-nums',
            }}
            className={`dealforge-input ${className}`}
            {...props}
          />
          {suffixElement && (
            <span
              style={{
                marginLeft: '8px',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {suffixElement}
            </span>
          )}
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

Input.displayName = 'Input';
