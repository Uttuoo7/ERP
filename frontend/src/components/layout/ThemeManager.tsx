import { useEffect } from 'react';
import { useThemeStore } from '../../store/themeStore';

export function ThemeManager() {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Clean up previous theme classes on body
    const body = document.body;
    const classes = Array.from(body.classList);
    
    classes.forEach(cls => {
      if (cls.startsWith('theme-')) {
        body.classList.remove(cls);
      }
    });

    // Apply the active enterprise theme class
    body.classList.add(`theme-${theme}`);

    // If high-contrast is active, we can set matching global attributes
    if (theme === 'high-contrast') {
      body.setAttribute('data-high-contrast', 'true');
    } else {
      body.removeAttribute('data-high-contrast');
    }
  }, [theme]);

  return null;
}
