import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-value-0123456789abcdef";
  process.env.OMS_ADMIN_USERNAME = "readygo";
  process.env.OMS_ADMIN_PASSWORD = "correct-horse";
  delete process.env.VITE_APP_ID;
  delete process.env.OAUTH_SERVER_URL;
});

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    getAllPackages: vi.fn(),
  };
});

import { appRouter } from "./routers";
import { getAllPackages, getUserByOpenId, upsertUser } from "./db";
import { createContext, type TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { LOCAL_ADMIN_OPEN_ID, LOCAL_SESSION_APP_ID } from "./_core/localAuth";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";

type StoredUser = User;

function createRes() {
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const ctx = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.login", () => {
  let stored: StoredUser | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stored = undefined;
    process.env.OMS_ADMIN_USERNAME = "readygo";
    process.env.OMS_ADMIN_PASSWORD = "correct-horse";
    delete process.env.VITE_APP_ID;
    vi.mocked(upsertUser).mockImplementation(async user => {
      stored = {
        id: stored?.id ?? 7,
        openId: user.openId,
        name: user.name === undefined ? (stored?.name ?? null) : user.name,
        email: user.email === undefined ? (stored?.email ?? null) : user.email,
        loginMethod:
          user.loginMethod === undefined
            ? (stored?.loginMethod ?? null)
            : user.loginMethod,
        role: user.role ?? stored?.role ?? "user",
        createdAt: stored?.createdAt ?? new Date(),
        updatedAt: new Date(),
        lastSignedIn: user.lastSignedIn ?? new Date(),
      };
    });
    vi.mocked(getUserByOpenId).mockImplementation(async openId => {
      if (stored && stored.openId === openId) return stored;
      return undefined;
    });
    vi.mocked(getAllPackages).mockResolvedValue([
      { id: 1, code: "SET-A", name: "套餐 A" },
    ] as never);
  });

  it("sets the session cookie and opens protected routes for the admin", async () => {
    const { ctx, cookies } = createRes();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "  readygo  ",
      password: "  correct-horse  ",
    });

    expect(result).toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: ONE_YEAR_MS,
    });

    const session = await sdk.verifySession(cookies[0]?.value);
    expect(session).toEqual({
      openId: LOCAL_ADMIN_OPEN_ID,
      appId: LOCAL_SESSION_APP_ID,
      name: "readygo",
    });
    expect(stored).toMatchObject({
      openId: LOCAL_ADMIN_OPEN_ID,
      name: "readygo",
      loginMethod: "password",
      role: "admin",
      email: null,
    });

    const authed = await createContext({
      req: {
        protocol: "https",
        headers: { cookie: `${COOKIE_NAME}=${cookies[0]?.value}` },
      } as TrpcContext["req"],
      res: ctx.res,
    });
    expect(authed.user).toMatchObject({
      openId: LOCAL_ADMIN_OPEN_ID,
      role: "admin",
      loginMethod: "password",
    });

    const authedCaller = appRouter.createCaller(authed);
    await expect(authedCaller.auth.me()).resolves.toMatchObject({
      openId: LOCAL_ADMIN_OPEN_ID,
      role: "admin",
    });
    await expect(authedCaller.packages.list()).resolves.toEqual([
      { id: 1, code: "SET-A", name: "套餐 A" },
    ]);
    await expect(
      authedCaller.system.notifyOwner({ title: "測試", content: "內容" })
    ).resolves.toEqual({ success: false });
  });

  it("rejects a wrong password without writing a user or a cookie", async () => {
    const { ctx, cookies } = createRes();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "readygo", password: "wrong-password" })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "帳號或密碼不正確",
    });

    expect(cookies).toHaveLength(0);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(stored).toBeUndefined();
  });

  it("rejects a wrong username", async () => {
    const { ctx, cookies } = createRes();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "someone-else", password: "correct-horse" })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(cookies).toHaveLength(0);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("refuses login when the admin env vars are blank", async () => {
    process.env.OMS_ADMIN_USERNAME = "   ";
    process.env.OMS_ADMIN_PASSWORD = "";
    const { ctx, cookies } = createRes();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "readygo", password: "correct-horse" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(cookies).toHaveLength(0);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("does not set a cookie when the user row cannot be saved", async () => {
    vi.mocked(getUserByOpenId).mockResolvedValue(undefined);
    const { ctx, cookies } = createRes();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "readygo", password: "correct-horse" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(cookies).toHaveLength(0);
  });

  it("still issues a Manus session token when VITE_APP_ID is set", async () => {
    process.env.VITE_APP_ID = "manus-app-id";
    const token = await sdk.createSessionToken("manus-user", {
      name: "Manus User",
      expiresInMs: ONE_YEAR_MS,
    });

    await expect(sdk.verifySession(token)).resolves.toEqual({
      openId: "manus-user",
      appId: "manus-app-id",
      name: "Manus User",
    });
  });

  it("uses a Lax cookie on plain HTTP and None+Secure on HTTPS", () => {
    expect(
      getSessionCookieOptions({ protocol: "http", headers: {} } as TrpcContext["req"])
    ).toMatchObject({ secure: false, sameSite: "lax" });
    expect(
      getSessionCookieOptions({
        protocol: "https",
        headers: {},
      } as TrpcContext["req"])
    ).toMatchObject({ secure: true, sameSite: "none" });
  });

  it("keeps order routes closed without a session", async () => {
    const { ctx } = createRes();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.packages.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(getAllPackages).not.toHaveBeenCalled();
  });
});
