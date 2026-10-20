import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  fullWidth = false,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const show = () => {
    const id = window.setTimeout(() => setVisible(true), delay);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setVisible(false);
  };

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '6px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '6px' },
  }[position];

  return (
    <div
      style={{
        position: 'relative',
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && content && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10000,
            padding: '4px 8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-strong)',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-popover)',
            pointerEvents: 'none',
            fontFamily: 'var(--font-family)',
            ...positionStyles,
          }}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
