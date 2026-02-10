import { Container, Graphics, Text } from 'pixi.js';
import ScrollView from '../../ui/components/ScrollView';
import SkeletonBlock from '../../ui/components/Skeleton';
import UIButton from '../../ui/components/UIButton';
import { clamp, createText, rarityColor, rarityLabel, roundedRect } from '../../ui/uiFactory';
import { RARITY } from '../../game/config';
import { HERO_BY_RARITY, SUMMON_PROB } from '../../game/data';
/**
 * Collapsible bottom information panel:
 * - Probability bars
 * - Hero pool preview list
 * - Scrollable when expanded
 */
export default class SummonInfoPanel extends Container {
    constructor(w, hCollapsed, hExpanded, wheelDom) {
        super();
        Object.defineProperty(this, "wheelUnbind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "bg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "header", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "btnToggle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scroll", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "expanded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "contentBuilt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "buildTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "w", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hCollapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 64
        });
        Object.defineProperty(this, "hExpanded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 260
        });
        this.w = w;
        this.hCollapsed = hCollapsed;
        this.hExpanded = hExpanded;
        this.bg = new Graphics();
        this.addChild(this.bg);
        this.header = new Graphics();
        this.addChild(this.header);
        this.title = createText('概率 & 奖池预览', 22, 0xffffff, '900');
        this.title.anchor.set(0, 0.5);
        this.addChild(this.title);
        this.btnToggle = new UIButton('展开', 140, 54);
        this.btnToggle.txt.style.fontSize = 20;
        this.addChild(this.btnToggle);
        this.scroll = new ScrollView(w - 48, hExpanded - hCollapsed - 20);
        this.scroll.position.set(24, hCollapsed + 10);
        this.addChild(this.scroll);
        // Bind wheel on canvas (desktop) and unbind on destroy to prevent listener leaks.
        if (wheelDom)
            this.wheelUnbind = this.scroll.bindWheel(wheelDom);
        // Also unbind when removed from stage (some flows may remove without destroy).
        this.on('removed', () => {
            if (this.buildTimer) {
                try {
                    clearTimeout(this.buildTimer);
                }
                catch (_) { }
                this.buildTimer = null;
            }
            if (!this.wheelUnbind)
                return;
            try {
                this.wheelUnbind();
            }
            catch (_) { }
            this.wheelUnbind = null;
        });
        this.btnToggle.on('pointertap', () => this.setExpanded(!this.expanded));
        // 初始化时不渲染内容，等展开时再渲染（性能优化）
        this.setExpanded(false);
        this.resize(w, hCollapsed, hExpanded);
    }
    resize(w, hCollapsed, hExpanded) {
        this.w = w;
        this.hCollapsed = hCollapsed;
        this.hExpanded = hExpanded;
        this.scroll.resize(w - 48, hExpanded - hCollapsed - 20);
        this.scroll.position.set(24, hCollapsed + 10);
        this.layout();
    }
    setExpanded(expanded) {
        this.expanded = expanded;
        this.btnToggle.setLabel(expanded ? '收起' : '展开');
        this.scroll.visible = expanded;
        // Phase 2: 首次展开时构建内容（延迟加载优化）
        if (expanded && !this.contentBuilt) {
            // 延迟构建，避免阻塞UI
            if (!this.buildTimer) {
                this.buildTimer = setTimeout(() => {
                    this.buildTimer = null;
                    this.rebuildContent(); // 修复：调用正确的方法
                    this.contentBuilt = true;
                    // 确保滚动边界正确更新
                    this.scroll.setContentHeight?.(this.scroll.content.height);
                }, 140);
            }
        }
        this.layout();
    }
    isExpanded() {
        return this.expanded;
    }
    layout() {
        const h = this.expanded ? this.hExpanded : this.hCollapsed;
        this.bg.clear();
        this.bg.beginFill(0x000000, 0.18);
        roundedRect(this.bg, 0, 0, this.w, h, 26);
        this.bg.endFill();
        this.header.clear();
        this.header.beginFill(0xffffff, 0.06);
        roundedRect(this.header, 0, 0, this.w, this.hCollapsed, 26);
        this.header.endFill();
        this.title.position.set(24, this.hCollapsed / 2);
        this.btnToggle.position.set(this.w - 24 - 140, (this.hCollapsed - 54) / 2);
        // Ensure scroll stays inside when expanded.
        this.scroll.position.set(24, this.hCollapsed + 10);
    }
    rebuildContent() {
        const c = this.scroll.content;
        c.removeChildren();
        // Probability section
        const section1 = createText('概率', 20, 0xffe3a3, '900');
        section1.position.set(0, 0);
        c.addChild(section1);
        const x0 = 0, y0 = 34, w = this.w - 48, barW = Math.max(320, w - 140), h = 18, gap = 26;
        const items = [
            { r: RARITY.SP, p: SUMMON_PROB.find((x) => x.rarity === RARITY.SP)?.p ?? 0.5 },
            { r: RARITY.SSR, p: SUMMON_PROB.find((x) => x.rarity === RARITY.SSR)?.p ?? 2.0 },
            { r: RARITY.SR, p: SUMMON_PROB.find((x) => x.rarity === RARITY.SR)?.p ?? 18.0 },
            { r: RARITY.R, p: SUMMON_PROB.find((x) => x.rarity === RARITY.R)?.p ?? 79.5 },
        ];
        const g = new Graphics();
        c.addChild(g);
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const yy = y0 + i * gap;
            const rc = rarityColor(it.r);
            g.beginFill(0x000000, 0.25);
            roundedRect(g, x0, yy, barW, h, 9);
            g.endFill();
            g.beginFill(rc, 0.75);
            const fillW = clamp(barW * (it.p / 100), 12, barW);
            roundedRect(g, x0, yy, fillW, h, 9);
            g.endFill();
            const t = createText(`${rarityLabel(it.r)}  ${it.p}%`, 16, 0xffffff, '800');
            t.anchor.set(1, 0.5);
            t.position.set(barW + 120, yy + h / 2);
            c.addChild(t);
        }
        // Hero pool section
        const section2 = createText('奖池英雄预览（占位）', 20, 0xffe3a3, '900');
        section2.position.set(0, y0 + items.length * gap + 18);
        c.addChild(section2);
        let yy = section2.y + 34;
        const rows = [
            { r: RARITY.SP, list: HERO_BY_RARITY[RARITY.SP] },
            { r: RARITY.SSR, list: HERO_BY_RARITY[RARITY.SSR] },
            { r: RARITY.SR, list: HERO_BY_RARITY[RARITY.SR] },
            { r: RARITY.R, list: HERO_BY_RARITY[RARITY.R] },
        ];
        for (const row of rows) {
            const lab = createText(rarityLabel(row.r) + ': ', 16, rarityColor(row.r), '900');
            lab.anchor.set(0, 0.5);
            lab.position.set(0, yy);
            c.addChild(lab);
            const names = row.list.map((h) => h.name).join('、');
            const t = createText(names, 16, 0xd7e6ff, '700');
            t.anchor.set(0, 0.5);
            t.position.set(56, yy);
            t.style.wordWrap = true;
            t.style.wordWrapWidth = this.w - 48 - 60;
            c.addChild(t);
            yy += 44;
        }
        const foot = createText('提示：本页为占位数据，可接入真实配置表/后台', 14, 0xcfe3ff, '700');
        foot.position.set(0, yy + 10);
        c.addChild(foot);
    }
    destroy(options) {
        // Ensure wheel listener is removed when panel is destroyed (prevents duplicated scrolling).
        this.wheelUnbind?.();
        this.wheelUnbind = null;
        super.destroy(options);
    }
}
