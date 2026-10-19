import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom no implementa estas APIs que usan Radix, Recharts y Motion.
class ResizeObserverFalso { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
}
// Con todas las pruebas en paralelo en una PC lenta, las pantallas pueden tardar varios segundos en aparecer.
configure({ asyncUtilTimeout: 10000 });

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
window.scrollTo = (() => {}) as typeof window.scrollTo;

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  // unstubAllGlobals también retira el ResizeObserver falso: se vuelve a poner para la siguiente prueba
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
});
