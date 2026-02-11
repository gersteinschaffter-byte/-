import { utils } from 'pixi.js';
import GameApp from './core/GameApp';
import HomeScene from './scenes/HomeScene';
import SummonScene from './scenes/SummonScene';
import HeroesScene from './scenes/HeroesScene';
import BagScene from './scenes/BagScene';
import BattleScene from './scenes/BattleScene';
import FormationScene from './scenes/FormationScene';
import { validateConfigs, formatValidationReport } from './game/configValidator';
import { PopupLayers } from './ui/PopupLayers';
import ScrollView from './ui/components/ScrollView';
import UIButton from './ui/components/UIButton';
import { createText } from './ui/uiFactory';
// Boot guard: show a friendly error on devices that cannot run WebGL.
// (This also helps when debugging inside Android WebView.)
try {
    if (typeof utils?.isWebGLSupported === 'function' && !utils.isWebGLSupported()) {
        window.__SHOW_BOOT_ERROR__?.('当前浏览器似乎不支持 WebGL，PixiJS 无法渲染。建议换 Chrome/Edge，或在系统设置里开启 WebGL/硬件加速。');
    }
}
catch (_) {
    // ignore
}
const game = new GameApp({ mountId: 'game', rotateTipId: 'rotateTip' });
// ------------------------------
// Config validation (engineering)
// ------------------------------
// Validate JSON configs early so balancing mistakes are caught immediately.
try {
    const report = validateConfigs();
    if (report.errors.length > 0 || report.warnings.length > 0) {
        // Show popup only when there are issues.
        game.modal.openLayer(PopupLayers.CONFIG_VALIDATION, (layer) => {
            const w = game.modal.panel.width;
            const h = game.modal.panel.height;
            const title = createText('配置校验报告', 34, 0xffffff, '900');
            title.anchor.set(0.5);
            title.position.set(w / 2, 90);
            const summary = createText(`错误 ${report.errors.length}  ·  警告 ${report.warnings.length}`, 20, 0xffffff, '700');
            summary.anchor.set(0.5);
            summary.alpha = 0.85;
            summary.position.set(w / 2, 132);
            // Build scrollable list
            const list = new ScrollView(w - 80, h - 260);
            list.position.set(40, 160);
            const reportText = formatValidationReport(report);
            const lines = reportText.split('\n');
            let y = 0;
            for (const line of lines) {
                const t = createText(line, 16, 0xffffff, '600');
                t.anchor.set(0, 0);
                t.alpha = line.startsWith('Errors:') || line.startsWith('Warnings:') || line.startsWith('---') ? 0.9 : 0.82;
                t.position.set(0, y);
                list.content.addChild(t);
                y += 22;
            }
            // Ensure scroll range
            list.setContentHeight(Math.max(h - 260, y + 10));
            const btnCopy = new UIButton('复制报告', 170, 56);
            btnCopy.position.set(w / 2 - 190, h - 84);
            btnCopy.on('pointertap', async () => {
                try {
                    await navigator.clipboard.writeText(reportText);
                    game.toast.show('已复制到剪贴板 ✅');
                }
                catch (_) {
                    // Fallback: prompt
                    try {
                        window.prompt('复制下面内容：', reportText);
                    }
                    catch (_) { }
                }
            });
            const btnContinue = new UIButton('继续进入', 170, 56);
            btnContinue.position.set(w / 2 + 20, h - 84);
            btnContinue.on('pointertap', () => game.modal.close());
            // If there are errors, keep modal open by default.
            // Users can still continue for quick preview/testing.
            layer.addChild(title, summary, list, btnCopy, btnContinue);
        });
    }
}
catch (e) {
    console.warn('[ConfigValidation] failed:', e);
}
// Register scenes (phase 1: keep MVP scenes)
const home = new HomeScene(game);
const summon = new SummonScene(game);
const heroes = new HeroesScene(game);
const formation = new FormationScene(game);
const bag = new BagScene(game);
const battle = new BattleScene(game);
game.registerScenes({
    home,
    summon,
    heroes,
    formation,
    bag,
    battle,
});
// Bind navigation (bottom nav) — ★ v0.82: 启用过渡动画
game.bottomNav.bind((key) => game.goTo(key));
// Start from home
game.goTo('home', { animate: false });
// Main loop
game.pixi.ticker.add((dt) => game.tick(dt));
// Initial layout
game.applyScale();
