/**
 * AI Director (大模型导演) — generates per-stage "challenge modifiers".
 *
 * Design principles:
 * - LLM only suggests a directive in STRICT JSON.
 * - Game applies only whitelisted modifiers with bounded parameters.
 * - If anything fails, fall back to local safe templates.
 */

export type DirectorModel = 'deepseek-chat' | 'deepseek-reasoner';

export type ModType =
  | 'enemy_hp_mult'
  | 'enemy_atk_mult'
  | 'enemy_spd_mult'
  | 'ally_hp_mult'
  | 'ally_atk_mult'
  | 'ally_spd_mult'
  | 'gold_mult'
  | 'diamond_bonus'
  | 'chest_bonus'
  | 'shard_bonus';

export interface DirectiveMod {
  type: ModType;
  value: number;
}

export interface Directive {
  title: string;
  desc: string;
  mods: DirectiveMod[];
  risk: 1 | 2 | 3;
}

export const DIRECTOR_SESSION_KEY = 'sl_director_deepseek_key';

export function getDirectorApiKey(): string {
  try {
    return sessionStorage.getItem(DIRECTOR_SESSION_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function setDirectorApiKey(key: string): void {
  try {
    if (!key) sessionStorage.removeItem(DIRECTOR_SESSION_KEY);
    else sessionStorage.setItem(DIRECTOR_SESSION_KEY, key);
  } catch (_) {}
}

// -------------------------
// Local fallback templates
// -------------------------

const LOCAL_TEMPLATES: Directive[] = [
  {
    title: '血战之夜',
    desc: '敌军更强，但赏金更丰厚。',
    risk: 2,
    mods: [
      { type: 'enemy_hp_mult', value: 1.25 },
      { type: 'gold_mult', value: 1.4 },
    ],
  },
  {
    title: '速攻演习',
    desc: '我方火力更猛，但敌人也更凶。',
    risk: 2,
    mods: [
      { type: 'ally_atk_mult', value: 1.18 },
      { type: 'enemy_atk_mult', value: 1.15 },
    ],
  },
  {
    title: '铁壁防线',
    desc: '双方更耐打，战斗将更漫长。',
    risk: 1,
    mods: [
      { type: 'ally_hp_mult', value: 1.2 },
      { type: 'enemy_hp_mult', value: 1.1 },
    ],
  },
  {
    title: '风暴协奏',
    desc: '双方节奏都更快，战斗更激进。',
    risk: 2,
    mods: [
      { type: 'ally_spd_mult', value: 1.12 },
      { type: 'enemy_spd_mult', value: 1.1 },
      { type: 'gold_mult', value: 1.2 },
    ],
  },
  {
    title: '赏金猎场',
    desc: '金币掉落提高，但敌人也更硬。',
    risk: 2,
    mods: [
      { type: 'gold_mult', value: 1.6 },
      { type: 'enemy_hp_mult', value: 1.2 },
    ],
  },
  {
    title: '碎片馈赠',
    desc: 'Boss 可能掉更多万能碎片（若为 Boss 关生效更强）。',
    risk: 1,
    mods: [
      { type: 'shard_bonus', value: 3 },
    ],
  },
  {
    title: '宝箱加码',
    desc: '更高风险，换来额外宝箱机会。',
    risk: 3,
    mods: [
      { type: 'enemy_hp_mult', value: 1.35 },
      { type: 'enemy_atk_mult', value: 1.2 },
      { type: 'chest_bonus', value: 1 },
    ],
  },
];

function pickLocal(stage: number): Directive {
  // deterministic-ish
  const idx = Math.abs((stage * 9301 + 49297) % LOCAL_TEMPLATES.length);
  return JSON.parse(JSON.stringify(LOCAL_TEMPLATES[idx]!)) as Directive;
}

// -------------------------
// Validation / balancing
// -------------------------

const RANGES: Record<ModType, { min: number; max: number; integer?: boolean }> = {
  enemy_hp_mult: { min: 0.8, max: 1.6 },
  enemy_atk_mult: { min: 0.8, max: 1.6 },
  enemy_spd_mult: { min: 0.8, max: 1.5 },
  ally_hp_mult: { min: 0.8, max: 1.6 },
  ally_atk_mult: { min: 0.8, max: 1.6 },
  ally_spd_mult: { min: 0.8, max: 1.5 },
  gold_mult: { min: 0.8, max: 2.0 },
  diamond_bonus: { min: 0, max: 100, integer: true },
  chest_bonus: { min: 0, max: 1, integer: true },
  shard_bonus: { min: 0, max: 10, integer: true },
};

const MOD_TEXT: Record<ModType, string> = {
  enemy_hp_mult: '敌方生命',
  enemy_atk_mult: '敌方攻击',
  enemy_spd_mult: '敌方速度',
  ally_hp_mult: '我方生命',
  ally_atk_mult: '我方攻击',
  ally_spd_mult: '我方速度',
  gold_mult: '金币奖励',
  diamond_bonus: '钻石奖励',
  chest_bonus: '额外宝箱',
  shard_bonus: '额外碎片',
};

export function formatMods(mods: DirectiveMod[]): string {
  const parts: string[] = [];
  for (const m of mods) {
    if (!m) continue;
    const v = m.value;
    const label = MOD_TEXT[m.type] ?? m.type;
    if (m.type.endsWith('_mult')) parts.push(`${label}×${v.toFixed(2)}`);
    else parts.push(`${label}+${v}`);
  }
  return parts.join(' · ');
}

function tryParseJsonText(text: string): any | null {
  const s = String(text || '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (_) {}

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (_) {}
  }

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}

function estimateDirectivePower(mods: DirectiveMod[]): number {
  let score = 0;
  for (const m of mods) {
    switch (m.type) {
      case 'enemy_hp_mult': score += (m.value - 1) * 1.4; break;
      case 'enemy_atk_mult': score += (m.value - 1) * 1.6; break;
      case 'enemy_spd_mult': score += (m.value - 1) * 1.2; break;
      case 'ally_hp_mult': score -= (m.value - 1) * 1.2; break;
      case 'ally_atk_mult': score -= (m.value - 1) * 1.4; break;
      case 'ally_spd_mult': score -= (m.value - 1) * 1.1; break;
      case 'gold_mult': score -= (m.value - 1) * 1.5; break;
      case 'diamond_bonus': score -= m.value / 120; break;
      case 'chest_bonus': score -= m.value * 0.8; break;
      case 'shard_bonus': score -= m.value / 14; break;
      default: break;
    }
  }
  return score;
}

export function sanitizeDirective(raw: any, stage: number): Directive {
  const fallback = pickLocal(stage);
  if (!raw || typeof raw !== 'object') return fallback;

  const title = typeof raw.title === 'string' ? raw.title.slice(0, 18) : fallback.title;
  const desc = typeof raw.desc === 'string' ? raw.desc.slice(0, 50) : fallback.desc;
  const riskIn = Number(raw.risk);
  const risk = (riskIn === 2 || riskIn === 3) ? riskIn : 1;

  const modsRaw = Array.isArray(raw.mods) ? raw.mods : [];
  const mods: DirectiveMod[] = [];
  for (const it of modsRaw) {
    const type = it?.type as ModType;
    if (!type || !(type in RANGES)) continue;
    const num = Number(it?.value);
    if (!Number.isFinite(num)) continue;
    const r = RANGES[type];
    let v = Math.max(r.min, Math.min(r.max, num));
    if (r.integer) v = Math.round(v);
    mods.push({ type, value: v });
  }

  // Dedup by type
  const seen = new Set<ModType>();
  const uniq = mods.filter((m) => {
    if (seen.has(m.type)) return false;
    seen.add(m.type);
    return true;
  });

  // Risk-based cap
  const cap = risk === 1 ? 2 : risk === 2 ? 3 : 4;
  const trimmed = uniq.slice(0, cap);
  if (trimmed.length === 0) return fallback;

  const power = estimateDirectivePower(trimmed);
  const normalizedRisk = power >= 0.5 ? 3 : power >= 0.15 ? 2 : 1;
  const finalRisk = Math.max(risk, normalizedRisk) as 1 | 2 | 3;

  return { title, desc, risk: finalRisk, mods: trimmed };
}

// -------------------------
// DeepSeek call (OpenAI-compatible)
// -------------------------

export async function generateDirectiveByDeepSeek(opts: {
  apiKey: string;
  model: DirectorModel;
  stage: number;
  snapshot: any;
  timeoutMs?: number;
}): Promise<Directive> {
  const { apiKey, model, stage, snapshot } = opts;
  if (!apiKey) return pickLocal(stage);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(500, opts.timeoutMs ?? 2500));

  const prompt = [
    '你是游戏【AI导演】。为当前关卡生成1条挑战词条，提升游戏性。',
    '只能从白名单类型中选择，数值必须在范围内。',
    '【白名单类型与范围】:',
    '- enemy_hp_mult: 0.8~1.6',
    '- enemy_atk_mult: 0.8~1.6',
    '- enemy_spd_mult: 0.8~1.5',
    '- ally_hp_mult: 0.8~1.6',
    '- ally_atk_mult: 0.8~1.6',
    '- ally_spd_mult: 0.8~1.5',
    '- gold_mult: 0.8~2.0',
    '- diamond_bonus: 0~100 (整数)',
    '- chest_bonus: 0~1 (整数)',
    '- shard_bonus: 0~10 (整数)',
    '输出【严格JSON】且只能输出JSON，不要markdown，不要多余文字。',
    'JSON结构:',
    '{"title":"","desc":"","risk":1|2|3,"mods":[{"type":"enemy_hp_mult","value":1.2}] }',
    `当前关卡stage=${stage}，玩家快照（仅用于平衡，不要复述原文）:`,
    JSON.stringify({ stage: snapshot?.stage, gold: snapshot?.gold, diamonds: snapshot?.diamonds, heroes: (snapshot?.heroes || []).length }),
  ].join('\n');

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.25,
        messages: [
          { role: 'system', content: '你输出的内容将被程序解析执行，必须严格JSON。' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const parsed = tryParseJsonText(text);
    if (!parsed) return pickLocal(stage);
    return sanitizeDirective(parsed, stage);
  } catch (_e) {
    return pickLocal(stage);
  } finally {
    clearTimeout(t);
  }
}

export function pickLocalDirective(stage: number): Directive {
  return pickLocal(stage);
}
