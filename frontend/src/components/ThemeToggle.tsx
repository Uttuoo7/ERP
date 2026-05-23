import React, { useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   ThemeToggle — Premium Dark/Light Mode Switch
   ─────────────────────────────────────────────────────────────────────────
   • Pill-shaped container with sliding indicator
   • Smooth sun/moon icon rotation + scale animation
   • Persists preference to localStorage
   • Auto-detects system preference on first load
   • Accessible: ARIA labels, keyboard support, focus-visible ring
   ═══════════════════════════════════════════════════════════════════════════ */

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'erp-theme-preference';

/** Detect OS-level color scheme preference */
function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Read persisted theme or fall back to system preference */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
}

/** Apply the data-theme attribute and color-scheme meta to the document */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // Also toggle .dark class for Tailwind compat
  root.classList.toggle('dark', theme === 'dark');
}

export interface ThemeToggleProps {
  /** Optional CSS className to merge onto the outer container */
  className?: string;
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { pill: 'h-8 w-[60px]', icon: 14, indicator: 'h-6 w-6', translate: 'translateX(30px)' },
  md: { pill: 'h-9 w-[68px]', icon: 16, indicator: 'h-7 w-7', translate: 'translateX(33px)' },
  lg: { pill: 'h-10 w-[76px]', icon: 18, indicator: 'h-8 w-8', translate: 'translateX(36px)' },
} as const;

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const isDark = theme === 'dark';
  const dims = sizeMap[size];

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen to OS-level theme changes (if no stored preference)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={`
        relative inline-flex items-center shrink-0 cursor-pointer rounded-full
        ${dims.pill}
        transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-400)]
        ${className}
      `}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-900))'
          : 'var(--surface-2)',
        border: `1px solid ${isDark ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        boxShadow: isDark ? 'var(--shadow-md), inset 0 1px 0 hsla(0,0%,100%,0.04)' : 'var(--shadow-xs)',
        transition: 'background var(--duration-normal) var(--ease-out-expo), border-color var(--duration-normal) var(--ease-out-expo), box-shadow var(--duration-normal) var(--ease-out-expo)',
      }}
    >
      {/* Sliding indicator */}
      <span
        aria-hidden="true"
        className={`
          pointer-events-none absolute left-[3px] flex items-center justify-center
          rounded-full ${dims.indicator}
        `}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, var(--color-primary-400), var(--color-accent-400))'
            : 'var(--surface-card)',
          boxShadow: isDark ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
          transform: isDark ? dims.translate : 'translateX(0)',
          transition: `transform var(--duration-normal) var(--ease-out-expo), background var(--duration-normal) var(--ease-out-expo), box-shadow var(--duration-normal) var(--ease-out-expo)`,
        }}
      >
        {/* Sun icon — visible when light mode */}
        <Sun
          size={dims.icon - 2}
          strokeWidth={2.5}
          style={{
            position: 'absolute',
            color: 'var(--color-warning-500)',
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(-90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
            transition: `opacity var(--duration-normal) var(--ease-out-expo), transform var(--duration-normal) var(--ease-out-expo)`,
          }}
        />
        {/* Moon icon — visible when dark mode */}
        <Moon
          size={dims.icon - 2}
          strokeWidth={2.5}
          style={{
            position: 'absolute',
            color: 'var(--text-inverted)',
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
            transition: `opacity var(--duration-normal) var(--ease-out-expo), transform var(--duration-normal) var(--ease-out-expo)`,
          }}
        />
      </span>

      {/* Background decorative icons (static, low opacity) */}
      <span
        aria-hidden="true"
        className="absolute flex items-center justify-center"
        style={{
          right: '6px',
          opacity: isDark ? 0 : 0.35,
          transition: `opacity var(--duration-normal) var(--ease-out-expo)`,
        }}
      >
        <Moon size={dims.icon - 4} strokeWidth={2} style={{ color: 'var(--text-tertiary)' }} />
      </span>
      <span
        aria-hidden="true"
        className="absolute flex items-center justify-center"
        style={{
          left: '6px',
          opacity: isDark ? 0.35 : 0,
          transition: `opacity var(--duration-normal) var(--ease-out-expo)`,
        }}
      >
        <Sun size={dims.icon - 4} strokeWidth={2} style={{ color: 'var(--text-tertiary)' }} />
      </span>
    </button>
  );
};

export default ThemeToggle;
