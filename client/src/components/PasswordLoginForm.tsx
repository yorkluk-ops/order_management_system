import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";

function loginErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError && error.message) {
    return error.message;
  }
  return "登入失敗，請稍後再試。";
}

export function PasswordLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = trpc.auth.login.useMutation();

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={async event => {
        event.preventDefault();
        if (login.isPending) return;
        if (!username.trim() || !password.trim()) {
          setError("請輸入帳號和密碼");
          return;
        }
        setError(null);
        try {
          await login.mutateAsync({
            username: username.trim(),
            password: password.trim(),
          });
          // Full navigation so every protected query runs with the new cookie.
          window.location.assign("/");
        } catch (caught) {
          setPassword("");
          setError(loginErrorMessage(caught));
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="oms-username">帳號</Label>
        <Input
          id="oms-username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          disabled={login.isPending}
          required
          onChange={event => setUsername(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="oms-password">密碼</Label>
        <Input
          id="oms-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={login.isPending}
          required
          onChange={event => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive text-center" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full shadow-lg hover:shadow-xl transition-all"
        disabled={login.isPending}
      >
        {login.isPending ? "登入中…" : "登入系統"}
      </Button>
    </form>
  );
}
