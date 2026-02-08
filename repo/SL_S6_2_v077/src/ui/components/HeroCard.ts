import { Container, Graphics, Text } from 'pixi.js';
import type { HeroDef } from '../../game/data';
import type { OwnedHero } from '../../game/storage';
import { createText, elementColor, rarityColor, rarityLabel, roundedRect } from '../uiFactory';

/**
 * A reusable hero card.
 *
 * In phase 1 it is a pure Pixi component and uses only placeholder graphics.
 * Later phases can swap the portrait renderer (sprite/Spine/...)
 * without changing the scene logic.
 */
export default class HeroCard extends Container {
  public readonly w = 214;
  public readonly h = 268;
  public readonly hero: HeroDef;
  private owned: OwnedHero | undefined;
  private inParty = false;

  private readonly bg: Graphics;
  private readonly portrait: Container;
  private readonly nameTxt: Text;
  private readonly subTxt: Text;
  private readonly bottomBar: Graphics;

  private readonly rarityRibbon: Container;
  private readonly rarityRibbonBg: Graphics;
  private readonly rarityRibbonTxt: Text;

  private readonly elementBadge: Container;
  private readonly elementBadgeBg: Graphics;
  private readonly elementBadgeTxt: Text;

  private readonly lockOverlay: Container;
  private readonly lockBg: Graphics;
  private readonly lockTxt: Text;
  public readonly glow: Graphics;

  private readonly partyBadge: Container;
  private readonly partyBadgeBg: Graphics;
  private readonly partyBadgeTxt: Text;

  constructor(hero: HeroDef, owned?: OwnedHero) {
    super();
    this.hero = hero;
    this.owned = owned;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.portrait = new Container();
    this.addChild(this.portrait);

    // Bottom info bar
    this.bottomBar = new Graphics();
    this.addChild(this.bottomBar);

    this.nameTxt = createText(hero.name, 24, 0xffffff, '800');
    this.nameTxt.anchor.set(0, 0.5);
    this.addChild(this.nameTxt);

    this.subTxt = createText('', 18, 0xcfe3ff, '700');
    this.subTxt.anchor.set(0, 0.5);
    this.addChild(this.subTxt);

    // Rarity ribbon (top-left)
    this.rarityRibbon = new Container();
    this.rarityRibbon.zIndex = 60;
    this.rarityRibbonBg = new Graphics();
    this.rarityRibbonTxt = createText(rarityLabel(hero.rarity), 16, 0xffffff, '900');
    this.rarityRibbonTxt.anchor.set(0.5);
    this.rarityRibbon.addChild(this.rarityRibbonBg, this.rarityRibbonTxt);
    this.addChild(this.rarityRibbon);

    // Element badge (top-right)
    this.elementBadge = new Container();
    this.elementBadge.zIndex = 60;
    this.elementBadgeBg = new Graphics();
    this.elementBadgeTxt = createText(String(hero.element || '').slice(0, 1), 16, 0xffffff, '900');
    this.elementBadgeTxt.anchor.set(0.5);
    this.elementBadge.addChild(this.elementBadgeBg, this.elementBadgeTxt);
    this.addChild(this.elementBadge);

    // Lock overlay for unowned heroes (keeps layout consistent and readable)
    this.lockOverlay = new Container();
    this.lockOverlay.zIndex = 80;
    this.lockBg = new Graphics();
    this.lockTxt = createText('未拥有', 20, 0xffffff, '900');
    this.lockTxt.anchor.set(0.5);
    this.lockOverlay.addChild(this.lockBg, this.lockTxt);
    this.addChild(this.lockOverlay);

    this.glow = new Graphics();
    this.addChild(this.glow);

    // "In party" badge (top-right). Hidden by default.
    this.partyBadge = new Container();
    this.partyBadge.zIndex = 50;
    this.partyBadgeBg = new Graphics();
    this.partyBadgeTxt = createText('上阵中', 16, 0xffffff, '900');
    this.partyBadgeTxt.anchor.set(0.5);
    this.partyBadge.addChild(this.partyBadgeBg, this.partyBadgeTxt);
    this.addChild(this.partyBadge);

    this.interactive = true;
    this.cursor = 'pointer';

    this.draw();
    this.refresh();
  }

  private draw(): void {
    const w = this.w,
      h = this.h;
    const rc = rarityColor(this.hero.rarity);

    this.bg.clear();
    this.bg.beginFill(0x0e1733, 0.98);
    this.bg.lineStyle(4, rc, 1);
    roundedRect(this.bg, 0, 0, w, h, 18);
    this.bg.endFill();

    // portrait placeholder
    this.portrait.removeChildren();
    const p = new Graphics();
    p.beginFill(0x000000, 0.25);
    roundedRect(p, 14, 14, w - 28, 150, 16);
    p.endFill();

    const ring = new Graphics();
    ring.lineStyle(6, elementColor(this.hero.element), 0.95);
    ring.beginFill(0xffffff, 0.08);
    ring.drawCircle(w / 2, 14 + 75, 50);
    ring.endFill();

    const letter = createText(this.hero.name.slice(0, 1), 54, 0xffffff, '900');
    letter.anchor.set(0.5);
    letter.position.set(w / 2, 14 + 75);

    this.portrait.addChild(p, ring, letter);

    // Bottom bar: two-line text (name + Lv/stars)
    const barH = 72;
    this.bottomBar.clear();
    this.bottomBar.beginFill(0x000000, 0.25);
    roundedRect(this.bottomBar, 10, h - barH - 10, w - 20, barH, 16);
    this.bottomBar.endFill();

    this.nameTxt.position.set(18, h - barH - 10 + 22);
    this.subTxt.position.set(18, h - barH - 10 + 48);

    // Rarity ribbon
    const rrW = 70;
    const rrH = 26;
    this.rarityRibbon.position.set(12, 12);
    this.rarityRibbonBg.clear();
    this.rarityRibbonBg.beginFill(rc, 0.95);
    roundedRect(this.rarityRibbonBg, 0, 0, rrW, rrH, 10);
    this.rarityRibbonBg.endFill();
    this.rarityRibbonTxt.position.set(rrW / 2, rrH / 2 + 0.5);

    // Element badge
    const ebR = 16;
    this.elementBadge.position.set(w - 12 - ebR * 2, 12);
    this.elementBadgeBg.clear();
    this.elementBadgeBg.beginFill(0x0e1733, 0.9);
    this.elementBadgeBg.lineStyle(3, elementColor(this.hero.element), 1);
    this.elementBadgeBg.drawRoundedRect(0, 0, ebR * 2, ebR * 2, ebR);
    this.elementBadgeBg.endFill();
    this.elementBadgeTxt.position.set(ebR, ebR + 0.5);

    // Party badge layout (avoid covering bottom texts).
    const bw = 74;
    const bh = 28;
    this.partyBadge.position.set(w - 14 - bw, 12);
    this.partyBadgeBg.clear();
    this.partyBadgeBg.beginFill(0x2bc26b, 0.95);
    roundedRect(this.partyBadgeBg, 0, 0, bw, bh, 10);
    this.partyBadgeBg.endFill();
    this.partyBadgeTxt.position.set(bw / 2, bh / 2 + 0.5);

    this.glow.clear();
    this.glow.beginFill(rc, 0.1);
    roundedRect(this.glow, 8, 8, w - 16, h - 16, 16);
    this.glow.endFill();

    // Lock overlay layout
    this.lockBg.clear();
    this.lockBg.beginFill(0x000000, 0.35);
    roundedRect(this.lockBg, 10, 10, w - 20, h - 20, 18);
    this.lockBg.endFill();
    this.lockTxt.position.set(w / 2, h / 2);
  }

  public setOwned(owned?: OwnedHero): void {
    this.owned = owned;
    this.refresh();
  }

  public setInParty(inParty: boolean): void {
    this.inParty = !!inParty;
    this.refresh();
  }

  public refresh(): void {
    if (this.owned) {
      const lv = this.owned.level || 1;
      const stars = Math.max(0, Math.min(5, this.owned.stars || 0));
      const starStr = stars > 0 ? ' ' + '★'.repeat(stars) : '';
      this.subTxt.text = `Lv.${lv}${starStr}`;
      this.alpha = 1;
    } else {
      this.subTxt.text = '';
      this.alpha = 0.6;
    }

    // Only show badge when hero is currently in party.
    this.partyBadge.visible = this.inParty;

    // Unowned overlay
    this.lockOverlay.visible = !this.owned;
  }
}
