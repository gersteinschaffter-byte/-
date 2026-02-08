import { utils } from 'pixi.js';
import GameApp from './core/GameApp';
import HomeScene from './scenes/HomeScene';
import SummonScene from './scenes/SummonScene';
import HeroesScene from './scenes/HeroesScene';
import BagScene from './scenes/BagScene';
import BattleScene from './scenes/BattleScene';
import FormationScene from './scenes/FormationScene';

// Boot guard: show a friendly error on devices that cannot run WebGL.
// (This also helps when debugging inside Android WebView.)
try {
  if (typeof utils?.isWebGLSupported === 'function' && !utils.isWebGLSupported()) {
    (window as any).__SHOW_BOOT_ERROR__?.(
      '当前浏览器似乎不支持 WebGL，PixiJS 无法渲染。建议换 Chrome/Edge，或在系统设置里开启 WebGL/硬件加速。',
    );
  }
} catch (_) {
  // ignore
}

const game = new GameApp({ mountId: 'game', rotateTipId: 'rotateTip' });

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

// Bind navigation (bottom nav)
game.bottomNav.bind((key) => game.goTo(key, { animate: false }));

// Start from home
game.goTo('home', { animate: false });

// Main loop
game.pixi.ticker.add((dt: number) => game.tick(dt));

// Initial layout
game.applyScale();
