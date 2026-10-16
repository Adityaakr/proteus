/**
 * Minimal stand-in for the `framer` runtime module so the code components
 * exported from the Framer project compile and run outside Framer.
 * Property controls are a no-op here; props are passed explicitly in JSX.
 */
export const ControlType: Record<string, string> = new Proxy(
  {},
  { get: (_t, key) => String(key) },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addPropertyControls(_component: unknown, _controls: any): void {
  /* no-op outside Framer */
}

export const RenderTarget = {
  canvas: "canvas",
  export: "export",
  thumbnail: "thumbnail",
  preview: "preview",
  current(): string {
    return "preview";
  },
};

export function useIsStaticRenderer(): boolean {
  return false;
}
