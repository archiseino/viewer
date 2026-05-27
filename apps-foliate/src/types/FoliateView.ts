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
    showAnnotation: (annotation: { value: string | number }) => Promise<void>;
    addAnnotation: (annotation: {
      value: string | number;
      type?: string;
      color?: string;
    }) => Promise<void>;
    deleteAnnotation: (annotation: { value: string | number }) => void;
    select: (target: unknown) => Promise<void>;
    deselect: () => void;
    getCFI: (index: number, range: Range) => string;
    book: { toc?: TocItem[]; metadata?: { title?: string } };
    renderer: HTMLElement & {
      getContents?: () => ContentItem[];
    };
  }
}

export interface ContentItem {
  doc?: Document
  index?: number
  overlayer?: import('foliate-js/overlayer.js').Overlayer
}
