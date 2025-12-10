export type ExpireTime = {
  month?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

const protocol = import.meta.env.VITE_SOCKET_PROTOCOL || "http";

export const cookie = {
  getCookie(key: string): string | null {
    const cookies = document.cookie.split(";");
    const found = cookies.find((data) => data.trim().startsWith(`${key}=`));
    return found ? found.split("=")[1] : null;
  },

  setCookie(key: string, value: string, expireTime: ExpireTime): void {
    const time = this.getTime(expireTime);
    const expires = `expires=${time.toUTCString()}`;
    const base = `${key}=${value};${expires}`;

    if (protocol === "https") {
      document.cookie = `${base};SameSite=None;Secure`;
    } else {
      document.cookie = base;
    }
  },

  getTime(expireTime: ExpireTime): Date {
    const now = new Date();
    if (expireTime) {
      Object.entries(expireTime).forEach(([unit, val]) => {
        const value = parseFloat(val as any);
        switch (unit) {
          case "month":
            now.setMonth(now.getMonth() + value);
            break;
          case "days":
            now.setDate(now.getDate() + value);
            break;
          case "hours":
            now.setHours(now.getHours() + value);
            break;
          case "minutes":
            now.setMinutes(now.getMinutes() + value);
            break;
          case "seconds":
            now.setSeconds(now.getSeconds() + value);
            break;
        }
      });
    }
    return now;
  },

  isCookieExists(key: string): boolean {
    return document.cookie.includes(`${key}=`);
  },

  deleteCookie(key: string): void {
    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  },
};
