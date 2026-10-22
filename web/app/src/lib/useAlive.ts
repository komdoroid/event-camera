import { useEffect, useRef } from 'react';

/** マウント中だけ true の ref。StrictMode の effect 二重実行でも、再マウント時に true へ戻す */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}
