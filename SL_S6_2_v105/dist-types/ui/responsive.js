/**
 * Responsive Layout Utilities
 * 响应式布局工具，支持断点和自适应
 */
export const BREAKPOINTS = {
    xs: 0, // 极小屏 (<360px)
    sm: 360, // 小屏 (360-414px)
    md: 414, // 中屏 (414-768px)
    lg: 768, // 大屏 (>768px)
};
export function getBreakpoint(width) {
    if (width < BREAKPOINTS.sm)
        return 'xs';
    if (width < BREAKPOINTS.md)
        return 'sm';
    if (width < BREAKPOINTS.lg)
        return 'md';
    return 'lg';
}
// 响应式值选择器
export function responsive(width, values, fallback) {
    const bp = getBreakpoint(width);
    return values[bp] ?? fallback;
}
// 计算响应式间距
export function getResponsivePadding(width) {
    return Math.max(16, Math.min(32, width * 0.04));
}
// 计算响应式字体大小
export function getResponsiveFontSize(baseSize, width) {
    const scale = responsive(width, {
        xs: 0.85,
        sm: 0.9,
        md: 1,
        lg: 1.1,
    }, 1);
    return Math.round(baseSize * scale);
}
// 确保最小触控目标
export function ensureMinTouchTarget(size, minSize = 44) {
    return Math.max(size, minSize);
}
