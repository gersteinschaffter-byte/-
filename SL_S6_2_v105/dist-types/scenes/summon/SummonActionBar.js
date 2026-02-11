import { Container, Graphics, Text } from 'pixi.js';
import UIButton from '../../ui/components/UIButton';
import { createText, roundedRect } from '../../ui/uiFactory';
/**
 * Main CTA area for summoning.
 * - Single summon
 * - Ten summon
 */
export default class SummonActionBar extends Container {
    constructor(w) {
        super();
        Object.defineProperty(this, "bg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hint", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "btnOne", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "btnTen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.bg = new Graphics();
        this.addChild(this.bg);
        this.hint = createText('点击召唤，立即获得英雄（占位动效）', 18, 0xcfe3ff, '700');
        this.hint.anchor.set(0.5);
        this.addChild(this.hint);
        this.btnOne = new UIButton('单抽', 300, 92);
        this.btnTen = new UIButton('十连', 300, 92);
        this.btnOne.txt.style.fontSize = 26;
        this.btnTen.txt.style.fontSize = 26;
        this.addChild(this.btnOne, this.btnTen);
        this.resize(w);
    }
    resize(w) {
        this.bg.clear();
        this.bg.beginFill(0x000000, 0.12);
        roundedRect(this.bg, 0, 0, w, 140, 26);
        this.bg.endFill();
        this.hint.position.set(w / 2, 26);
        const gap = 20;
        const totalW = 300 * 2 + gap;
        const x0 = (w - totalW) / 2;
        this.btnOne.position.set(x0, 48);
        this.btnTen.position.set(x0 + 300 + gap, 48);
    }
    setButtonLabels(one, ten) {
        this.btnOne.setLabel(one);
        this.btnTen.setLabel(ten);
    }
}
