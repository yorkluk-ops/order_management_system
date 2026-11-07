import { createHash, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

/** Stable users.openId for the single env-configured admin. Fits varchar(64). */
export const LOCAL_ADMIN_OPEN_ID = "local-admin";

/**
 * Session JWT appId when VITE_APP_ID is unset.
 * verifySession rejects an empty appId, which is the Manus-unset case.
 */
export const LOCAL_SESSION_APP_ID = "local";

export type LocalAdminCredentials = {
  username: string;
  password: string;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time string compare. Digests hide length differences. */
export function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

/**
 * Read at request time so tests and process restarts see the current env.
 * Surrounding whitespace is ignored (secret managers sometimes add a newline).
 */
export function readLocalAdminCredentials(): LocalAdminCredentials | null {
  const username = process.env.OMS_ADMIN_USERNAME?.trim() ?? "";
  const password = process.env.OMS_ADMIN_PASSWORD?.trim() ?? "";
  if (!username || !password) return null;
  return { username, password };
}

function sessionAppId(): string {
  const configured =
    (process.env.VITE_APP_ID ?? "").trim() || ENV.appId.trim();
  return configured || LOCAL_SESSION_APP_ID;
}

/**
 * Check OMS_ADMIN_USERNAME / OMS_ADMIN_PASSWORD and set the same session
 * cookie the Manus OAuth callback sets.
 */
export async function loginWithLocalAdmin(
  req: Request,
  res: Response,
  username: string,
  password: string
): Promise<{ success: true }> {
  const configured = readLocalAdminCredentials();
  if (!configured) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "尚未設定登入帳號，請在伺服器設定 OMS_ADMIN_USERNAME 與 OMS_ADMIN_PASSWORD。",
    });
  }

  const secret =
    (process.env.JWT_SECRET ?? "").trim() || ENV.cookieSecret.trim();
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "尚未設定 JWT_SECRET，無法建立登入階段。",
    });
  }

  const submittedUsername = username.trim();
  const submittedPassword = password.trim();
  const usernameOk = safeEqual(submittedUsername, configured.username);
  const passwordOk = safeEqual(submittedPassword, configured.password);
  if (!usernameOk || !passwordOk) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "帳號或密碼不正確",
    });
  }

  await db.upsertUser({
    openId: LOCAL_ADMIN_OPEN_ID,
    name: configured.username,
    email: null,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const saved = await db.getUserByOpenId(LOCAL_ADMIN_OPEN_ID);
  if (!saved) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "無法儲存登入帳號，請檢查資料庫連線。",
    });
  }

  const sessionToken = await sdk.createSessionToken(LOCAL_ADMIN_OPEN_ID, {
    name: configured.username,
    expiresInMs: ONE_YEAR_MS,
    appId: sessionAppId(),
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });

  return { success: true };
}
