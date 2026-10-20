import React, { createContext, useContext, useState, useEffect } from 'react';

interface ShellContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = 'dealforge_sidebar_collapsed';

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [searchOpen, setSearchOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      // ignore storage errors
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => setSearchOpen(false);

  // Global keyboard shortcut: Ctrl+K / Cmd+K for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setCopilotOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ShellContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        searchOpen,
        setSearchOpen,
        openSearch,
        closeSearch,
        copilotOpen,
        setCopilotOpen,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
};

export function useShell(): ShellContextType {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
}

export const useShellContext = useShell;
