/**
 * Popup layer names (namespaces) for the global Modal.
 *
 * Why:
 * - The project uses a single shared Modal instance.
 * - Each popup must render into its own layer to avoid being wiped by others.
 *
 * Rule:
 * - Never use raw strings like 'hero_detail'.
 * - Always import and use these constants.
 */
export const PopupLayers = {
  DEFAULT: 'default',
  HERO_DETAIL: 'hero_detail',
  SUMMON_RESULT: 'summon_result',
  BAG_OPEN: 'bag_open',
  BAG_REWARD: 'bag_reward',
  BATTLE_RESULT: 'battle_result',
  CONFIRM: 'confirm',
  RUNTIME_ERROR: 'runtime_error',
  CONFIG_VALIDATION: 'config_validation',
  DEBUG_PANEL: 'debug_panel',
} as const;

export type PopupLayerName = (typeof PopupLayers)[keyof typeof PopupLayers];
