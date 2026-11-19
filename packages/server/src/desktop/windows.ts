import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, IS_WINDOWS } from "../config.js";

/**
 * Masaüstü kontrolü (Windows).
 *
 * Yerel npm modülü yasak olduğu için fare, klavye ve ekran görüntüsü
 * Windows'ta zaten bulunan PowerShell üzerinden yapılır: küçük bir C#
 * sınıfı `Add-Type` ile derlenir ve user32.dll'deki SendInput,
 * SetCursorPos, SetForegroundWindow çağrılır. Ek kurulum gerekmez.
 *
 * Koordinatlar: model son ekran görüntüsünün piksellerini görür. Görüntü
 * küçültülerek gönderildiği için tıklama noktası `toScreen` ile gerçek
 * ekran koordinatına çevrilir. Ekranı görmeden tıklamak istenmez; önce
 * görüntü alınmalı.
 *
 * Betik bilerek yalnızca ASCII içerir: Windows PowerShell 5.1 BOM'suz
 * dosyayı ANSI okur ve Türkçe karakter betiği bozardı.
 */

export const DESKTOP_UNSUPPORTED =
  "Masaüstü kontrolü şimdilik yalnızca Windows'ta çalışır.";

const HELPER_PS1 = String.raw`
param([string]$Action)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Out-Json($value) { [Console]::Out.Write((ConvertTo-Json $value -Compress -Depth 4)) }
try {
  $a = $env:STUDIO_DESKTOP_ARGS | ConvertFrom-Json
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  if (-not ('StudioDesk' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class StudioDesk {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
  static void Send(INPUT i) { SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Mouse(uint flags, int data) {
    INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; i.u.mi.mouseData = unchecked((uint)data); Send(i);
  }
  static bool Extended(ushort vk) {
    return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C;
  }
  public static void Key(ushort vk, bool up) {
    INPUT i = new INPUT(); i.type = 1; i.u.ki.wVk = vk;
    uint f = up ? 2u : 0u; if (Extended(vk)) f |= 1u; i.u.ki.dwFlags = f; Send(i);
  }
  public static void Text(string s) {
    foreach (char c in s) {
      if (c == '\r') continue;
      if (c == '\n') { Key(0x0D, false); Key(0x0D, true); continue; }
      INPUT d = new INPUT(); d.type = 1; d.u.ki.wScan = c; d.u.ki.dwFlags = 4; Send(d);
      INPUT u = new INPUT(); u.type = 1; u.u.ki.wScan = c; u.u.ki.dwFlags = 6; Send(u);
    }
  }
  public static void Focus(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    Key(0x12, false); Key(0x12, true);
    SetForegroundWindow(h);
  }
}
'@
  }
  [void][StudioDesk]::SetProcessDPIAware()

  switch ($Action) {
    'screenshot' {
      $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $bmp = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($vs.Left, $vs.Top, 0, 0, $bmp.Size)
      $pos = [System.Windows.Forms.Cursor]::Position
      $g.Dispose()
      $scale = [Math]::Min(1.0, [double]$a.maxWidth / $vs.Width)
      $w = [int][Math]::Round($vs.Width * $scale)
      $h = [int][Math]::Round($vs.Height * $scale)
      $out = New-Object System.Drawing.Bitmap $w, $h
      $g2 = [System.Drawing.Graphics]::FromImage($out)
      $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g2.DrawImage($bmp, 0, 0, $w, $h)
      $g2.Dispose(); $bmp.Dispose()
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $params = New-Object System.Drawing.Imaging.EncoderParameters 1
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]80)
      $out.Save($a.path, $codec, $params)
      $out.Dispose()
      Out-Json @{ ok = $true; left = $vs.Left; top = $vs.Top; screenWidth = $vs.Width; screenHeight = $vs.Height; width = $w; height = $h; scale = $scale; cursorX = $pos.X; cursorY = $pos.Y }
    }
    'click' {
      [void][StudioDesk]::SetCursorPos([int]$a.x, [int]$a.y)
      Start-Sleep -Milliseconds 40
      $down = 2; $up = 4
      if ($a.button -eq 'right') { $down = 8; $up = 16 }
      if ($a.button -eq 'middle') { $down = 32; $up = 64 }
      for ($n = 0; $n -lt [int]$a.count; $n++) {
        [StudioDesk]::Mouse($down, 0); [StudioDesk]::Mouse($up, 0)
        Start-Sleep -Milliseconds 60
      }
      Out-Json @{ ok = $true }
    }
    'move' {
      [void][StudioDesk]::SetCursorPos([int]$a.x, [int]$a.y)
      Out-Json @{ ok = $true }
    }
    'drag' {
      [void][StudioDesk]::SetCursorPos([int]$a.x, [int]$a.y)
      [StudioDesk]::Mouse(2, 0)
      $steps = 12
      for ($n = 1; $n -le $steps; $n++) {
        $px = [int]($a.x + ($a.toX - $a.x) * $n / $steps)
        $py = [int]($a.y + ($a.toY - $a.y) * $n / $steps)
        [void][StudioDesk]::SetCursorPos($px, $py)
        Start-Sleep -Milliseconds 15
      }
      [StudioDesk]::Mouse(4, 0)
      Out-Json @{ ok = $true }
    }
    'scroll' {
      if ($null -ne $a.x) { [void][StudioDesk]::SetCursorPos([int]$a.x, [int]$a.y) }
      [StudioDesk]::Mouse(0x0800, [int]$a.delta)
      Out-Json @{ ok = $true }
    }
    'type' {
      [StudioDesk]::Text([string]$a.text)
      Out-Json @{ ok = $true }
    }
    'key' {
      $vks = @($a.keys)
      foreach ($vk in $vks) { [StudioDesk]::Key([uint16]$vk, $false); Start-Sleep -Milliseconds 10 }
      [array]::Reverse($vks)
      foreach ($vk in $vks) { [StudioDesk]::Key([uint16]$vk, $true) }
      Out-Json @{ ok = $true }
    }
    'windows' {
      $fg = [StudioDesk]::GetForegroundWindow()
      $list = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
        ForEach-Object { @{ pid = $_.Id; process = $_.ProcessName; title = $_.MainWindowTitle; active = ($_.MainWindowHandle -eq $fg) } }
      Out-Json @{ ok = $true; windows = @($list) }
    }
    'focus' {
      $p = Get-Process -Id ([int]$a.pid)
      if ($p.MainWindowHandle -eq 0) { throw "Bu surecin acik penceresi yok." }
      [StudioDesk]::Focus($p.MainWindowHandle)
      Out-Json @{ ok = $true; title = $p.MainWindowTitle }
    }
    'open' {
      if ($a.args) { Start-Process -FilePath $a.target -ArgumentList $a.args } else { Start-Process -FilePath $a.target }
      Out-Json @{ ok = $true }
    }
    default { throw "Bilinmeyen eylem: $Action" }
  }
} catch {
  Out-Json @{ ok = $false; error = $_.Exception.Message }
}
`;

const HELPER_DIR = path.join(DATA_DIR, "desktop");
const HELPER_PATH = path.join(HELPER_DIR, "helper.ps1");
const TIMEOUT_MS = 30_000;

function ensureHelper(): string {
  // BOM ile yaz: PowerShell 5.1 dosyayı böylece UTF-8 okur.
  const content = "﻿" + HELPER_PS1.trim() + "\r\n";
  const current = fs.existsSync(HELPER_PATH) ? fs.readFileSync(HELPER_PATH, "utf8") : "";
  if (current !== content) {
    fs.mkdirSync(HELPER_DIR, { recursive: true });
    fs.writeFileSync(HELPER_PATH, content, "utf8");
  }
  return HELPER_PATH;
}

export type DesktopAction =
  | "screenshot"
  | "click"
  | "move"
  | "drag"
  | "scroll"
  | "type"
  | "key"
  | "windows"
  | "focus"
  | "open";

export class DesktopError extends Error {}

/** Yardımcı betiği çalıştırır; JSON cevabı döner, hata varsa fırlatır. */
export function runDesktop<T = Record<string, unknown>>(
  action: DesktopAction,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (!IS_WINDOWS) return Promise.reject(new DesktopError(DESKTOP_UNSUPPORTED));
  const script = ensureHelper();
  return new Promise<T>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Action", action],
      {
        env: { ...process.env, STUDIO_DESKTOP_ARGS: JSON.stringify(args) },
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    const onAbort = () => child.kill();
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new DesktopError(`PowerShell başlatılamadı: ${err.message}`));
    });
    child.on("close", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const parsed = parseHelperOutput(stdout);
      if (!parsed) {
        reject(new DesktopError(`Masaüstü yardımcısı cevap vermedi. ${stderr.trim().slice(0, 300)}`));
        return;
      }
      if (parsed["ok"] !== true) {
        reject(new DesktopError(String(parsed["error"] ?? "Bilinmeyen hata")));
        return;
      }
      resolve(parsed as T);
    });
  });
}

/** Çıktının son JSON nesnesini alır; PowerShell bazen başa uyarı basar. */
export function parseHelperOutput(stdout: string): Record<string, unknown> | null {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// -- Koordinatlar ------------------------------------------------------------

export interface ScreenGeometry {
  left: number;
  top: number;
  /** Görüntü pikseli / ekran pikseli. */
  scale: number;
  width: number;
  height: number;
}

/** Görüntü koordinatını gerçek ekran koordinatına çevirir. */
export function toScreen(geometry: ScreenGeometry, x: number, y: number): { x: number; y: number } {
  if (x < 0 || y < 0 || x > geometry.width || y > geometry.height) {
    throw new DesktopError(
      `(${x}, ${y}) ekran görüntüsünün dışında; görüntü ${geometry.width}x${geometry.height}.`,
    );
  }
  return {
    x: Math.round(geometry.left + x / geometry.scale),
    y: Math.round(geometry.top + y / geometry.scale),
  };
}

/** Ekran koordinatını görüntü koordinatına çevirir (imleç konumu için). */
export function toImage(geometry: ScreenGeometry, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round((x - geometry.left) * geometry.scale),
    y: Math.round((y - geometry.top) * geometry.scale),
  };
}

// -- Tuşlar ----------------------------------------------------------------------

const NAMED_KEYS: Record<string, number> = {
  ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, windows: 0x5b, cmd: 0x5b,
  enter: 0x0d, return: 0x0d, tab: 0x09, esc: 0x1b, escape: 0x1b, space: 0x20,
  backspace: 0x08, delete: 0x2e, del: 0x2e, insert: 0x2d,
  up: 0x26, down: 0x28, left: 0x25, right: 0x27,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22,
  printscreen: 0x2c, capslock: 0x14, menu: 0x5d,
  volumeup: 0xaf, volumedown: 0xae, mute: 0xad,
  playpause: 0xb3, nexttrack: 0xb0, prevtrack: 0xb1,
  "-": 0xbd, "=": 0xbb, ",": 0xbc, ".": 0xbe, "/": 0xbf, ";": 0xba,
  "[": 0xdb, "]": 0xdd, "\\": 0xdc, "'": 0xde, "`": 0xc0,
};

/**
 * "ctrl+shift+t", "alt+tab", "f5", "win+d" gibi bir birleşimi sanal tuş
 * kodlarına çevirir. Bilinmeyen tuşta hata: yanlış tuşa basmaktansa durmak iyi.
 */
export function parseKeyCombo(combo: string): number[] {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  // "ctrl++" gibi artı tuşunun kendisi
  if (combo.trim().endsWith("++")) parts.push("=");
  if (parts.length === 0) throw new DesktopError("Tuş belirtilmedi.");
  return parts.map((part) => {
    if (part in NAMED_KEYS) return NAMED_KEYS[part] as number;
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(part)) return 0x70 + Number(part.slice(1)) - 1;
    if (/^[a-z]$/.test(part)) return part.toUpperCase().charCodeAt(0);
    if (/^[0-9]$/.test(part)) return part.charCodeAt(0);
    throw new DesktopError(`Bilinmeyen tuş: "${part}"`);
  });
}

// -- Açma hedefi -----------------------------------------------------------------

/**
 * Açılacak hedefi denetler. Adres yalnızca http(s) olabilir; komut satırı
 * araya sıkıştırılamasın diye kabuk karakterleri reddedilir. Program adı
 * ya da tam yol Start-Process'e argüman olarak gider, kabuktan geçmez.
 */
export function validateOpenTarget(target: string): string {
  const value = target.trim();
  if (!value) throw new DesktopError("Açılacak hedef boş.");
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    if (!/^https?:\/\//i.test(value)) {
      throw new DesktopError("Yalnızca http ve https adresleri açılabilir.");
    }
    return value;
  }
  if (/[;&|`$<>]/.test(value)) throw new DesktopError("Hedefte izin verilmeyen karakter var.");
  return value;
}
