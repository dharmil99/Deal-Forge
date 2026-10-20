import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      icon,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: { height: '30px', padding: '0 12px', fontSize: 'var(--font-size-sm)' },
      md: { height: '36px', padding: '0 16px', fontSize: 'var(--font-size-base)' },
      lg: { height: '44px', padding: '0 24px', fontSize: 'var(--font-size-md)' },
    }[size];

    const variantStyles = {
      primary: {
        background: 'var(--accent)',
        color: '#FFFFFF',
        border: '1px solid transparent',
        hoverBg: 'var(--accent-hover)',
        hoverBorder: 'transparent',
      },
      secondary: {
        background: 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid var(--line-strong)',
        hoverBg: 'rgba(255, 255, 255, 0.04)',
        hoverBorder: 'var(--line-hover)',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--text-body)',
        border: '1px solid transparent',
        hoverBg: 'var(--bg-surface-2)',
        hoverBorder: 'transparent',
      },
      danger: {
        background: 'var(--negative)',
        color: '#FFFFFF',
        border: '1px solid transparent',
        hoverBg: '#DC2626',
        hoverBorder: 'transparent',
      },
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: fullWidth ? '100%' : 'auto',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-family)',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          transition: 'all var(--transition-fast)',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          boxSizing: 'border-box',
          ...sizeStyles,
          background: variantStyles.background,
          color: variantStyles.color,
          border: variantStyles.border,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = variantStyles.hoverBg;
            e.currentTarget.style.borderColor = variantStyles.hoverBorder;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = variantStyles.background;
            e.currentTarget.style.borderColor = variantStyles.border;
          }
        }}
        className={`dealforge-btn ${className}`}
        {...props}
      >
        {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
