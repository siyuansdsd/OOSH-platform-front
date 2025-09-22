export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  scope?: string;
  role?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  token: string;
  expiresIn: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  code: string;
  username: string;
  address?: {
    street?: string;
    suburb?: string;
    city?: string;
  };
  childrenSchool?: string;
  childrenAge?: string;
}

const jsonHeaders = { "content-type": "application/json" } as const;

export async function sendVerificationCode(
  email: string,
  options?: { password?: string; purpose?: "register" | "login" }
) {
  const res = await fetch("/api/verify/send-code", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(
      Object.fromEntries(
        Object.entries({
          email,
          password: options?.password,
          purpose: options?.purpose,
        }).filter(([, value]) => value !== undefined)
      )
    ),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to send verification code");
  }
  return res.json().catch(() => ({}));
}

export async function verifyCode(
  email: string,
  code: string,
  options?: { password?: string; purpose?: "register" | "login" }
) {
  const res = await fetch("/api/verify/verify-code", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(
      Object.fromEntries(
        Object.entries({
          email,
          code,
          password: options?.password,
          purpose: options?.purpose,
        }).filter(([, value]) => value !== undefined)
      )
    ),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Verification failed");
  }
  return res.json().catch(() => ({}));
}

export async function loginUser(params: {
  email: string;
  password?: string;
  code?: string;
}) {
  const res = await fetch("/api/users/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(
      Object.fromEntries(
        Object.entries({
          email: params.email,
          password: params.password,
          code: params.code,
        }).filter(([, value]) => value !== undefined && value !== "")
      )
    ),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Login failed");
  }
  return (await res.json()) as LoginResponse;
}

export async function loginAdmin(username: string, password: string) {
  const res = await fetch("/api/users/admin-login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Admin login failed");
  }
  return (await res.json()) as LoginResponse;
}

export async function refreshTokens(refreshToken: string, scope?: string) {
  const res = await fetch("/api/users/refresh", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(scope ? { refreshToken, scope } : { refreshToken }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Refresh failed");
  }
  return (await res.json()) as LoginResponse;
}

export async function logout(accessToken: string) {
  const res = await fetch("/api/users/logout", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Logout failed");
  }
  return res.json().catch(() => ({}));
}

export async function registerUser(input: RegisterInput) {
  const res = await fetch("/api/users/register", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Registration failed");
  }
  return res.json().catch(() => ({}));
}
