import { Container, Graphics } from 'pixi.js';
import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import { ECONOMY, RARITY } from '../game/config';
import { HEROES, HERO_MAP } from '../game/data';
import { GAME_VERSION, BUILD_TIME } from '../game/version';
import { calculateHeroStats } from '../game/heroStats';
import HeroCard from '../ui/components/HeroCard';
import UIButton from '../ui/components/UIButton';
import ScrollView from '../ui/components/ScrollView';
import SkeletonBlock from '../ui/components/Skeleton';
import { clamp, createText, drawPanel, rarityLabel } from '../ui/uiFactory';
import skillsJson from '../configs/skills.json';
import buffsJson from '../configs/buffs.json';

const PERF_DEBUG = true;

export default class HeroesScene extends BaseScene {
  private unsubs: Array<() => void> = [];
  private _onHeroesChanged = () => this.scheduleRefresh('heroesChanged');

  /**
   * Drag threshold in pixels.
   * Purpose: prevent accidental `pointertap` triggers while the user is trying to scroll
   * (Android WebView/Chrome is especially sensitive and may fire `pointertap` after a small move).
   */
  // Slightly larger threshold to avoid "卡手": small moves shouldn't cancel tap,
  // and small drags shouldn't accidentally trigger tap on release.
  private static readonly DRAG_THRESHOLD = 14;

  private initialGridLoaded = false;
  private initialGridTimer: any = null;
  private skeletonNodes: Container[] = [];
  
  // Track all setTimeout IDs for cleanup
  private pendingTimeouts: Set<any> = new Set();

  // Cache hero cards to avoid rebuilding the entire grid on every small state change (party/level/star).
  private heroCards: Map<string, HeroCard> = new Map();
  private heroGridOrder: string[] = [];
  private refreshQueued = false;

  // References for the currently open hero modal. Used to update in-place after small actions.
  private heroModalRefs: null | {
    heroId: string;
    statValueTexts: { hp: any; atk: any; def: any; spd: any };
    btnPartyText?: any;
    btnLevelText?: any;
    btnStarText?: any;
    starHintText?: any;
    costHintText?: any;
    ownedMarkText?: any;
    titleText?: any;
    pillTexts?: { element: any; rarity: any; stars: any; level: any };
    counterText?: any;
    scroll?: ScrollView;
    scrollW?: number;
    skillItems?: Array<{ box: Graphics; titleText: any; bodyText: any }>;
    cardSlot?: Container;
    card?: HeroCard;
    cardTextRefs?: { nameLine: any; metaLine: any; lvLine: any };
    unsubs?: Array<() => void>;
  } = null;


  private readonly game: GameApp;
  private readonly title;
  private readonly partyText;
  private readonly partyHint;
  private readonly btnFormation;
  private readonly panel: Graphics;
  private readonly scrollMask: Graphics;
  private readonly scroll: Container;
  private pointerDown = false;
  private isDragging = false;
  private moved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastMoveY = 0;
  private scrollStartY = 0;
  // Keep scroll origin consistent with mask x/y to avoid visual offset.
  private readonly scrollBaseX = 16;
  private readonly scrollBaseY = 16;
  private contentHeight = 0;

  // Inertial scrolling (Phase 2)
  private scrollVelocity = 0;
  private readonly scrollFriction = 0.88; // 降低摩擦力，配合更大的滑动速度
  private readonly scrollBar: Graphics;
  private readonly scrollThumb: Graphics;
  private _scrollIndicatorThrottle = false;


  constructor(game: GameApp) {
    super('heroes');
    this.game = game;

    this.title = createText('英雄', 44, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);
    this.partyText = createText('队伍：0/5', 26, 0xffffff, '700');
    this.partyText.anchor.set(0.5);
    this.root.addChild(this.partyText);

    // Quick guidance for players: how to deploy/undeploy heroes.
    this.partyHint = createText('提示：点英雄卡牌 → 弹窗上阵/下阵；或进入【布阵】调整顺序', 18, 0xcfe3ff, '700');
    this.partyHint.anchor.set(0.5);
    this.root.addChild(this.partyHint);

    this.btnFormation = new UIButton('布阵', 160, 64);
    this.btnFormation.on('pointertap', () => this.game.goTo('formation', { animate: false }));
    this.root.addChild(this.btnFormation);


    this.panel = drawPanel(700, 980, 0.96);
    this.root.addChild(this.panel);

    this.scrollMask = new Graphics();
    this.panel.addChild(this.scrollMask);

    this.scroll = new Container();
    this.panel.addChild(this.scroll);

    // Scroll indicator (Phase 2)
    this.scrollBar = new Graphics();
    this.scrollThumb = new Graphics();
    this.panel.addChild(this.scrollBar);
    this.panel.addChild(this.scrollThumb);

    this.panel.interactive = true;
    this.panel.on('pointerdown', (e) => {
      // Reset touch-cycle flags.
      this.pointerDown = true;
      this.isDragging = false;
      this.moved = false;
      this.dragStartX = e.global.x;
      this.dragStartY = e.global.y;
      this.lastMoveY = e.global.y;
      this.scrollStartY = this.scroll.y;
      // Stop inertia immediately when touching again.
      this.scrollVelocity = 0;
    });
    this.panel.on('pointerup', () => this.endTouchCycle());
    this.panel.on('pointerupoutside', () => this.endTouchCycle());
    this.panel.on('pointermove', (e) => {
      if (!this.pointerDown) return;
      const dx = e.global.x - this.dragStartX;
      const dy = e.global.y - this.dragStartY;

      // Only treat as drag after exceeding the threshold.
      if (!this.moved && (Math.abs(dx) >= HeroesScene.DRAG_THRESHOLD || Math.abs(dy) >= HeroesScene.DRAG_THRESHOLD)) {
        this.moved = true;
        this.isDragging = true;
      }

      if (!this.isDragging) return;
      // Apply scroll (absolute from touch-start) for stability.
      this.scroll.y = this.scrollStartY + dy;
      // Velocity should be the *last move delta*, not the full dy from start.
      const stepV = e.global.y - this.lastMoveY;
      // 放宽速度限制，允许快速滑动（原来-48到48太限制了）
      this.scrollVelocity = clamp(stepV, -120, 120);
      this.lastMoveY = e.global.y;
      this.clampScroll();
      // 优化：只在拖动时每3帧更新一次indicator，减少重绘
      if (!this._scrollIndicatorThrottle) {
        this._scrollIndicatorThrottle = true;
        setTimeout(() => {
          this.updateScrollIndicator();
          this._scrollIndicatorThrottle = false;
        }, 50); // 约3帧 @ 60fps
      }
    });

  }

  public override onEnter(): void {
    // Bind state subscriptions when scene enters; keep UI updated.
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
    this.unsubs.push(this.game.state.on('heroesChanged', this._onHeroesChanged));
    this.unsubs.push(this.game.state.on('partyChanged', () => this.scheduleRefresh('partyChanged')));
    this.scheduleRefresh('onEnter');
  }

  public override onExit(): void {
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];

    if (this.initialGridTimer) {
      try { clearTimeout(this.initialGridTimer); } catch (_) {}
      this.initialGridTimer = null;
    }
    
    // Clear all pending timeouts
    this.clearAllTimeouts();
    
    this.initialGridLoaded = false;
  }

  /**
   * End current touch cycle.
   * Note: we delay resetting `moved` so `pointertap` handlers in the same cycle can filter taps
   * after a drag gesture (Pixi may still emit `pointertap` on slight movement).
   */
  private endTouchCycle(): void {
    this.pointerDown = false;
    this.isDragging = false;
    // Keep `moved` for this tick to filter `pointertap`, then reset for the next gesture.
    this.safeSetTimeout(() => {
      this.moved = false;
    }, 0);
  }

  /**
   * Safe setTimeout that tracks the timer for cleanup.
   */
  private safeSetTimeout(callback: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.pendingTimeouts.delete(id);
      callback();
    }, ms);
    this.pendingTimeouts.add(id);
  }

  /**
   * Clear all pending timeouts.
   */
  private clearAllTimeouts(): void {
    for (const id of this.pendingTimeouts) {
      try { clearTimeout(id); } catch (_) {}
    }
    this.pendingTimeouts.clear();
  }

  private perfNow(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  private perfMark(name: string, start: number): void {
    if (!PERF_DEBUG) return;
    const end = this.perfNow();
    const cost = (end - start).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(`[PERF][HeroesScene] ${name}: ${cost}ms`);
  }

  private scheduleRefresh(reason: string): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    const start = PERF_DEBUG ? this.perfNow() : 0;
    queueMicrotask(() => {
      this.refreshQueued = false;
      if (PERF_DEBUG) this.perfMark(`refresh(${reason})`, start);
      this.refresh();
    });
  }

  public override onResize(w: number, _h: number): void {
    if (!this.title || (this.title as any).destroyed) return;
    this.title.position.set(w / 2, 170);
    if (this.partyText && !(this.partyText as any).destroyed) {
      this.partyText.position.set(w / 2, 210);
    }
    if (this.partyHint && !(this.partyHint as any).destroyed) {
      this.partyHint.position.set(w / 2, 242);
    }
    if (this.btnFormation && !(this.btnFormation as any).destroyed) {
      this.btnFormation.position.set(w - 200, 210 - 32);
    }
    this.layoutPanel(w);
    this.layoutGrid();
    this.clampScroll(true, true);
  }

  public override onUpdate(dt: number): void {
    // Inertial scrolling: keep moving after drag release.
    if (this.pointerDown) return;
    if (Math.abs(this.scrollVelocity) < 0.5) {
      this.scrollVelocity = 0;
      return;
    }
    // dt is roughly 1 at 60fps; normalize a bit.
    const k = Math.min(2, Math.max(0.5, dt));
    this.scroll.y += this.scrollVelocity * k;
    this.scrollVelocity *= Math.pow(this.scrollFriction, k);
    this.clampScroll(false, false); // 不每帧更新indicator
    
    // 惯性滚动时节流更新indicator
    if (!this._scrollIndicatorThrottle) {
      this._scrollIndicatorThrottle = true;
      this.safeSetTimeout(() => {
        this.updateScrollIndicator();
        this._scrollIndicatorThrottle = false;
      }, 50);
    }
  }

  private layoutPanel(w: number): void {
    this.panel.position.set((w - 700) / 2, 260);

    // mask area
    this.scrollMask.clear();
    this.scrollMask.beginFill(0x000000, 1);
    // Pixi v7 supports drawRoundedRect.
    this.scrollMask.drawRoundedRect(16, 16, 700 - 32, 980 - 32, 18);
    this.scrollMask.endFill();
    this.scroll.mask = this.scrollMask;

    // Make scroll origin consistent with mask's coordinate system (avoid 16 vs 34 offset drift).
    // X aligns to mask left edge for symmetrical margins.
    this.scroll.position.set(this.scrollBaseX, this.scrollBaseY);
  }

  private layoutGrid(): void {
    const t0 = PERF_DEBUG ? this.perfNow() : 0;
    // Phase 2: skeleton placeholders for the first render (mobile feels smoother).
    if (!this.initialGridLoaded) {
      this.scroll.removeChildren();
      this.renderSkeletonGrid();
      if (!this.initialGridTimer) {
        this.initialGridTimer = setTimeout(() => {
          this.initialGridLoaded = true;
          this.initialGridTimer = null;
          this.layoutGrid();
          this.clampScroll(true, true);
        }, 140);
      }
      if (PERF_DEBUG) this.perfMark('layoutGrid(skeleton)', t0);
      return;
    }

    if (this.skeletonNodes.length) {
      for (const node of this.skeletonNodes) {
        if (node.parent) node.parent.removeChild(node);
        node.destroy({ children: true });
      }
      this.skeletonNodes = [];
    }

    const state = this.game.state.getSnapshot();
    const ownedMap = new Map(state.heroes.map((h) => [h.heroId, h] as const));
    const list = HEROES.slice();

    const rarityRank = (r: string) => (r === RARITY.SP ? 4 : r === RARITY.SSR ? 3 : r === RARITY.SR ? 2 : 1);
    list.sort((a, b) => {
      const ao = ownedMap.has(a.id) ? 1 : 0;
      const bo = ownedMap.has(b.id) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      const ar = rarityRank(a.rarity),
        br = rarityRank(b.rarity);
      if (ar !== br) return br - ar;
      return a.name.localeCompare(b.name, 'zh');
    });

    // Layout constants (match v075/v074).
    const cols = 3;
    const viewW = 700 - 32;
    const gapY = 18;
    const cardW = 214,
      cardH = 268;
    const rawGapX = Math.floor((viewW - cardW * cols) / (cols - 1));
    const gapX = clamp(rawGapX, 10, 18);

    // Reuse existing card instances; only update owned/party state and positions.
    // This avoids heavy GC + Pixi object churn when user taps party/level/star buttons.

    let maxY = 0;
    const newOrder: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const hero = list[i];
      const owned = ownedMap.get(hero.id);

      let card = this.heroCards.get(hero.id);
      if (!card) {
        card = new HeroCard(hero, owned);
        card.on('pointertap', () => {
          // Drag filter: do NOT open details if this touch cycle exceeded the drag threshold.
          if (this.moved || this.isDragging) return;
          this.openHeroModal(hero.id);
        });
        this.heroCards.set(hero.id, card);
      } else {
        // Update dynamic state only.
        card.setOwned(owned);
      }
      card.setInParty(this.game.state.isInParty(hero.id));

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cardW + gapX);
      const y = row * (cardH + gapY);
      card.position.set(x, y);

      if (card.parent !== this.scroll) {
        this.scroll.addChild(card);
      }
      newOrder.push(hero.id);
      maxY = Math.max(maxY, y + cardH);
    }

    for (let i = 0; i < newOrder.length; i++) {
      const heroId = newOrder[i];
      const card = this.heroCards.get(heroId);
      if (card) this.scroll.setChildIndex(card, i);
    }

    this.heroGridOrder = newOrder;
    this.contentHeight = maxY;
    this.updateScrollIndicator();
    if (PERF_DEBUG) this.perfMark('layoutGrid(buildCards)', t0);
  }

  private renderSkeletonGrid(): void {
    // Render skeleton placeholders to match the grid layout
    const cols = 3;
    const viewW = 700 - 32;
    const gapY = 18;
    const cardW = 214;
    const cardH = 268;
    
    const rawGapX = Math.floor((viewW - cardW * cols) / (cols - 1));
    const gapX = clamp(rawGapX, 10, 18);
    
    // Show 2 rows of skeletons (6 cards) for initial loading
    const skeletonCount = 6;
    let maxY = 0;
    
    for (let i = 0; i < skeletonCount; i++) {
      const skeleton = new SkeletonBlock(cardW, cardH, 18);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cardW + gapX);
      const y = row * (cardH + gapY);
      skeleton.position.set(x, y);
      this.scroll.addChild(skeleton);
      this.skeletonNodes.push(skeleton);
      maxY = Math.max(maxY, y + cardH);
    }
    
    this.contentHeight = maxY;
    this.updateScrollIndicator();
  }

  private clampScroll(forceTop = false, updateIndicator = false): void {
    // Visible height inside the mask, excluding top/bottom padding (18 + 18).
    const viewH = 980 - 68;
    // We keep scrolling range in the same coordinate space as scroll.position.y (baseY).
    const maxY = this.scrollBaseY;
    const minY = this.scrollBaseY + Math.min(0, viewH - this.contentHeight - 18);
    if (forceTop) {
      this.scroll.y = this.scrollBaseY;
      this.scrollVelocity = 0;
      if (updateIndicator) this.updateScrollIndicator();
      return;
    }
    this.scroll.y = clamp(this.scroll.y, minY, maxY);
    if (updateIndicator) this.updateScrollIndicator();
  }


  private updateScrollIndicator(): void {
    // Draw a simple scroll thumb when content overflows.
    const viewH = 980 - 68;
    const trackX = 700 - 18; // inside panel
    const trackY = 18;
    const trackW = 6;
    const trackH = viewH - 18;

    const overflow = Math.max(0, this.contentHeight - viewH);
    const show = overflow > 8;

    this.scrollBar.visible = show;
    this.scrollThumb.visible = show;
    if (!show) return;

    // Track
    this.scrollBar.clear();
    this.scrollBar.beginFill(0x000000, 0.18);
    this.scrollBar.drawRoundedRect(trackX, trackY, trackW, trackH, 6);
    this.scrollBar.endFill();

    // Thumb size & position
    const ratio = viewH / (this.contentHeight || viewH);
    const thumbH = Math.max(28, Math.floor(trackH * Math.min(1, ratio)));
    const maxScroll = overflow;
    const scroll = clamp((this.scrollBaseY - this.scroll.y), 0, maxScroll); // positive down
    const t = maxScroll <= 0 ? 0 : scroll / maxScroll;
    const thumbY = trackY + Math.floor((trackH - thumbH) * t);

    this.scrollThumb.clear();
    this.scrollThumb.beginFill(0xffffff, 0.45);
    this.scrollThumb.drawRoundedRect(trackX, thumbY, trackW, thumbH, 6);
    this.scrollThumb.endFill();
  }

  // ── Hero details helpers ────────────────────────────────────────────────

  private getHeroBattleStats(heroId: string): { hp: number; atk: number; def: number; spd: number } {
    const hero = HERO_MAP[heroId];
    const owned = this.game.state.getOwnedHero(heroId);
    
    if (!owned || !hero) {
      return { hp: 200, atk: 30, def: 10, spd: 90 };
    }
    
    const rarity = hero.rarity ?? RARITY.R;
    const level = Math.max(1, Math.floor(owned.level || 1));
    const stars = owned.stars || 0;
    
    return calculateHeroStats(level, rarity, stars);
  }

  private formatElementTip(element: string): { strong: string[]; weak: string[] } {
    // Keep aligned with BattleLogic element table.
    const strong: Record<string, string[]> = {
      火: ['风'],
      水: ['火'],
      风: ['水'],
      光: ['暗'],
      暗: ['光'],
    };
    const weak: Record<string, string[]> = {
      火: ['水'],
      水: ['风'],
      风: ['火'],
      光: ['暗'],
      暗: ['光'],
    };
    return { strong: strong[element] ?? [], weak: weak[element] ?? [] };
  }

  private getSkillMap(): Record<string, any> {
    const arr = (skillsJson as unknown as any[]) ?? [];
    const map: Record<string, any> = {};
    for (const s of arr) {
      if (s?.id) map[String(s.id)] = s;
    }
    return map;
  }

  private getBuffMap(): Record<string, any> {
    const arr = (buffsJson as unknown as any[]) ?? [];
    const map: Record<string, any> = {};
    for (const b of arr) {
      if (b?.id) map[String(b.id)] = b;
    }
    return map;
  }

  private formatTrigger(trigger: string): string {
    const m: Record<string, string> = {
      onBattleStart: '开战时',
      onRoundStart: '回合开始',
      onTurnStart: '行动开始',
      onBeforeAttack: '攻击前',
      onAfterAttack: '攻击后',
    };
    return m[trigger] ?? trigger;
  }

  private formatTarget(target: string): string {
    const m: Record<string, string> = {
      self: '自己',
      current: '当前目标',
      allEnemy: '全体敌人',
      allAlly: '全体队友',
      lowestAlly: '血量最低队友',
    };
    return m[target] ?? target;
  }

  private describeSkill(skill: any, buffMap: Record<string, any>): string {
    if (!skill) return '（技能数据缺失）';

    const mode = skill.mode === 'active' ? '主动' : '被动';
    const cd = typeof skill.cooldownTurns === 'number' ? Math.max(0, skill.cooldownTurns) : null;
    const pri = typeof skill.priority === 'number' ? skill.priority : null;

    const trigger = skill.trigger ? this.formatTrigger(String(skill.trigger)) : '';
    const chance = typeof skill.chance === 'number' ? skill.chance : null;

    let effect = '';
    const power = typeof skill.power === 'number' ? skill.power : null;
    const target = skill.target ? this.formatTarget(String(skill.target)) : '';

    if (skill.effectType === 'damage') {
      effect = power != null ? `造成 ${(power * 100).toFixed(0)}%ATK 伤害（目标：${target}）` : `造成伤害（目标：${target}）`;
    } else if (skill.effectType === 'heal') {
      effect = power != null ? `治疗 ${(power * 100).toFixed(0)}%ATK（目标：${target}）` : `治疗（目标：${target}）`;
    } else if (skill.effectType === 'addBuff') {
      const b = buffMap[String(skill.buffId)] ?? null;
      const bName = b?.name ? `${b.name}${b.icon ? b.icon : ''}` : String(skill.buffId ?? 'Buff');
      const dur = typeof b?.durationRounds === 'number' ? `，持续${b.durationRounds}回合` : '';
      const mod = b?.statMod
        ? `（${[
            b.statMod.atkPct != null ? `ATK+${Math.round(b.statMod.atkPct * 100)}%` : '',
            b.statMod.atkFlat != null ? `ATK+${b.statMod.atkFlat}` : '',
            b.statMod.defPct != null ? `DEF+${Math.round(b.statMod.defPct * 100)}%` : '',
            b.statMod.defFlat != null ? `DEF+${b.statMod.defFlat}` : '',
            b.statMod.spdFlat != null ? `SPD+${b.statMod.spdFlat}` : '',
            b.statMod.dmgReduce != null ? `减伤+${Math.round(b.statMod.dmgReduce * 100)}%` : '',
          ]
            .filter(Boolean)
            .join('，')}）`
        : '';
      effect = `施加 ${bName}${dur}（目标：${target}）${mod}`;
    } else {
      effect = `效果：${String(skill.effectType ?? 'unknown')}（目标：${target}）`;
    }

    if (mode === '主动') {
      const cdTxt = cd != null ? `CD:${cd}回合` : 'CD:?';
      const priTxt = pri != null ? `优先级:${pri}` : '';
      const when = trigger ? `释放时机：${trigger}` : '释放时机：行动开始';
      return `${mode}（${[cdTxt, priTxt].filter(Boolean).join('，')}） · ${when}
${effect}`;
    }

    // passive
    const chTxt = chance != null ? `概率:${Math.round(chance * 100)}%` : '';
    const triTxt = trigger ? `触发：${trigger}` : '';
    return `${mode}（${[triTxt, chTxt].filter(Boolean).join('，')}）
${effect}`;
  }

  private buildHeroDetailText(heroId: string): { stats: string; element: string; skills: Array<{ title: string; body: string }>; counter: string } {
    const hero = HERO_MAP[heroId];
    const owned = this.game.state.getOwnedHero(heroId);
    const stats = this.getHeroBattleStats(heroId);

    const element = hero?.element ?? '未知';
    const { strong, weak } = this.formatElementTip(element);

    const skillIds: string[] = (hero?.skills ?? []).slice();
    const skillMap = this.getSkillMap();
    const buffMap = this.getBuffMap();

    const skills = skillIds.map((sid) => {
      const s = skillMap[sid];
      const title = s?.name ? String(s.name) : sid;
      const body = this.describeSkill(s, buffMap);
      return { title, body };
    });

    const strongTxt = strong.length ? `克制：${strong.join('、')}` : '克制：-';
    const weakTxt = weak.length ? `被克制：${weak.join('、')}` : '被克制：-';

    const counter = `${strongTxt}    ${weakTxt}`;

    const statsLine = `HP ${stats.hp}   ATK ${stats.atk}   DEF ${stats.def}   SPD ${stats.spd}`;
    const elementLine = `元素：${element}   稀有度：${rarityLabel(hero?.rarity ?? RARITY.R)}   星级：${owned ? Math.max(1, owned.stars || 0) : 1}★   等级：${owned ? owned.level : '-'}`;

    return { stats: `${elementLine}
${statsLine}`, element, skills, counter };
  }

  private openHeroModal(heroId: string): void {
    const t0 = PERF_DEBUG ? this.perfNow() : 0;
    if (!heroId) {
      this.game.toast.show('英雄ID缺失，无法打开详情。', 2);
      return;
    }
    const hero = HERO_MAP[heroId];
    if (!hero) {
      this.game.toast.show('英雄数据缺失，无法打开详情。', 2);
      return;
    }
    const modal = this.game.modal;
    modal.open();

    this.ensureHeroModalBuilt();
    this.updateHeroModal(heroId);
    if (PERF_DEBUG) this.perfMark('openHeroModal', t0);
  }

  private updateHeroModal(heroId: string): void {
    // If no modal refs or different hero, fall back to full rebuild.
    if (!this.heroModalRefs || this.heroModalRefs.heroId !== heroId) {
      this.ensureHeroModalBuilt();
    }

    const t0 = PERF_DEBUG ? this.perfNow() : 0;
    const owned = this.game.state.getOwnedHero(heroId);
    const stats = this.getHeroStats(heroId);
    const refs: any = this.heroModalRefs;
    const hero = HERO_MAP[heroId];
    if (!hero || !refs) return;
    refs.heroId = heroId;

    // Update stat values
    try {
      refs.statValueTexts.hp.text = String(stats.hp);
      refs.statValueTexts.atk.text = String(stats.atk);
      refs.statValueTexts.def.text = String(stats.def);
      refs.statValueTexts.spd.text = String(stats.spd);
    } catch {
      // If something unexpected happened (refs invalid), rebuild.
      this.openHeroModal(heroId);
      return;
    }

    // Update button labels/hints
    const ownedOk = !!owned;
    const lv = ownedOk ? (owned.level || 1) : 1;
    const starsEff = ownedOk ? Math.max(1, owned.stars || 0) : 1;
    const shardKey = ECONOMY.dupeShardKey;
    const shardCount = this.game.state.getInventory(shardKey);
    const starCostMap: Record<number, number> = { 1: 20, 2: 50, 3: 100, 4: 200 };

    if (refs.btnParty && typeof refs.btnParty.setLabel === 'function') {
      refs.btnParty.setLabel(this.game.state.isInParty(heroId) ? '下阵' : '上阵');
    }
    if (refs.btnLevel && typeof refs.btnLevel.setLabel === 'function') {
      refs.btnLevel.setLabel('升级');
    }
    if (refs.btnStar && typeof refs.btnStar.setLabel === 'function') {
      refs.btnStar.setLabel(ownedOk ? `升星 ${starsEff}★→${Math.min(5, starsEff + 1)}★` : '升星');
    }

    if (refs.starHintText) {
      if (!ownedOk) {
        refs.starHintText.text = '获得后可升星（消耗万能碎片）';
      } else if (starsEff >= 5) {
        refs.starHintText.text = `消耗碎片：已满星（拥有：${shardCount}）`;
      } else {
        const need = starCostMap[starsEff] ?? 0;
        refs.starHintText.text = `消耗碎片：${need}（拥有：${shardCount}）`;
      }
    }
    if (refs.costHintText) {
      if (!ownedOk) refs.costHintText.text = '获得后可升级（消耗金币）';
      else refs.costHintText.text = `升级消耗：🪙 ${ECONOMY.levelUpGoldBase + Math.floor((owned.level - 1) * 18)}`;
    }
    if (refs.ownedMarkText) {
      refs.ownedMarkText.text = `${GAME_VERSION} · build ${BUILD_TIME}`;
    }
    if (refs.titleText) {
      refs.titleText.text = hero.name;
    }
    if (refs.pillTexts) {
      refs.pillTexts.element.text = `元素：${hero.element}`;
      refs.pillTexts.rarity.text = `稀有：${rarityLabel(hero.rarity)}`;
      refs.pillTexts.stars.text = `${starsEff}★`;
      refs.pillTexts.level.text = ownedOk ? `Lv.${owned.level}` : 'Lv.-';
    }
    const detail = this.buildHeroDetailText(heroId);
    if (refs.counterText) {
      refs.counterText.text = detail.counter;
    }
    this.updateHeroModalSkills(detail);
    this.updateHeroModalCard(heroId);
    this.refreshModalButtons(heroId);
    if (refs.unsubs && refs.unsubs.length === 0) {
      refs.unsubs.push(this.game.state.on('inventoryChanged', () => this.refreshModalButtons(refs.heroId)));
      refs.unsubs.push(this.game.state.on('currencyChanged', () => this.refreshModalButtons(refs.heroId)));
      refs.unsubs.push(this.game.state.on('partyChanged', () => this.refreshModalButtons(refs.heroId)));
      refs.unsubs.push(this.game.state.on('heroesChanged', () => this.updateHeroModal(refs.heroId)));
    }
    if (PERF_DEBUG) this.perfMark('updateHeroModal', t0);
  }

  private ensureHeroModalBuilt(): void {
    if (this.heroModalRefs) return;
    const modal = this.game.modal;
    modal.content.removeChildren();
    modal.content.sortableChildren = true;
    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const pad = 28;
    const footerH = 260;
    const bodyW = panelW - pad * 2;

    const header = new Container();
    header.position.set(0, 0);

    const title = createText('', 34, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 58);
    header.addChild(title);

    const cardSlot = new Container();
    cardSlot.position.set(0, 0);

    const bodyY = 118 + 268 * 1.15 + 18;
    const bodyH = Math.max(240, panelH - footerH - bodyY - pad);
    const bodyPanel = drawPanel(bodyW, bodyH, 0.82);
    bodyPanel.position.set(pad, bodyY);

    const scrollPad = 18;
    const scrollW = bodyW - scrollPad * 2;
    const scrollH = bodyH - scrollPad * 2;
    const scroll = new ScrollView(scrollW, scrollH);
    scroll.position.set(scrollPad, scrollPad);
    bodyPanel.addChild(scroll);

    let y = 0;
    const statsTitle = createText('属性', 22, 0xffffff, '900');
    statsTitle.position.set(0, y);
    scroll.content.addChild(statsTitle);
    y += 34;

    const makeStatCell = (label: string, x: number, yy: number) => {
      const cellW = Math.floor((scrollW - 14) / 2);
      const cellH = 74;
      const g = new Graphics();
      g.beginFill(0x0b1630, 0.62);
      g.lineStyle(2, 0x2a4f7a, 0.6);
      g.drawRoundedRect(0, 0, cellW, cellH, 16);
      g.endFill();
      g.position.set(x, yy);
      const t1 = createText(label, 16, 0x9fe6ff, '900');
      t1.position.set(14, 12);
      const t2 = createText('--', 24, 0xffffff, '900');
      t2.position.set(14, 36);
      g.addChild(t1, t2);
      return { g, valueText: t2 };
    };

    const statCells = {
      hp: makeStatCell('HP', 0, y),
      atk: makeStatCell('ATK', Math.floor((scrollW + 14) / 2), y),
      def: makeStatCell('DEF', 0, y + 84),
      spd: makeStatCell('SPD', Math.floor((scrollW + 14) / 2), y + 84),
    };
    scroll.content.addChild(statCells.hp.g, statCells.atk.g, statCells.def.g, statCells.spd.g);
    y += 84 * 2 + 18;

    const metaTitle = createText('标签', 22, 0xffffff, '900');
    metaTitle.position.set(0, y);
    scroll.content.addChild(metaTitle);
    y += 34;

    const makePill = (x: number, yy: number, fill: number) => {
      const g = new Graphics();
      g.beginFill(fill, 0.35);
      g.lineStyle(2, fill, 0.55);
      g.drawRoundedRect(0, 0, 160, 48, 24);
      g.endFill();
      g.position.set(x, yy);
      const t = createText('', 18, 0xffffff, '900');
      t.anchor.set(0.5);
      t.position.set(80, 24);
      g.addChild(t);
      return { g, text: t };
    };

    const rowY = y;
    const p1 = makePill(0, rowY, 0x52a7ff);
    const p2 = makePill(172, rowY, 0xc46cff);
    const p3 = makePill(0, rowY + 56, 0xffb400);
    const p4 = makePill(172, rowY + 56, 0x8fffa3);
    scroll.content.addChild(p1.g, p2.g, p3.g, p4.g);
    y += 56 * 2 + 18;

    const counterTitle = createText('克制关系', 22, 0xffffff, '900');
    counterTitle.position.set(0, y);
    scroll.content.addChild(counterTitle);
    y += 34;

    const counterBox = new Graphics();
    counterBox.beginFill(0x0b1630, 0.52);
    counterBox.lineStyle(2, 0x2a4f7a, 0.55);
    counterBox.drawRoundedRect(0, 0, scrollW, 64, 16);
    counterBox.endFill();
    const counterText = createText('', 18, 0xffe3a3, '800');
    counterText.position.set(16, 18);
    counterText.style.wordWrap = true;
    counterText.style.wordWrapWidth = scrollW - 32;
    counterBox.addChild(counterText);
    counterBox.position.set(0, y);
    scroll.content.addChild(counterBox);
    y += 64 + 18;

    const skillTitle = createText('技能', 22, 0xffffff, '900');
    skillTitle.position.set(0, y);
    scroll.content.addChild(skillTitle);
    y += 34;

    const maxSkills = HEROES.reduce((max, h) => Math.max(max, (h.skills || []).length), 0);
    const skillItems: Array<{ box: Graphics; titleText: any; bodyText: any }> = [];
    for (let i = 0; i < Math.max(1, maxSkills); i++) {
      const box = new Graphics();
      box.beginFill(0x0b1630, 0.58);
      box.lineStyle(2, 0x2a4f7a, 0.6);
      box.drawRoundedRect(0, 0, scrollW, 92, 16);
      box.endFill();
      const t = createText('', 20, 0x9fe6ff, '900');
      t.position.set(16, 14);
      const b = createText('', 17, 0xcfe3ff, '700');
      b.position.set(16, 44);
      b.style.wordWrap = true;
      b.style.wordWrapWidth = scrollW - 32;
      b.style.lineHeight = 22;
      box.addChild(t, b);
      box.position.set(0, y);
      scroll.content.addChild(box);
      skillItems.push({ box, titleText: t, bodyText: b });
      y += 92 + 12;
    }

    y += 30;
    scroll.setContentHeight(y);

    const footer = new Container();
    footer.position.set(0, panelH - footerH);
    const footerBg = new Graphics();
    footerBg.beginFill(0x08122a, 0.55);
    footerBg.drawRect(0, 0, panelW, footerH);
    footerBg.endFill();
    footer.addChild(footerBg);

    const btnClose = new UIButton('关闭', 240, 80);
    btnClose.zIndex = 100;
    btnClose.position.set(pad, footerH - 98);
    btnClose.on('pointertap', () => modal.close());

    const btnLevel = new UIButton('升级', 240, 80);
    btnLevel.zIndex = 101;
    btnLevel.position.set(panelW - pad - 240, footerH - 98);
    btnLevel.on('pointertap', () => this.handleLevelUp());

    const btnParty = new UIButton('上阵', 240, 80);
    btnParty.zIndex = 102;
    btnParty.position.set(pad, 24);
    btnParty.on('pointertap', () => this.handleToggleParty());

    const btnStar = new UIButton('升星', 240, 80);
    btnStar.zIndex = 102;
    btnStar.position.set(panelW - pad - 240, 24);
    btnStar.on('pointertap', () => this.handleStarUp());

    const starHint = createText('获得后可升星（消耗万能碎片）', 18, 0xffe3a3, '800');
    starHint.anchor.set(0.5);
    starHint.position.set(panelW / 2, 128);

    const costHint = createText('获得后可升级（消耗金币）', 18, 0xffe3a3, '800');
    costHint.anchor.set(0.5);
    costHint.position.set(panelW / 2, 154);

    const vMark = createText(`${GAME_VERSION} · build ${BUILD_TIME}`, 14, 0x8fb3ff, '700');
    vMark.anchor.set(0, 1);
    vMark.position.set(24, footerH - 10);

    footer.addChild(btnParty, btnStar, btnClose, btnLevel, starHint, costHint, vMark);

    modal.content.addChild(header, cardSlot, bodyPanel, footer);

    const prevOnClose = modal.onClose;
    modal.onClose = () => {
      this.heroModalRefs?.unsubs?.forEach((u) => {
        try { u(); } catch (_) {}
      });
      if (this.heroModalRefs) this.heroModalRefs.unsubs = [];
      modal.onClose = prevOnClose;
      prevOnClose?.();
    };

    this.heroModalRefs = {
      heroId: '',
      statValueTexts: {
        hp: statCells.hp.valueText,
        atk: statCells.atk.valueText,
        def: statCells.def.valueText,
        spd: statCells.spd.valueText,
      },
      btnParty,
      btnLevel,
      btnStar,
      starHintText: starHint,
      costHintText: costHint,
      ownedMarkText: vMark,
      titleText: title,
      pillTexts: {
        element: p1.text,
        rarity: p2.text,
        stars: p3.text,
        level: p4.text,
      },
      counterText,
      scroll,
      scrollW,
      skillItems,
      cardSlot,
      card: undefined,
      cardTextRefs: undefined,
      unsubs: [],
    };
  }

  private updateHeroModalCard(heroId: string): void {
    const refs = this.heroModalRefs;
    if (!refs?.cardSlot) return;
    const hero = HERO_MAP[heroId];
    const owned = this.game.state.getOwnedHero(heroId);
    if (!hero) return;

    if (!refs.card || (refs.card as any).hero?.id !== heroId) {
      refs.cardSlot.removeChildren();
      const card = new HeroCard(hero, owned);
      const cardScale = 1.15;
      card.scale.set(cardScale);
      card.position.set((this.game.modal.panel.width - card.w * cardScale) / 2, 118);

      const cover = new Graphics();
      cover.beginFill(0x0b1630, 0.78);
      cover.drawRoundedRect(8, card.h - 82, card.w - 16, 74, 12);
      cover.endFill();
      card.addChild(cover);

      const nameLine = createText(hero.name, 24, 0xffffff, '900');
      nameLine.anchor.set(0, 0);
      nameLine.position.set(18, card.h - 76);

      const metaLine = createText('', 18, 0xd7e6ff, '800');
      metaLine.anchor.set(0, 0);
      metaLine.position.set(18, card.h - 44);

      const lvLine = createText('', 20, 0xffe3a3, '900');
      lvLine.anchor.set(1, 0);
      lvLine.position.set(card.w - 18, card.h - 60);

      card.addChild(nameLine, metaLine, lvLine);
      refs.cardSlot.addChild(card);
      refs.card = card;
      refs.cardTextRefs = { nameLine, metaLine, lvLine };
    }

    const starsShow = owned ? Math.max(1, owned.stars || 0) : 1;
    refs.card?.setOwned(owned || undefined);
    refs.card?.setInParty(this.game.state.isInParty(heroId));

    if (refs.cardTextRefs) {
      refs.cardTextRefs.nameLine.text = hero.name;
      refs.cardTextRefs.metaLine.text = `${hero.element} · ${rarityLabel(hero.rarity)} · ${starsShow}★`;
      refs.cardTextRefs.lvLine.text = owned ? `Lv.${owned.level}` : 'Lv.-';

      const maxNameW = (refs.card?.w ?? 0) - 18 - 18 - 86;
      const raw = String(refs.cardTextRefs.nameLine.text ?? '');
      if (raw && refs.cardTextRefs.nameLine.width > maxNameW) {
        let t = raw;
        while (t.length > 1) {
          t = t.slice(0, -1);
          refs.cardTextRefs.nameLine.text = t + '…';
          if (refs.cardTextRefs.nameLine.width <= maxNameW) break;
        }
      }
    }
  }

  private updateHeroModalSkills(detail: { skills: Array<{ title: string; body: string }> }): void {
    const refs = this.heroModalRefs;
    if (!refs?.skillItems || !refs.scroll || !refs.scrollW) return;
    const skills = detail.skills.length ? detail.skills : [{ title: '暂无技能', body: '暂无技能（占位）' }];
    let y = 0;
    const statsOffset = 34 + 84 * 2 + 18;
    const metaOffset = 34 + 56 * 2 + 18;
    const counterOffset = 34 + 64 + 18;
    const skillsHeaderOffset = 34;
    y = statsOffset + metaOffset + counterOffset + skillsHeaderOffset;

    for (let i = 0; i < refs.skillItems.length; i++) {
      const item = refs.skillItems[i];
      const data = skills[i];
      if (!data) {
        item.box.visible = false;
        continue;
      }
      item.box.visible = true;
      item.titleText.text = String(data.title);
      item.bodyText.text = String(data.body);
      const h = Math.max(92, 44 + item.bodyText.height + 16);
      item.box.clear();
      item.box.beginFill(0x0b1630, 0.58);
      item.box.lineStyle(2, 0x2a4f7a, 0.6);
      item.box.drawRoundedRect(0, 0, refs.scrollW, h, 16);
      item.box.endFill();
      item.box.addChild(item.titleText, item.bodyText);
      item.box.position.set(0, y);
      y += h + 12;
    }

    y += 30;
    refs.scroll.setContentHeight(y);
  }

  private refreshModalButtons(heroId: string): void {
    const refs = this.heroModalRefs;
    if (!refs || !refs.btnParty || !refs.btnLevel || !refs.btnStar) return;

    const snapNow = this.game.state.getSnapshot();
    const ownedNow = snapNow.heroes.find((h) => h.heroId === heroId);
    const goldNow = snapNow.gold || 0;
    const shardKey = ECONOMY.dupeShardKey;
    const shardsNow = snapNow.inventory[shardKey] || 0;

    const inPartyNow = this.game.state.isInParty(heroId);
    const partyCountNow = (this.game.state.partyHeroIds ?? []).length;
    refs.btnParty.setLabel(inPartyNow ? '下阵' : '上阵');
    if (!ownedNow) {
      refs.btnParty.setDisabled(false);
    } else {
      refs.btnParty.setDisabled(!inPartyNow && partyCountNow >= 5);
    }

    if (!ownedNow) {
      refs.btnLevel.setDisabled(true);
    } else {
      const lvlCost = ECONOMY.levelUpGoldBase + Math.floor((ownedNow.level - 1) * 18);
      refs.btnLevel.setDisabled(goldNow < lvlCost);
    }

    if (!ownedNow) {
      refs.btnStar.setDisabled(false);
    } else {
      const curStarsNow = Math.max(1, ownedNow.stars || 0);
      if (curStarsNow >= 5) {
        refs.btnStar.setLabel('已满星（5★）');
        refs.btnStar.setDisabled(true);
      } else {
        const starCostMap: Record<number, number> = { 1: 20, 2: 50, 3: 100, 4: 200 };
        const need = starCostMap[curStarsNow] ?? 0;
        refs.btnStar.setLabel(`升星 ${curStarsNow}★→${Math.min(5, curStarsNow + 1)}★`);
        refs.btnStar.setDisabled(shardsNow < need);
      }
    }
  }

  private handleToggleParty(): void {
    const heroId = this.heroModalRefs?.heroId;
    if (!heroId) return;
    const t0 = PERF_DEBUG ? this.perfNow() : 0;
    const owned = this.game.state.getOwnedHero(heroId);
    if (!owned) {
      this.game.toast.show('未拥有该英雄，无法上阵。', 2);
      return;
    }
    const tState = PERF_DEBUG ? this.perfNow() : 0;
    const res = this.game.state.toggleParty(heroId);
    if (PERF_DEBUG) this.perfMark('toggleParty(state)', tState);
    if (!res.ok) {
      this.game.toast.show(res.reason ?? '操作失败', 2);
      return;
    }
    this.game.toast.show(this.game.state.isInParty(heroId) ? '已上阵' : '已下阵', 2);
    const tUi = PERF_DEBUG ? this.perfNow() : 0;
    this.scheduleRefresh('toggleParty');
    this.updateHeroModal(heroId);
    if (PERF_DEBUG) this.perfMark('toggleParty(ui)', tUi);
    if (PERF_DEBUG) this.perfMark('toggleParty(total)', t0);
  }

  private handleLevelUp(): void {
    const heroId = this.heroModalRefs?.heroId;
    if (!heroId) return;
    const owned = this.game.state.getOwnedHero(heroId);
    if (!owned) {
      this.game.toast.show('未拥有该英雄，无法升级。', 2);
      return;
    }
    const tState = PERF_DEBUG ? this.perfNow() : 0;
    const cost = ECONOMY.levelUpGoldBase + Math.floor((owned.level - 1) * 18);
    const res = this.game.state.tryLevelUpHero(heroId, cost, ECONOMY.levelCap);
    if (PERF_DEBUG) this.perfMark('levelUp(state)', tState);
    if (!res.ok) {
      this.game.toast.show(res.reason || '升级失败', 2);
      return;
    }
    const tUi = PERF_DEBUG ? this.perfNow() : 0;
    this.updateHeroModal(heroId);
    this.scheduleRefresh('levelUp');
    if (PERF_DEBUG) this.perfMark('levelUp(ui)', tUi);
  }

  private handleStarUp(): void {
    const heroId = this.heroModalRefs?.heroId;
    if (!heroId) return;
    const owned = this.game.state.getOwnedHero(heroId);
    if (!owned) {
      this.game.toast.show('未拥有该英雄，无法升星。', 2);
      return;
    }
    const tState = PERF_DEBUG ? this.perfNow() : 0;
    const curStars = Math.max(1, owned.stars || 0);
    if (curStars >= 5) {
      this.game.toast.show('已满星。', 2);
      return;
    }
    const shardKey = ECONOMY.dupeShardKey;
    const starCostMap: Record<number, number> = { 1: 20, 2: 50, 3: 100, 4: 200 };
    const cost = starCostMap[curStars] ?? 0;
    if (cost <= 0) {
      this.game.toast.show('升星配置异常。', 2);
      return;
    }
    if (!this.game.state.tryConsumeInventory(shardKey, cost)) {
      this.game.toast.show('碎片不足。', 2);
      return;
    }

    const snap = this.game.state.getSnapshot();
    const heroesNext = snap.heroes.map((h) =>
      h.heroId === heroId ? { ...h, stars: curStars + 1 } : h,
    );
    this.game.state.update({ heroes: heroesNext });
    if (PERF_DEBUG) this.perfMark('starUp(state)', tState);

    this.game.toast.show(`升星成功：${curStars + 1}★`, 2);
    const tUi = PERF_DEBUG ? this.perfNow() : 0;
    this.updateHeroModal(heroId);
    this.scheduleRefresh('starUp');
    if (PERF_DEBUG) this.perfMark('starUp(ui)', tUi);
  }


  // Phase 2: refreshed by subscriptions.
  public refresh(): void {
    const t0 = PERF_DEBUG ? this.perfNow() : 0;
    const partyCount = Math.max(0, this.game.state.partyHeroIds?.length ?? 0);
    if (this.partyText && !(this.partyText as any).destroyed) {
      this.partyText.text = `队伍：${partyCount}/5`;
    }

    this.layoutGrid();
    this.clampScroll(true, true);
    if (PERF_DEBUG) this.perfMark('refresh(total)', t0);
  }

  /**
   * Calculate hero stats based on level and rarity
   * (Uses unified stats calculator)
   */
  private getHeroStats(heroId: string): { hp: number; atk: number; def: number; spd: number } {
    const owned = this.game.state.getOwnedHero(heroId);
    const heroDef = HERO_MAP[heroId];
    
    if (!owned || !heroDef) {
      // Fallback for missing data
      return { hp: 200, atk: 30, def: 10, spd: 90 };
    }

    const level = Math.max(1, Math.floor(owned.level || 1));
    const rarity = heroDef.rarity ?? RARITY.R;
    const stars = owned.stars || 0;
    
    return calculateHeroStats(level, rarity, stars);
  }

}
