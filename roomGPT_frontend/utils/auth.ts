const AUTH_USER_KEY = "lumiere-auth-user";
const AUTH_USERS_KEY = "lumiere-auth-users";

export interface AuthUser {
  name: string;
  email: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => item && item.email && item.password);
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.email) {
      return null;
    }
    return { name: parsed.name || "用户", email: parsed.email };
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getCurrentUser());
}

export function logout(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export function register(
  name: string,
  email: string,
  password: string
): { ok: boolean; message: string } {
  const safeName = name.trim();
  const safeEmail = email.trim().toLowerCase();
  const safePassword = password.trim();

  if (!safeName || !safeEmail || !safePassword) {
    return { ok: false, message: "请完整填写注册信息。" };
  }
  if (safePassword.length < 4) {
    return { ok: false, message: "密码至少 4 位。" };
  }

  const users = readUsers();
  const exists = users.some((user) => user.email === safeEmail);
  if (exists) {
    return { ok: false, message: "该邮箱已注册，请直接登录。" };
  }

  users.push({ name: safeName, email: safeEmail, password: safePassword });
  saveUsers(users);
  return { ok: true, message: "注册成功，请使用新账号登录。" };
}

export function login(
  email: string,
  password: string
): { ok: boolean; message: string } {
  const safeEmail = email.trim().toLowerCase();
  const safePassword = password.trim();
  if (!safeEmail || !safePassword) {
    return { ok: false, message: "请输入邮箱和密码。" };
  }

  const users = readUsers();
  const found = users.find(
    (user) => user.email === safeEmail && user.password === safePassword
  );

  if (!found) {
    return { ok: false, message: "邮箱或密码错误，请重试。" };
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify({ name: found.name, email: found.email })
    );
  }
  return { ok: true, message: "登录成功" };
}
