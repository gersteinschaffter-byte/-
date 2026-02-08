import { Container, Graphics, Text } from 'pixi.js';
import type { FighterSnapshot, Side } from './BattleTypes';
import { createText, roundedRect } from '../ui/uiFactory';
import { Tween, TweenRunner, easeOutCubic } from '../fx/Tween';
import { spawnFloatingText } from '../fx/FloatingText';
import { spawnFlashLine } from '../fx/FlashLine';

type BuffNode = {
  root: Container;
  icon: Text;
  turns?: Text;
};

/**
 * FighterNode — visual representation of a single fighter on the battle arena.
 *
 * Extracted from BattleView for maintainability.
 * Handles: body rendering, HP bar, buff icons, damage/heal/death animations.
 */
export default class FighterNode {
  public readonly container: Container;

  private readonly activeGlow: Graphics;
  private readonly turnGlow: Graphics;

  private readonly body: Graphics;
  private readonly hpBar: Graphics;
  private readonly hpTxt: Text;

  private readonly nameTxt: Text;
  private readonly baseName: string;

  private readonly buffBar: Container;
  private readonly buffNodes = new Map<string, BuffNode>();

  private hp: number;
  private maxHp: number;

  public isDead: boolean = false;
  private isDestroyed: boolean = false;

  constructor(f: FighterSnapshot) {
    this.baseName = f.name;
    this.hp = f.hp;
    this.maxHp = f.maxHp;

    this.container = new Container();

    // Persistent "current actor" highlight.
    this.activeGlow = new Graphics();
    this.activeGlow.visible = false;
    this.container.addChild(this.activeGlow);

    // Short pulse glow (used when actorTurn fires).
    this.turnGlow = new Graphics();
    this.container.addChild(this.turnGlow);

    this.body = new Graphics();
    this.container.addChild(this.body);

    const elementTag = f.element ? `[${f.element}]` : '';
    this.nameTxt = createText(`${elementTag}${f.name}`, 18, 0xffffff, '900');
    this.nameTxt.anchor.set(0.5);
    this.nameTxt.position.set(0, -62);
    this.container.addChild(this.nameTxt);

    // HP numbers (e.g. "125/200")
    this.hpTxt = createText('', 14, 0xd7e6ff, '800');
    this.hpTxt.anchor.set(0.5);
    this.hpTxt.position.set(0, 36);
    this.container.addChild(this.hpTxt);

    this.hpBar = new Graphics();
    this.hpBar.position.set(-54, 52);
    this.container.addChild(this.hpBar);

    // Buff icon row below HP bar.
    this.buffBar = new Container();
    this.buffBar.position.set(-54, 70);
    this.container.addChild(this.buffBar);

    this.drawBody(f.side);
    this.drawHp();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.container.destroy({ children: true });
  }

  public getName(): string {
    return this.baseName || this.nameTxt.text || '';
  }

  public setActive(isActive: boolean): void {
    if (this.isDestroyed) return;
    if (this.isDead) {
      this.activeGlow.visible = false;
      return;
    }
    this.activeGlow.visible = isActive;
    if (!isActive) return;

    this.activeGlow.clear();
    this.activeGlow.beginFill(0xfff4a0, 0.10);
    this.activeGlow.drawRoundedRect(-78, -68, 156, 156, 36);
    this.activeGlow.endFill();
    this.activeGlow.lineStyle(4, 0xfff4a0, 0.32);
    this.activeGlow.drawRoundedRect(-78, -68, 156, 156, 36);
  }

  // ── Rendering ──────────────────────────────────────

  private drawBody(side: Side): void {
    const g = this.body;
    g.clear();
    const col = side === 'A' ? 0x3aa7ff : 0xff4d6d;
    g.lineStyle(6, 0xffffff, 0.25);
    g.beginFill(col, 0.9);
    g.drawRoundedRect(-58, -48, 116, 116, 28);
    g.endFill();

    g.beginFill(0x071129, 0.3);
    g.drawCircle(0, 0, 28);
    g.endFill();
  }

  private drawHp(): void {
    if (this.isDestroyed || !this.hpBar) return;

    const w = 108;
    const h = 14;
    const ratio = this.maxHp <= 0 ? 0 : Math.max(0, Math.min(1, this.hp / this.maxHp));

    this.hpTxt.text = `${Math.max(0, Math.floor(this.hp))}/${Math.max(0, Math.floor(this.maxHp))}`;

    this.hpBar.clear();
    this.hpBar.beginFill(0x000000, 0.35);
    roundedRect(this.hpBar, 0, 0, w, h, 10);
    this.hpBar.endFill();

    this.hpBar.beginFill(0x54ff8d, 0.9);
    roundedRect(this.hpBar, 2, 2, Math.max(0, (w - 4) * ratio), h - 4, 8);
    this.hpBar.endFill();
  }

  // ── Buff icons ─────────────────────────────────────

  public addBuffIcon(buffId: string, icon: string, durationRounds?: number): void {
    if (this.buffNodes.has(buffId)) return;

    const root = new Container();
    const iconTxt = createText(icon, 16, 0xffffff, '800');
    root.addChild(iconTxt);

    let turnsTxt: Text | undefined;
    if (durationRounds != null && Number.isFinite(durationRounds) && durationRounds > 0) {
      turnsTxt = createText(String(Math.floor(durationRounds)), 12, 0xffee88, '900');
      turnsTxt.anchor.set(1, 1);
      turnsTxt.position.set(18, 18);
      root.addChild(turnsTxt);
    }

    this.buffNodes.set(buffId, { root, icon: iconTxt, turns: turnsTxt });
    this.buffBar.addChild(root);
    this.layoutBuffIcons();
  }

  public updateBuffTurns(buffId: string, turns?: number): void {
    const bn = this.buffNodes.get(buffId);
    if (!bn) return;
    if (!bn.turns) return;
    if (turns == null || !Number.isFinite(turns)) return;
    bn.turns.text = String(Math.max(0, Math.floor(turns)));
  }

  public removeBuffIcon(buffId: string): void {
    const bn = this.buffNodes.get(buffId);
    if (!bn) return;
    this.buffBar.removeChild(bn.root);
    bn.root.destroy({ children: true });
    this.buffNodes.delete(buffId);
    this.layoutBuffIcons();
  }

  private layoutBuffIcons(): void {
    let x = 0;
    for (const bn of this.buffNodes.values()) {
      bn.root.position.set(x, 0);
      x += 22;
    }
  }

  // ── FX animations ──────────────────────────────────

  /** Quick body tint flash in a given color (used for skill activation). */
  public flashColor(color: number, runner: TweenRunner): void {
    const overlay = new Graphics();
    overlay.beginFill(color, 0.35);
    overlay.drawRoundedRect(-58, -48, 116, 116, 28);
    overlay.endFill();
    overlay.alpha = 1;
    this.container.addChild(overlay);
    runner.add(
      Tween.to(overlay, { alpha: 0 }, 14, easeOutCubic, () => {
        this.container.removeChild(overlay);
        overlay.destroy();
      }),
    );
  }

  /** Purple flicker effect (used when poison is applied). */
  public flashPoison(runner: TweenRunner): void {
    const overlay = new Graphics();
    overlay.beginFill(0xcc44ff, 0.28);
    overlay.drawRoundedRect(-58, -48, 116, 116, 28);
    overlay.endFill();
    overlay.alpha = 0;
    this.container.addChild(overlay);

    const blinkOnce = (n: number): void => {
      if (n <= 0) {
        this.container.removeChild(overlay);
        overlay.destroy();
        return;
      }
      runner.add(
        Tween.to(overlay, { alpha: 1 }, 4, easeOutCubic, () => {
          runner.add(Tween.to(overlay, { alpha: 0 }, 6, easeOutCubic, () => blinkOnce(n - 1)));
        }),
      );
    };
    blinkOnce(3);
  }

  public flashTurn(runner: TweenRunner): void {
    if (this.isDestroyed || !this.turnGlow) return;

    this.turnGlow.clear();
    this.turnGlow.beginFill(0xfff4a0, 0.14);
    this.turnGlow.drawRoundedRect(-74, -64, 148, 148, 34);
    this.turnGlow.endFill();
    this.turnGlow.alpha = 1;

    runner.add(
      Tween.to(this.turnGlow, { alpha: 0 }, 20, easeOutCubic, () => {
        if (!this.isDestroyed && this.turnGlow) this.turnGlow.clear();
      }),
    );
  }

  public playAttackTo(tx: number, ty: number, fxLayer: Container, runner: TweenRunner, lineColor = 0xffffff): void {
    spawnFlashLine(fxLayer, this.container.x, this.container.y, tx, ty, runner, { color: lineColor });
  }

  public onDamage(
    amount: number,
    hp: number,
    maxHp: number,
    fxLayer: Container,
    runner: TweenRunner,
    dmgColor?: number,
  ): void {
    this.hp = hp;
    this.maxHp = maxHp;
    this.drawHp();

    // Shake
    const ox = this.container.x;
    runner.add(
      Tween.to(this.container, { x: ox + 12 }, 4, easeOutCubic, () => {
        runner.add(Tween.to(this.container, { x: ox }, 8, easeOutCubic));
      }),
    );

    // Floating damage text (use custom color for DoT, etc.)
    spawnFloatingText(
      fxLayer,
      `-${amount}`,
      this.container.x,
      this.container.y - 78,
      runner,
      dmgColor != null ? { color: dmgColor } : undefined,
    );
  }

  public onHeal(amount: number, hp: number, maxHp: number, fxLayer: Container, runner: TweenRunner): void {
    this.hp = hp;
    this.maxHp = maxHp;
    this.drawHp();
    spawnFloatingText(fxLayer, `+${amount}`, this.container.x, this.container.y - 78, runner, { color: 0x54ff8d });
  }

  public playDeath(runner: TweenRunner): void {
    if (this.isDead) return;
    this.isDead = true;
    this.setActive(false);
    const c = this.container;

    // Fade out + shrink slightly
    runner.add(
      Tween.to(c, { alpha: 0, scaleX: 0.9, scaleY: 0.9 }, 36, easeOutCubic, () => {
        c.alpha = 0;
      }),
    );
  }
}
