/**
 * Tiny helpers for jsdom tests of web-only (MUI) components. There is no @testing-library/react
 * in this repo, so these mount through react-dom/client + `act` (same approach as
 * features/retro/components/__tests__/memory-card-web.test.tsx). Import this only from files that
 * start with the `@jest-environment jsdom` docblock.
 */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface Mounted {
  container: HTMLDivElement;
  rerender: (element: React.ReactElement) => Promise<void>;
  unmount: () => void;
}

export async function mountWeb(element: React.ReactElement): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  await flush();
  return {
    container,
    rerender: async (next) => {
      await act(async () => {
        root.render(next);
      });
      await flush();
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Lets pending promise continuations (mocked axios) and the resulting state updates settle. */
export async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Deepest element whose trimmed text is exactly `text`, or whose text contains it if no exact hit. */
export function findByText(container: HTMLElement, text: string): HTMLElement | null {
  const all = Array.from(container.querySelectorAll<HTMLElement>('*'));
  const exact = all.filter((el) => el.textContent?.trim() === text);
  const pool = exact.length > 0 ? exact : all.filter((el) => el.textContent?.includes(text));
  return pool.length > 0 ? pool[pool.length - 1] : null;
}

export async function clickText(container: HTMLElement, text: string) {
  const el = findByText(container, text);
  if (!el) throw new Error(`Element with text "${text}" not found. DOM text: ${container.textContent}`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flush();
}

/** Sets an <input>/<textarea> value the way React's onChange expects (bypasses its value tracker). */
export async function setInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function inputByPlaceholder(container: HTMLElement, placeholder: string) {
  return container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
}

export function dateInputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}
