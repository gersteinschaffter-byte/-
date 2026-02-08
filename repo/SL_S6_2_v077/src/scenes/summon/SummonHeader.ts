import { Container, Graphics, Text } from 'pixi.js';
import UIButton from '../../ui/components/UIButton';
import { createText, roundedRect } from '../../ui/uiFactory';

/**
 * SummonHeader is the top strip of Summon UI.
 *
 * Responsibilities:
 * - Pool title
 * - Cost description
 * - A "概率" entry button (used to toggle the bottom info panel)
 */
export default class SummonHeader extends Container {
  private readonly bg: Graphics;
  private readonly title: Text;
  private readonly desc: Text;
  public readonly btnProb: UIButton;

  constructor(w: number) {
    super();
    this.bg = new Graphics();
    this.addChild(this.bg);

    this.title = createText('普通召唤池', 32, 0xffffff, '900');
    this.title.anchor.set(0, 0.5);
    this.addChild(this.title);

    this.desc = createText('', 20, 0xcfe3ff, '700');
    this.desc.anchor.set(0, 0.5);
    this.addChild(this.desc);

    this.btnProb = new UIButton('概率', 140, 64);
    this.btnProb.txt.style.fontSize = 22;
    this.addChild(this.btnProb);

    this.resize(w);
  }

  public resize(w: number): void {
    this.bg.clear();
    this.bg.beginFill(0x000000, 0.18);
    roundedRect(this.bg, 0, 0, w, 128, 26);
    this.bg.endFill();

    this.title.position.set(36, 44);
    this.desc.position.set(36, 92);
    this.btnProb.position.set(w - 36 - 140, 32);
  }

  public setPoolTitle(title: string): void {
    this.title.text = title;
  }

  public setCostDesc(desc: string): void {
    this.desc.text = desc;
  }
}
