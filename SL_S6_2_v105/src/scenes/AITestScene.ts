import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import UIButton from '../ui/components/UIButton';
import ScrollView from '../ui/components/ScrollView';
import { createText } from '../ui/uiFactory';
import { PopupLayers } from '../ui/PopupLayers';
import { formatDiagnosticsReport, runDiagnostics } from '../tools/Diagnostics';
import { GAME_VERSION } from '../game/version';

function safeCopyText(text: string): boolean {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      void navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    (window as any).prompt('复制下面内容：', text);
    return true;
  } catch (_) {
    return false;
  }
}

async function deepseekAnalyze(opts: { apiKey: string; bundleText: string }): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      stream: false,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是资深游戏QA+工程师。只基于我提供的REPORT/SNAPSHOT/LOG分析，禁止臆测。' +
            '输出严格JSON（不要markdown，不要多余文字），结构：' +
            '{"severity":"low|medium|high|critical","suspects":[{"area":"","reason":"","evidence":"","confidence":0.0}],"repro_steps":[""],"fixes":[""],"missing_info":[""]}',
        },
        { role: 'user', content: opts.bundleText },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DeepSeek HTTP ${res.status} ${t}`);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? '');
}

export default class AITestScene extends BaseScene {
  private readonly game: GameApp;

  private readonly title;
  private readonly desc;
  private readonly btnCopy;
  private readonly btnDiag;
  private readonly btnAi;
  private readonly btnClearKey;
  private readonly preview;

  constructor(game: GameApp) {
    super('aitest');
    this.game = game;

    this.title = createText('AI 测试', 44, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    this.desc = createText('把一键包/AI分析结果复制发我，我来定位修复 ✅', 20, 0xcfe3ff, '700');
    this.desc.anchor.set(0.5);
    this.root.addChild(this.desc);

    this.btnCopy = new UIButton('📋 复制一键包（REPORT+SNAPSHOT+LOG）', 560, 86);
    this.btnDiag = new UIButton('🧪 仅本地诊断（不联网）', 560, 82);
    this.btnAi = new UIButton('🤖 AI 分析（DeepSeek·Reasoner）', 560, 82);
    this.btnClearKey = new UIButton('🔑 清除 DeepSeek Key', 560, 72);

    this.preview = createText('', 18, 0xe6f2ff, '600');
    (this.preview.style as any).wordWrap = true;
    (this.preview.style as any).wordWrapWidth = 680;
    this.preview.anchor.set(0, 0);

    this.root.addChild(this.btnCopy, this.btnDiag, this.btnAi, this.btnClearKey);

    this.btnCopy.on('pointertap', () => {
      const bundle = this.buildBundle();
      const ok = safeCopyText(bundle);
      this.game.toast.show(ok ? '已复制：直接粘贴给我即可' : '复制失败：请手动复制', 2);
    });

    this.btnDiag.on('pointertap', () => {
      const report = this.buildDiagnosticsReport();
      this.openTextModal('诊断报告（本地）', report);
    });

    this.btnClearKey.on('pointertap', () => {
      try {
        sessionStorage.removeItem('deepseek_api_key');
      } catch (_) {}
      this.game.toast.show('已清除 Key（下次会重新输入）', 2);
    });

    this.btnAi.on('pointertap', async () => {
      const key = this.getOrAskKey();
      if (!key) {
        this.game.toast.show('未输入 Key', 2);
        return;
      }
      const bundle = this.buildBundle();
      this.game.toast.show('请求中…（如跨域/CORS失败会提示）', 2);
      try {
        const out = await deepseekAnalyze({ apiKey: key, bundleText: bundle });
        this.openTextModal('AI 分析结果（复制发我）', out || '(空输出)');
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        this.openTextModal('AI 调用失败', msg);
      }
    });
  }

  private getOrAskKey(): string | null {
    try {
      const cached = sessionStorage.getItem('deepseek_api_key');
      if (cached && String(cached).trim()) return String(cached).trim();
    } catch (_) {}
    const v = (window as any).prompt('请输入 DeepSeek API Key（仅本次会话缓存，不写存档）:', '');
    const key = String(v ?? '').trim();
    if (!key) return null;
    try {
      sessionStorage.setItem('deepseek_api_key', key);
    } catch (_) {}
    return key;
  }

  private buildDiagnosticsReport(): string {
    const r = runDiagnostics(this.game.state);
    const report = formatDiagnosticsReport(r, GAME_VERSION);
    // Also log once for tracing
    try {
      this.game.debug.info('DIAG', 'report', { errors: r.errors.length, warnings: r.warnings.length });
    } catch (_) {}
    return report;
  }

  private buildBundle(): string {
    const report = this.buildDiagnosticsReport();
    const snap = this.game.state.getSnapshot();
    const log = this.game.debug.getText();
    return [
      report,
      '',
      '=== SNAPSHOT(JSON) ===',
      JSON.stringify(snap),
      '',
      '=== DEBUG LOG ===',
      log,
    ].join('\n');
  }

  private openTextModal(title: string, text: string): void {
    const w = 720;
    const h = 860;
    const layer = this.game.modal.useLayer(PopupLayers.AI_TEST, true);
    this.game.modal.open();

    const tTitle = createText(title, 28, 0xffffff, '900');
    tTitle.anchor.set(0.5);
    tTitle.position.set(w / 2, 44);
    layer.addChild(tTitle);

    const btnCopy = new UIButton('复制', 170, 56);
    btnCopy.position.set(w - 190, 22);
    btnCopy.on('pointertap', () => {
      const ok = safeCopyText(text);
      this.game.toast.show(ok ? '已复制' : '复制失败', 2);
    });
    layer.addChild(btnCopy);

    const scroll = new ScrollView(w - 60, h - 170);
    scroll.position.set(30, 90);
    layer.addChild(scroll);

    const content = createText(text, 18, 0xe6f2ff, '600');
    (content.style as any).wordWrap = true;
    (content.style as any).wordWrapWidth = w - 90;
    content.anchor.set(0, 0);
    content.position.set(0, 0);
    scroll.content.addChild(content);
    scroll.setContentHeight(Math.max(h - 170, content.height + 20));

    const btnClose = new UIButton('关闭', 170, 56);
    btnClose.position.set(w / 2 - 85, h - 68);
    btnClose.on('pointertap', () => this.game.modal.close());
    layer.addChild(btnClose);
  }

  public override onEnter(): void {
    // Preview last lines on enter
    const lines = this.game.debug.getText().split('\n');
    const tail = lines.slice(-30).join('\n');
    this.preview.text = tail ? `最近日志预览（30行）：\n${tail}` : '暂无日志';
    this.root.addChild(this.preview);
  }

  public override onExit(): void {
    // noop
  }

  public override onResize(w: number, h: number): void {
    this.title.position.set(w / 2, 200);
    this.desc.position.set(w / 2, 260);

    const btnW = Math.min(560, w - 120);
    // UIButton 不支持 resize：这里仅做居中摆放
    this.btnCopy.position.set((w - btnW) / 2, 330);
    this.btnDiag.position.set((w - btnW) / 2, 440);
    this.btnAi.position.set((w - btnW) / 2, 540);
    this.btnClearKey.position.set((w - btnW) / 2, 640);

    this.preview.position.set(60, 740);
    (this.preview.style as any).wordWrapWidth = w - 120;
  }
}
