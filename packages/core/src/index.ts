import { Openflame } from './core';

declare let global: NodeJS.Global;

declare module NodeJS {
  interface Global {
    window: any;
    global: any;
  }
}

/**
 * window: browser in DOM main thread
 * self: browser in WebWorker
 * global: Node.js/other
 *
 * Adapted from: https://github.com/ReactiveX/rxjs/blob/a3823d2bc7d1bd4d22944c53b27c2af682cddb2a/src/util/root.ts
 */
export const root: any = (
  typeof window == 'object' && window.window === window && window
  || typeof self == 'object' && self.self === self && self
  || typeof global == 'object' && global.global === global && global
);

if (root) {
  root['Openflame'] = Openflame;
}




export * from './core';
