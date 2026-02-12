type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * A tiny in-memory logger for on-device debugging.
 *
 * Goals:
 * - No external deps
 * - Safe on mobile
 * - Copyable text for sharing bug reports
 */
export default class DebugLogger {
  private readonly maxLines: number;
  private lines: string[] = [];

  constructor(maxLines = 400) {
    this.maxLines = Math.max(50, maxLines | 0);
  }

  public info(tag: string, msg: string, data?: any): void {
    this.push('INFO', tag, msg, data);
  }

  public warn(tag: string, msg: string, data?: any): void {
    this.push('WARN', tag, msg, data);
  }

  public error(tag: string, msg: string, data?: any): void {
    this.push('ERROR', tag, msg, data);
  }

  public clear(): void {
    this.lines = [];
  }

  public getText(): string {
    return this.lines.join('\n');
  }

  public getCount(): number {
    return this.lines.length;
  }

  private push(level: LogLevel, tag: string, msg: string, data?: any): void {
    const time = new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    const ts = `${hh}:${mm}:${ss}`;

    let extra = '';
    if (data !== undefined) {
      try {
        extra = ' ' + JSON.stringify(data);
      } catch {
        extra = ' ' + String(data);
      }
    }

    this.lines.push(`[${ts}] ${level} ${tag}: ${msg}${extra}`);
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }
  }
}
