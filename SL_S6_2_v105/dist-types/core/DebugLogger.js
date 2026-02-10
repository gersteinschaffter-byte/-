/**
 * A tiny in-memory logger for on-device debugging.
 *
 * Goals:
 * - No external deps
 * - Safe on mobile
 * - Copyable text for sharing bug reports
 */
export default class DebugLogger {
    constructor(maxLines = 400) {
        Object.defineProperty(this, "maxLines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.maxLines = Math.max(50, maxLines | 0);
    }
    info(tag, msg, data) {
        this.push('INFO', tag, msg, data);
    }
    warn(tag, msg, data) {
        this.push('WARN', tag, msg, data);
    }
    error(tag, msg, data) {
        this.push('ERROR', tag, msg, data);
    }
    clear() {
        this.lines = [];
    }
    getText() {
        return this.lines.join('\n');
    }
    getCount() {
        return this.lines.length;
    }
    push(level, tag, msg, data) {
        const time = new Date();
        const hh = String(time.getHours()).padStart(2, '0');
        const mm = String(time.getMinutes()).padStart(2, '0');
        const ss = String(time.getSeconds()).padStart(2, '0');
        const ts = `${hh}:${mm}:${ss}`;
        let extra = '';
        if (data !== undefined) {
            try {
                extra = ' ' + JSON.stringify(data);
            }
            catch {
                extra = ' ' + String(data);
            }
        }
        this.lines.push(`[${ts}] ${level} ${tag}: ${msg}${extra}`);
        if (this.lines.length > this.maxLines) {
            this.lines.splice(0, this.lines.length - this.maxLines);
        }
    }
}
