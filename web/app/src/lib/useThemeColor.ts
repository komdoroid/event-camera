import { useEffect } from 'react';

/** ステータスバーの色（theme-color）を、画面にいる間だけ変える */
export function useThemeColor(color: string) {
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (!m) return;
    const prev = m.getAttribute('content');
    m.setAttribute('content', color);
    return () => { if (prev) m.setAttribute('content', prev); };
  }, [color]);
}
