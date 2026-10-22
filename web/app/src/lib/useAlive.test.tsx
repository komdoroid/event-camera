// @vitest-environment jsdom
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { expect, it } from 'vitest';
import { useAlive } from './useAlive';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('StrictMode の二重 effect 後も alive が true で、アンマウントで false になる', async () => {
  let ref: { current: boolean } | undefined;
  const C = () => { ref = useAlive(); return null; };
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<StrictMode><C /></StrictMode>));
  expect(ref!.current).toBe(true);
  await act(async () => root.unmount());
  expect(ref!.current).toBe(false);
});
