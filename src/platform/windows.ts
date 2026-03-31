import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exec } from '../utils.js';
import { which } from '../which.js';
import { parseKeyCombination } from './windows-keys.js';
import type {
  PlatformProvider,
  ScreenRegion,
  ScreenSize,
  CursorPosition,
  ScreenshotResult,
  MouseButton,
  ScrollDirection,
} from './types.js';

function tmpScreenshotPath(): string {
  return join(tmpdir(), `computer-use-mcp-${Date.now()}.png`);
}

function ps(script: string): Promise<{ stdout: string; stderr: string }> {
  return exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

// C# inline type for mouse/keyboard input via user32.dll SendInput
const SEND_INPUT_TYPE = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class NativeInput {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern void SetCursorPos(int x, int y);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public INPUTUNION u;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx; public int dy; public int mouseData;
        public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk; public ushort wScan; public uint dwFlags;
        public uint time; public IntPtr dwExtraInfo;
    }

    public const uint INPUT_MOUSE = 0;
    public const uint INPUT_KEYBOARD = 1;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
    public const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    public const uint MOUSEEVENTF_MOVE = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_UNICODE = 0x0004;

    public static void Click(uint downFlag, uint upFlag) {
        var inputs = new INPUT[2];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].u.mi.dwFlags = downFlag;
        inputs[1].type = INPUT_MOUSE;
        inputs[1].u.mi.dwFlags = upFlag;
        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void MoveTo(int x, int y) {
        SetProcessDPIAware();
        SetCursorPos(x, y);
    }

    public static void KeyDown(ushort vk) {
        var input = new INPUT[1];
        input[0].type = INPUT_KEYBOARD;
        input[0].u.ki.wVk = vk;
        SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void KeyUp(ushort vk) {
        var input = new INPUT[1];
        input[0].type = INPUT_KEYBOARD;
        input[0].u.ki.wVk = vk;
        input[0].u.ki.dwFlags = KEYEVENTF_KEYUP;
        SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void TypeUnicode(string text) {
        foreach (char c in text) {
            var inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wScan = (ushort)c;
            inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wScan = (ushort)c;
            inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        }
    }

    public static void ScrollWheel(int amount) {
        var input = new INPUT[1];
        input[0].type = INPUT_MOUSE;
        input[0].u.mi.dwFlags = MOUSEEVENTF_WHEEL;
        input[0].u.mi.mouseData = amount;
        SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
    }
}
'@ -ReferencedAssemblies System.Runtime.InteropServices
`;

export class WindowsProvider implements PlatformProvider {
  async validateDependencies(): Promise<void> {
    const found = await which('powershell.exe');
    if (!found) {
      throw new Error('powershell.exe not found in PATH');
    }

    // Test that System.Windows.Forms is available for screenshots
    await ps(`
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | Out-Null
    `);
  }

  async screenshot(region?: ScreenRegion): Promise<ScreenshotResult> {
    const filePath = tmpScreenshotPath();
    const escapedPath = filePath.replace(/'/g, "''");

    if (region) {
      await ps(`
        Add-Type -AssemblyName System.Drawing
        Add-Type -AssemblyName System.Windows.Forms
        [NativeInput]::SetProcessDPIAware() 2>$null
        $bmp = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen(${region.x}, ${region.y}, 0, 0, $bmp.Size)
        $g.Dispose()
        $bmp.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
      `);
    } else {
      await ps(`
        Add-Type -AssemblyName System.Drawing
        Add-Type -AssemblyName System.Windows.Forms
        ${SEND_INPUT_TYPE}
        [NativeInput]::SetProcessDPIAware()
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bmp.Size)
        $g.Dispose()
        $bmp.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
      `);
    }

    return { filePath };
  }

  async click(x: number, y: number, button: MouseButton): Promise<void> {
    const flags: Record<MouseButton, [string, string]> = {
      left: ['MOUSEEVENTF_LEFTDOWN', 'MOUSEEVENTF_LEFTUP'],
      right: ['MOUSEEVENTF_RIGHTDOWN', 'MOUSEEVENTF_RIGHTUP'],
      middle: ['MOUSEEVENTF_MIDDLEDOWN', 'MOUSEEVENTF_MIDDLEUP'],
    };
    const [down, up] = flags[button];

    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::MoveTo(${x}, ${y})
      [NativeInput]::Click([NativeInput]::${down}, [NativeInput]::${up})
    `);
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::MoveTo(${x}, ${y})
      [NativeInput]::Click([NativeInput]::MOUSEEVENTF_LEFTDOWN, [NativeInput]::MOUSEEVENTF_LEFTUP)
      Start-Sleep -Milliseconds 50
      [NativeInput]::Click([NativeInput]::MOUSEEVENTF_LEFTDOWN, [NativeInput]::MOUSEEVENTF_LEFTUP)
    `);
  }

  async typeText(text: string, _delayMs: number): Promise<void> {
    // Windows SendInput with KEYEVENTF_UNICODE doesn't support inter-key delay natively.
    // The delay parameter is ignored — Unicode input is sent as a batch.
    const escaped = text.replace(/'/g, "''");
    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::TypeUnicode('${escaped}')
    `);
  }

  async keyPress(keys: string): Promise<void> {
    const vkCodes = parseKeyCombination(keys);
    const downCmds = vkCodes.map((vk) => `[NativeInput]::KeyDown(${vk})`).join('\n');
    const upCmds = vkCodes.reverse().map((vk) => `[NativeInput]::KeyUp(${vk})`).join('\n');

    await ps(`
      ${SEND_INPUT_TYPE}
      ${downCmds}
      ${upCmds}
    `);
  }

  async mouseMove(x: number, y: number): Promise<void> {
    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::MoveTo(${x}, ${y})
    `);
  }

  async scroll(x: number, y: number, direction: ScrollDirection, clicks: number): Promise<void> {
    const amount = direction === 'up' ? 120 * clicks : -120 * clicks;

    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::MoveTo(${x}, ${y})
      [NativeInput]::ScrollWheel(${amount})
    `);
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await ps(`
      ${SEND_INPUT_TYPE}
      [NativeInput]::MoveTo(${fromX}, ${fromY})
      Start-Sleep -Milliseconds 50
      $downInput = New-Object NativeInput+INPUT
      $downInput.type = [NativeInput]::INPUT_MOUSE
      $downInput.u.mi.dwFlags = [NativeInput]::MOUSEEVENTF_LEFTDOWN
      [NativeInput]::SendInput(1, @($downInput), [System.Runtime.InteropServices.Marshal]::SizeOf([type][NativeInput+INPUT]))
      Start-Sleep -Milliseconds 50
      [NativeInput]::MoveTo(${toX}, ${toY})
      Start-Sleep -Milliseconds 50
      $upInput = New-Object NativeInput+INPUT
      $upInput.type = [NativeInput]::INPUT_MOUSE
      $upInput.u.mi.dwFlags = [NativeInput]::MOUSEEVENTF_LEFTUP
      [NativeInput]::SendInput(1, @($upInput), [System.Runtime.InteropServices.Marshal]::SizeOf([type][NativeInput+INPUT]))
    `);
  }

  async getScreenSize(): Promise<ScreenSize> {
    const { stdout } = await ps(`
      Add-Type -AssemblyName System.Windows.Forms
      ${SEND_INPUT_TYPE}
      [NativeInput]::SetProcessDPIAware()
      $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      Write-Output "$($b.Width)x$($b.Height)"
    `);

    const match = stdout.trim().match(/^(\d+)x(\d+)$/);
    if (!match) {
      throw new Error('Could not determine screen size');
    }

    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }

  async getCursorPosition(): Promise<CursorPosition> {
    const { stdout } = await ps(`
      ${SEND_INPUT_TYPE}
      $p = New-Object NativeInput+POINT
      [NativeInput]::GetCursorPos([ref]$p) | Out-Null
      Write-Output "$($p.X),$($p.Y)"
    `);

    const parts = stdout.trim().split(',');
    return {
      x: parseInt(parts[0], 10) || 0,
      y: parseInt(parts[1], 10) || 0,
    };
  }
}
