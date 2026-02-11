import { Container, Graphics, Text } from 'pixi.js';
import UIButton from './UIButton';
import { createText, drawPanel } from '../uiFactory';
import { PopupLayers } from '../PopupLayers';
import { copyToClipboard } from '../copyToClipboard';
import { theme } from '../theme';
import { getDirectorApiKey, setDirectorApiKey } from '../../game/director';
/**
 * On-device debug panel.
 *
 * Designed for non-coders:
 * - view key game state
 * - run common actions (add currency, jump stage, reset save)
 * - copy logs for bug reports
 */
export function openDevPanel(game) {
    game.modal.openLayer(PopupLayers.DEBUG_PANEL, (layer) => {
        const root = new Container();
        layer.addChild(root);
        const w = Math.min(600, (game.modal.panel.width || 640) - 40);
        const h = Math.min(840, (game.modal.panel.height || 980) - 120);
        const panel = drawPanel(w, h, 0.98);
        root.addChild(panel);
        const content = new Container();
        panel.addChild(content);
        const title = createText('🛠 调试面板', 30, theme.colors.text.primary, '900');
        title.position.set(28, 22);
        content.addChild(title);
        const subtitle = createText('仅用于测试：可复制日志发我定位问题', 18, theme.colors.text.secondary, '700');
        subtitle.position.set(28, 62);
        content.addChild(subtitle);
        // --- Info block ---
        const infoBg = new Graphics();
        infoBg.beginFill(0x000000, 0.22);
        infoBg.drawRoundedRect(24, 100, w - 48, 210, 18);
        infoBg.endFill();
        content.addChild(infoBg);
        const infoText = new Text('', {
            fontSize: 18,
            fill: 0xeaf3ff,
            fontWeight: '700',
            wordWrap: true,
            wordWrapWidth: w - 70,
            lineHeight: 26,
        });
        infoText.position.set(36, 114);
        content.addChild(infoText);
        const updateInfo = () => {
            const s = game.state.getSnapshot();
            const tickets = s.inventory?.['ticket_normal'] || 0;
            const shards = s.inventory?.['shard_universal'] || 0;
            const party = (s.partySlots || []).filter(Boolean).length;
            const heroes = (s.heroes || []).length;
            const logs = game.debug.getCount();
            const director = game.state.directorEnabled ? `🎬ON(${game.state.directorModel})` : '🎬OFF';
            infoText.text =
                `版本: ${String(game.versionLabel?.text || '').split(' ')[0] || ''}\n` +
                    `关卡: ${s.stage}  | 队伍: ${party}/5\n` +
                    `英雄数: ${heroes}\n` +
                    `资源: 💎${s.diamonds}  🪙${s.gold}  🎟${tickets}  🧩${shards}\n` +
                    `日志行数: ${logs}\n` +
                    `AI导演: ${director}`;
        };
        updateInfo();
        const un1 = game.state.on('anyChanged', () => updateInfo());
        // --- Actions ---
        const btnRow1Y = 330;
        const btnW = (w - 24 * 2 - 20) / 2;
        const btnH = 72;
        const btnAddDiamonds = new UIButton('➕💎 +1000', btnW, btnH);
        btnAddDiamonds.position.set(24, btnRow1Y);
        btnAddDiamonds.on('pointertap', () => {
            game.state.addDiamonds(1000);
            game.debug.info('DEV', 'addDiamonds', { delta: 1000 });
            game.toast.show('已添加 💎1000', 1.2);
        });
        content.addChild(btnAddDiamonds);
        const btnAddTickets = new UIButton('➕🎟 +10', btnW, btnH);
        btnAddTickets.position.set(24 + btnW + 20, btnRow1Y);
        btnAddTickets.on('pointertap', () => {
            game.state.addInventory('ticket_normal', 10);
            game.debug.info('DEV', 'addTickets', { delta: 10, key: 'ticket_normal' });
            game.toast.show('已添加 🎟10', 1.2);
        });
        content.addChild(btnAddTickets);
        const btnRow2Y = btnRow1Y + 90;
        const btnAdvance = new UIButton('⏭ 过关 +1', btnW, btnH);
        btnAdvance.position.set(24, btnRow2Y);
        btnAdvance.on('pointertap', () => {
            game.state.advanceStage(1);
            game.debug.info('DEV', 'advanceStage', { delta: 1 });
            game.toast.show('已推进 +1 关', 1.2);
        });
        content.addChild(btnAdvance);
        const btnSetStage = new UIButton('🎯 设置关卡', btnW, btnH);
        btnSetStage.position.set(24 + btnW + 20, btnRow2Y);
        btnSetStage.on('pointertap', () => {
            const cur = game.state.stage;
            const raw = window.prompt('输入要设置的关卡（>=1）', String(cur));
            if (raw == null)
                return;
            const n = Math.max(1, Math.floor(Number(raw) || 1));
            game.state.setStage(n);
            game.debug.info('DEV', 'setStage', { stage: n });
            game.toast.show(`已设置到第 ${n} 关`, 1.2);
        });
        content.addChild(btnSetStage);
        const btnRow3Y = btnRow2Y + 90;
        const btnCopyLog = new UIButton('📋 复制日志', btnW, btnH);
        btnCopyLog.position.set(24, btnRow3Y);
        btnCopyLog.on('pointertap', async () => {
            const header = `=== DEBUG LOG ===\nTime: ${new Date().toISOString()}\n`;
            const s = game.state.getSnapshot();
            const snap = `Stage=${s.stage} Diamonds=${s.diamonds} Gold=${s.gold}\nHeroes=${(s.heroes || []).length} Party=${(s.partySlots || []).filter(Boolean).length}/5\n`;
            const text = header + snap + '\n' + game.debug.getText();
            const ok = await copyToClipboard(text);
            game.toast.show(ok ? '日志已复制 ✅' : '复制失败（可手动复制）', 1.6);
        });
        content.addChild(btnCopyLog);
        const btnClearLog = new UIButton('🧹 清空日志', btnW, btnH);
        btnClearLog.position.set(24 + btnW + 20, btnRow3Y);
        btnClearLog.on('pointertap', () => {
            game.debug.clear();
            updateInfo();
            game.toast.show('已清空日志', 1.2);
        });
        content.addChild(btnClearLog);
        const btnRow4Y = btnRow3Y + 90;
        // --- AI Director ---
        const btnDirector = new UIButton('🎬 AI导演设置', btnW, btnH);
        btnDirector.position.set(24, btnRow4Y);
        btnDirector.on('pointertap', async () => {
            // 1) enable/disable
            const enabled = game.state.directorEnabled;
            const okEnable = window.confirm(`AI导演当前：${enabled ? '已开启' : '已关闭'}\n\n确定要${enabled ? '关闭' : '开启'}吗？\n（关闭后将只使用固定数值，不再生成关卡词条）`);
            if (okEnable)
                game.state.setDirectorEnabled(!enabled);
            // 2) model
            const curModel = game.state.directorModel;
            const modelRaw = window.prompt('导演模型（deepseek-chat / deepseek-reasoner）', curModel);
            if (modelRaw) {
                const m = modelRaw.trim() === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
                game.state.setDirectorModel(m);
            }
            // 3) key (session only)
            const curKey = getDirectorApiKey();
            const keyRaw = window.prompt('DeepSeek API Key（仅本次会话缓存；留空表示不改）', curKey ? curKey.slice(0, 6) + '...' : '');
            if (keyRaw != null && keyRaw.trim()) {
                setDirectorApiKey(keyRaw.trim());
                game.toast.show('导演Key已保存（仅本次会话）✅', 1.4);
            }
            updateInfo();
        });
        content.addChild(btnDirector);
        const btnReset = new UIButton('⚠️ 重置存档', btnW, btnH);
        btnReset.position.set(24 + btnW + 20, btnRow4Y);
        btnReset.on('pointertap', () => {
            const ok = window.confirm('确认重置存档？\n（清空英雄、资源、关卡）');
            if (!ok)
                return;
            game.debug.warn('DEV', 'hardReset');
            game.hardReset();
            game.modal.close();
        });
        content.addChild(btnReset);
        // layout root inside modal panel
        root.position.set((game.modal.panel.width - w) / 2, 40);
        // cleanup
        game.modal.onClose = () => {
            un1?.();
            game.modal.onClose = null;
        };
    });
}
