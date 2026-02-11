// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MVP 评分权重
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const W = {
    damage: 1.0,
    healing: 1.2,
    shield: 0.8,
    kill: 50,
    survive: 30,
};
/** 护盾 buff 的估算伤害减免值 */
const SHIELD_BUFF_VALUE = {
    buff_shield: 60, // 20% 减伤 ~60HP
    buff_ironwall: 80, // 30% 减伤 ~80HP
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BattleStatsCollector
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export class BattleStatsCollector {
    constructor() {
        Object.defineProperty(this, "fighters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lastSkillSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    /** 重置，开始新一场战斗 */
    reset(teamA, teamB) {
        this.fighters.clear();
        this.lastSkillSource = null;
        for (const f of [...teamA, ...teamB]) {
            this.fighters.set(f.id, {
                id: f.id,
                name: f.name,
                side: f.side,
                element: f.element,
                damageDealt: 0,
                damageTaken: 0,
                healingDone: 0,
                shielding: 0,
                kills: 0,
                buffGiven: 0,
                survived: true,
                mvpScore: 0,
                mvpGrade: 'C',
            });
        }
    }
    /** 接收战斗事件 */
    onEvent(e) {
        switch (e.type) {
            case 'skillUse':
                this.lastSkillSource = e.payload.actorId;
                break;
            case 'damage': {
                const { sourceId, targetId, amount } = e.payload;
                if (sourceId !== targetId) {
                    // 非自伤 (DoT 不算输出)
                    const src = this.fighters.get(sourceId);
                    if (src)
                        src.damageDealt += amount;
                }
                const tar = this.fighters.get(targetId);
                if (tar)
                    tar.damageTaken += amount;
                break;
            }
            case 'heal': {
                const src = this.fighters.get(e.payload.sourceId);
                if (src)
                    src.healingDone += e.payload.amount;
                break;
            }
            case 'shield': {
                const src = this.fighters.get(e.payload.sourceId);
                if (src)
                    src.shielding += e.payload.amount;
                break;
            }
            case 'buffAdd': {
                const src = this.fighters.get(e.payload.sourceId);
                if (src) {
                    src.buffGiven++;
                    // 护盾类 buff → 估算护盾值
                    const sv = SHIELD_BUFF_VALUE[e.payload.buffId];
                    if (sv)
                        src.shielding += sv;
                }
                break;
            }
            case 'dead': {
                const tar = this.fighters.get(e.payload.targetId);
                if (tar)
                    tar.survived = false;
                // 最后一个技能使用者获得击杀
                if (this.lastSkillSource) {
                    const killer = this.fighters.get(this.lastSkillSource);
                    if (killer && killer.id !== e.payload.targetId)
                        killer.kills++;
                }
                break;
            }
        }
    }
    /** 计算 MVP 评分并排名 */
    evaluate() {
        // 计算原始分数
        for (const f of this.fighters.values()) {
            f.mvpScore =
                f.damageDealt * W.damage +
                    f.healingDone * W.healing +
                    f.shielding * W.shield +
                    f.kills * W.kill +
                    (f.survived ? W.survive : 0);
        }
        // 分阵营评级
        for (const side of ['A', 'B']) {
            const team = this.getTeam(side);
            if (!team.length)
                continue;
            const maxScore = Math.max(...team.map(f => f.mvpScore), 1);
            for (const f of team) {
                const ratio = f.mvpScore / maxScore;
                f.mvpGrade = ratio >= 0.9 ? 'S' : ratio >= 0.6 ? 'A' : ratio >= 0.3 ? 'B' : 'C';
            }
        }
    }
    /** 获取某阵营数据（按 MVP 分降序） */
    getTeam(side) {
        const arr = [];
        for (const f of this.fighters.values()) {
            if (f.side === side)
                arr.push(f);
        }
        return arr.sort((a, b) => b.mvpScore - a.mvpScore);
    }
    /** 获取全场 MVP（我方优先） */
    getMVP() {
        const a = this.getTeam('A');
        return a[0] ?? this.getTeam('B')[0] ?? null;
    }
    /** 获取某个统计维度的最大值（用于条形图归一化） */
    getMaxStat(side, key) {
        let max = 0;
        for (const f of this.fighters.values()) {
            if (f.side === side && f[key] > max)
                max = f[key];
        }
        return Math.max(1, max);
    }
}
