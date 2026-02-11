import { Container, Graphics, Text } from 'pixi.js';
import { createText, roundedRect } from '../ui/uiFactory';
import ScrollView from '../ui/components/ScrollView';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 配色
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const COLORS = {
    damage: 0xff6644,
    taken: 0xff9966,
    healing: 0x54ff8d,
    shield: 0x66ccff,
    bgBar: 0x1a2444,
    mvpGold: 0xffd700,
    gradeS: 0xffd700,
    gradeA: 0x66ccff,
    gradeB: 0xaabbcc,
    gradeC: 0x667788,
};
const GRADE_COLOR = {
    S: COLORS.gradeS, A: COLORS.gradeA, B: COLORS.gradeB, C: COLORS.gradeC,
};
const ELEM_ICON = {
    '火': '🔥', '水': '💧', '风': '🌿', '光': '✨', '暗': '💀',
};
const STAT_CATS = [
    { label: '⚔ 伤害输出', key: 'damageDealt', color: COLORS.damage },
    { label: '🛡 承受伤害', key: 'damageTaken', color: COLORS.taken },
    { label: '💚 治疗量', key: 'healingDone', color: COLORS.healing },
    { label: '🔰 护盾贡献', key: 'shielding', color: COLORS.shield },
];
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// buildStatsPanel — 创建结算面板内容
//
// 返回一个 Container，由调用方添加到 modal.content
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function buildStatsPanel(opts) {
    const { panelW, panelH, teamA, teamB, mvp, maxStats } = opts;
    const root = new Container();
    const MARGIN = 28;
    const contentW = panelW - MARGIN * 2;
    let curY = 0;
    // ═══════════════════════════════════════════════════════
    // MVP 区域
    // ═══════════════════════════════════════════════════════
    if (mvp) {
        const mvpBox = new Graphics();
        mvpBox.beginFill(0x1a1a3a, 0.70);
        roundedRect(mvpBox, 0, 0, contentW, 80, 14);
        mvpBox.endFill();
        mvpBox.lineStyle(2, COLORS.mvpGold, 0.50);
        roundedRect(mvpBox, 0, 0, contentW, 80, 14);
        mvpBox.position.set(MARGIN, curY);
        root.addChild(mvpBox);
        // 🏆 MVP 标签
        const trophy = createText('🏆', 28, 0xffffff, '400');
        trophy.position.set(14, 24);
        mvpBox.addChild(trophy);
        const mvpLabel = createText('MVP', 22, COLORS.mvpGold, '900');
        mvpLabel.position.set(50, 14);
        mvpBox.addChild(mvpLabel);
        const elemIcon = mvp.element ? (ELEM_ICON[mvp.element] ?? '') : '';
        const mvpName = createText(`${elemIcon}${mvp.name}`, 20, 0xffffff, '800');
        mvpName.position.set(50, 44);
        mvpBox.addChild(mvpName);
        // MVP 分数 + 评级
        const scoreStr = `${Math.round(mvp.mvpScore)}分`;
        const scoreT = createText(scoreStr, 16, 0xffe3a3, '700');
        scoreT.anchor.set(1, 0);
        scoreT.position.set(contentW - 70, 18);
        mvpBox.addChild(scoreT);
        const gradeT = createText(mvp.mvpGrade, 32, GRADE_COLOR[mvp.mvpGrade] ?? 0xffffff, '900');
        gradeT.anchor.set(1, 0.5);
        gradeT.position.set(contentW - 14, 42);
        mvpBox.addChild(gradeT);
        curY += 90;
    }
    // ═══════════════════════════════════════════════════════
    // 我方统计条形图
    // ═══════════════════════════════════════════════════════
    curY += 6;
    curY = drawTeamStats(root, '— 我方战斗统计 —', teamA, maxStats, MARGIN, curY, contentW);
    // ═══════════════════════════════════════════════════════
    // 敌方统计条形图
    // ═══════════════════════════════════════════════════════
    curY += 10;
    curY = drawTeamStats(root, '— 敌方战斗统计 —', teamB, maxStats, MARGIN, curY, contentW);
    return root;
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 绘制一支队伍的统计区块
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawTeamStats(parent, title, team, maxStats, marginX, startY, contentW) {
    let y = startY;
    // 小标题
    const titleT = createText(title, 14, 0x8899bb, '700');
    titleT.anchor.set(0.5, 0);
    titleT.position.set(marginX + contentW / 2, y);
    parent.addChild(titleT);
    y += 22;
    for (const cat of STAT_CATS) {
        // 类别标签
        const catLabel = createText(cat.label, 13, 0xaabbcc, '700');
        catLabel.position.set(marginX, y);
        parent.addChild(catLabel);
        y += 18;
        // 每个角色的条形
        for (const f of team) {
            const value = f[cat.key];
            const maxVal = maxStats[cat.key] ?? 1;
            const ratio = maxVal > 0 ? Math.min(1, value / maxVal) : 0;
            const row = drawBarRow(f, value, ratio, cat.color, contentW);
            row.position.set(marginX, y);
            parent.addChild(row);
            y += 24;
        }
        y += 6;
    }
    // 角色评级一览
    y += 2;
    const gradeTitle = createText('评 级', 13, 0x8899bb, '700');
    gradeTitle.anchor.set(0.5, 0);
    gradeTitle.position.set(marginX + contentW / 2, y);
    parent.addChild(gradeTitle);
    y += 20;
    const teamMaxScore = team.length > 0 ? Math.max(...team.map(f => f.mvpScore), 1) : 1;
    for (const f of team) {
        const row = drawGradeRow(f, contentW, teamMaxScore);
        row.position.set(marginX, y);
        parent.addChild(row);
        y += 24;
    }
    y += 4;
    return y;
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 单行条形图
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawBarRow(fighter, value, ratio, color, totalW) {
    const row = new Container();
    const NAME_W = 80;
    const NUM_W = 55;
    const BAR_H = 16;
    const barMaxW = totalW - NAME_W - NUM_W - 10;
    // 名字（截断）
    const elemIcon = fighter.element ? (ELEM_ICON[fighter.element] ?? '') : '';
    const displayName = fighter.name.length > 4
        ? fighter.name.slice(0, 4) + '…' : fighter.name;
    const name = createText(`${elemIcon}${displayName}`, 12, 0xddeeff, '700');
    name.position.set(0, 1);
    row.addChild(name);
    // 条形背景
    const bg = new Graphics();
    bg.beginFill(COLORS.bgBar, 0.60);
    roundedRect(bg, 0, 0, barMaxW, BAR_H, 4);
    bg.endFill();
    bg.position.set(NAME_W, 1);
    row.addChild(bg);
    // 条形前景
    const barW = Math.max(0, barMaxW * ratio);
    if (barW > 2) {
        const bar = new Graphics();
        bar.beginFill(color, 0.85);
        roundedRect(bar, 0, 0, barW, BAR_H, 4);
        bar.endFill();
        // 高光
        bar.beginFill(0xffffff, 0.15);
        roundedRect(bar, 0, 0, barW, BAR_H * 0.45, 4);
        bar.endFill();
        bar.position.set(NAME_W, 1);
        row.addChild(bar);
    }
    // 数值
    const numT = createText(String(Math.round(value)), 12, 0xffffff, '800');
    numT.anchor.set(1, 0);
    numT.position.set(totalW, 2);
    row.addChild(numT);
    return row;
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 评级行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawGradeRow(fighter, totalW, teamMaxScore) {
    const row = new Container();
    const elemIcon = fighter.element ? (ELEM_ICON[fighter.element] ?? '') : '';
    const displayName = fighter.name.length > 5
        ? fighter.name.slice(0, 5) + '…' : fighter.name;
    const name = createText(`${elemIcon}${displayName}`, 13, 0xddeeff, '700');
    name.position.set(0, 2);
    row.addChild(name);
    // 评级字母
    const gc = GRADE_COLOR[fighter.mvpGrade] ?? 0xffffff;
    const grade = createText(fighter.mvpGrade, 18, gc, '900');
    grade.position.set(110, 0);
    row.addChild(grade);
    // 统计摘要: 击杀 / 存活
    const killTag = fighter.kills > 0 ? `⚔${fighter.kills}击杀` : '';
    const deadTag = fighter.survived ? '✓存活' : '✗阵亡';
    const info = createText(`${killTag}  ${deadTag}`, 11, 0x8899aa, '600');
    info.anchor.set(1, 0);
    info.position.set(totalW, 4);
    row.addChild(info);
    // 分数条
    const scoreW = 90;
    const bg = new Graphics();
    bg.beginFill(0x1a2444, 0.60);
    roundedRect(bg, 0, 0, scoreW, 12, 3);
    bg.endFill();
    bg.position.set(145, 5);
    row.addChild(bg);
    // 分数条前景（按团队最高分归一化）
    const ratio = teamMaxScore > 0 ? Math.min(1, fighter.mvpScore / teamMaxScore) : 0;
    const fw = Math.max(0, scoreW * ratio);
    if (fw > 1) {
        const bar = new Graphics();
        bar.beginFill(gc, 0.70);
        roundedRect(bar, 0, 0, fw, 12, 3);
        bar.endFill();
        bar.position.set(145, 5);
        row.addChild(bar);
    }
    const scoreT = createText(`${Math.round(fighter.mvpScore)}`, 10, 0xffffff, '700');
    scoreT.position.set(145 + scoreW + 6, 4);
    row.addChild(scoreT);
    return row;
}
