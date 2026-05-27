import type { TocItem, LocationData } from './reader';

declare global {
  interface FoliateView extends HTMLElement {
    open: (file: File) => Promise<void>;
    init: (opts?: {
      lastLocation?: unknown;
      showTextStart?: boolean;
    }) => Promise<void>;
    close: () => void;
    next: (distance?: number) => Promise<void>;
    prev: (distance?: number) => Promise<void>;
    goTo: (target: unknown) => Promise<unknown>;
    goToFraction: (frac: number) => Promise<void>;
    goToTextStart: () => Promise<void>;
    showAnnotation: (annotation: { value: string }) => Promise<void>;
    addAnnotation: (annotation: {
      value: string;
      type?: string;
      color?: string;
    }) => Promise<void>;
    deleteAnnotation: (annotation: { value: string }) => void;
    select: (target: unknown) => Promise<void>;
    deselect: () => void;
    getCFI: (index: number, range: Range) => string;
    book: { toc?: TocItem[]; metadata?: { title?: string } };
    renderer: {
      getContents?: () => { doc?: Document; index?: number }[];
    };
  }
}
