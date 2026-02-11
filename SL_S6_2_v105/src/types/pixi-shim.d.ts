declare module 'pixi.js' {
  export class DisplayObject { [key: string]: any }
  export class Container extends DisplayObject { [key: string]: any }
  export class Graphics extends Container { [key: string]: any }
  export class Text extends Container { [key: string]: any }
  export class Sprite extends Container { [key: string]: any }
  export class Texture { [key: string]: any; static WHITE: any }
  export class Rectangle { constructor(x?: number, y?: number, w?: number, h?: number) }
  export class TextStyle { constructor(style?: any) }
  export class Ticker { [key: string]: any }
  export class Application { [key: string]: any; constructor(opts?: any) }

  export const Assets: any;
  export const BLEND_MODES: any;
  export const utils: any;

  export type AssetsManifest = any;
}
