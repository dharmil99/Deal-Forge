import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = '1600px',
  className = '',
  style,
}) => {
  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      className={`dealforge-page-container ${className}`}
    >
      <div
        style={{
          width: '100%',
          maxWidth: maxWidth || '100%',
          minWidth: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
};
