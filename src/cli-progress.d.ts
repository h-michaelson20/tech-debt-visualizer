declare module "cli-progress" {
  interface SingleBarOptions {
    format?: string;
    barCompleteChar?: string;
    barIncompleteChar?: string;
  }
  interface Presets {
    shades_classic: SingleBarOptions;
  }
  class SingleBar {
    constructor(opts: SingleBarOptions, preset?: SingleBarOptions);
    start(total: number, startValue: number, payload?: Record<string, string>): void;
    update(value: number, payload?: Record<string, string>): void;
    stop(): void;
  }
  const Presets: Presets;
  const out: { SingleBar: typeof SingleBar; Presets: Presets };
  export default out;
}
