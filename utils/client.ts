interface ClientInfo {
  userAgent: string;
  language: string;
  colorDepth: number;
  screenResolution: string;
  timezone: number;
  hasSessionStorage: boolean;
  hasLocalStorage: boolean;
  hasIndexedDB: boolean;
  hasCookies: boolean;
  plugins: string[];
  canvas: string;
  webgl: string;
}

export class ClientJS {
  private clientInfo: ClientInfo;

  constructor() {
    this.clientInfo = this.gatherClientInfo();
  }

  private gatherClientInfo(): ClientInfo {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let canvasFingerprint = "";

    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Client fingerprint", 2, 2);
      canvasFingerprint = canvas.toDataURL();
    }

    const webglCanvas = document.createElement("canvas");
    const webglCtx =
      webglCanvas.getContext("webgl") ||
      webglCanvas.getContext("experimental-webgl");
    let webglFingerprint = "";

    if (webglCtx) {
      const debugInfo = webglCtx.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        webglFingerprint = webglCtx.getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL
        );
      }
    }

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      colorDepth: screen.colorDepth,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: new Date().getTimezoneOffset(),
      hasSessionStorage: this.hasSessionStorage(),
      hasLocalStorage: this.hasLocalStorage(),
      hasIndexedDB: this.hasIndexedDB(),
      hasCookies: this.isCookie(),
      plugins: this.getPlugins(),
      canvas: canvasFingerprint,
      webgl: webglFingerprint,
    };
  }

  getUserAgent(): string {
    return this.clientInfo.userAgent;
  }

  getLanguage(): string {
    return this.clientInfo.language;
  }

  getColorDepth(): number {
    return this.clientInfo.colorDepth;
  }

  getScreenResolution(): string {
    return this.clientInfo.screenResolution;
  }

  getTimezone(): number {
    return this.clientInfo.timezone;
  }

  hasSessionStorage(): boolean {
    try {
      return (
        typeof Storage !== "undefined" && typeof sessionStorage !== "undefined"
      );
    } catch {
      return false;
    }
  }

  hasLocalStorage(): boolean {
    try {
      return (
        typeof Storage !== "undefined" && typeof localStorage !== "undefined"
      );
    } catch {
      return false;
    }
  }

  hasIndexedDB(): boolean {
    try {
      return typeof indexedDB !== "undefined";
    } catch {
      return false;
    }
  }

  isCookie(): boolean {
    try {
      return navigator.cookieEnabled;
    } catch {
      return false;
    }
  }

  private getPlugins(): string[] {
    const plugins: string[] = [];
    if (navigator.plugins) {
      for (let i = 0; i < navigator.plugins.length; i++) {
        plugins.push(navigator.plugins[i].name);
      }
    }
    return plugins;
  }

  getFingerprint(): string {
    const components = [
      this.clientInfo.userAgent,
      this.clientInfo.language,
      this.clientInfo.colorDepth.toString(),
      this.clientInfo.screenResolution,
      this.clientInfo.timezone.toString(),
      this.clientInfo.hasSessionStorage.toString(),
      this.clientInfo.hasLocalStorage.toString(),
      this.clientInfo.hasIndexedDB.toString(),
      this.clientInfo.hasCookies.toString(),
      this.clientInfo.plugins.join(","),
      this.clientInfo.canvas,
      this.clientInfo.webgl,
    ];

    // Simple hash function
    let hash = 0;
    const str = components.join("|");
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  getClientInfo(): ClientInfo {
    return { ...this.clientInfo };
  }
}
