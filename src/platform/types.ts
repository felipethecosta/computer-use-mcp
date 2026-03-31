export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface ScreenshotResult {
  filePath: string;
}

export type MouseButton = 'left' | 'right' | 'middle';
export type ScrollDirection = 'up' | 'down';

export interface PlatformProvider {
  validateDependencies(): Promise<void>;
  screenshot(region?: ScreenRegion): Promise<ScreenshotResult>;
  click(x: number, y: number, button: MouseButton): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  typeText(text: string, delayMs: number): Promise<void>;
  keyPress(keys: string): Promise<void>;
  mouseMove(x: number, y: number): Promise<void>;
  scroll(x: number, y: number, direction: ScrollDirection, clicks: number): Promise<void>;
  drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
  getScreenSize(): Promise<ScreenSize>;
  getCursorPosition(): Promise<CursorPosition>;
}
