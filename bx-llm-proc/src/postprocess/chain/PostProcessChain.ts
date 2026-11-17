export class PostProcessChain {
  private value: any;
  private logsEnabled = false;

  private constructor(initial: any) {
    this.value = initial;
  }

  static start(initial: any) {
    return new PostProcessChain(initial);
  }

  debug(on = true) {
    this.logsEnabled = on;
    return this;
  }

  private log(label: string, payload: any) {
    if (this.logsEnabled) console.log('[PostProcessChain]', label, payload);
  }

  get<T = any>(): T {
    return this.value as T;
  }

  done<T = any>(): T {
    return this.get<T>();
  }

  apply<TOut = any>(fn: (v: any) => TOut, label?: string) {
    const name = label ?? fn.name ?? 'apply';
    this.log(name, { before: this.value });
    this.value = fn(this.value);
    this.log(name, { after: this.value });
    return this;
  }
}
