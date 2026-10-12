import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/*
  jsdom implements only part of the DOM. Radix primitives rely on a few browser
  APIs that every real browser provides but jsdom does not, so they are
  polyfilled here rather than being worked around in individual tests.

  These are environment gaps, not application behaviour: the real behaviour is
  covered by the Playwright suite, which runs in an actual browser.
*/

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof globalThis.matchMedia;
}

if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
