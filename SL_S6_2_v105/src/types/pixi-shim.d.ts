declare module 'pixi.js' {
  export class DisplayObject {
    [key: string]: any;
    destroy(options?: any): void;
  }

  export class Container extends DisplayObject {
    [key: string]: any;
    constructor(...args: any[]);
    addChild(...children: any[]): any;
    removeChild(...children: any[]): any;
    removeChildren(...args: any[]): any[];
    getBounds(...args: any[]): any;
    destroy(options?: any): void;
  }

  export class Graphics extends Container { [key: string]: any; constructor(...args: any[]) }
  export class Text extends Container { [key: string]: any; constructor(text?: any, style?: any) }
  export class Sprite extends Container { [key: string]: any; constructor(texture?: any) }

  export class Texture {
    [key: string]: any;
    static WHITE: any;
    static from(source: any): Texture;
  }

  export class Rectangle { constructor(x?: number, y?: number, w?: number, h?: number) }
  export class TextStyle { constructor(style?: any) }

  export class Ticker {
    [key: string]: any;
    static shared: Ticker;
    add(fn: (...args: any[]) => void): void;
    remove(fn: (...args: any[]) => void): void;
  }

  export class Application { [key: string]: any; constructor(opts?: any) }

  export const Assets: any;
  export const BLEND_MODES: any;
  export const utils: any;

  export type AssetsManifest = any;
}
