import { getSessionMember } from "@/lib/member-session";

const SUPER_ADMIN_NICKNAME = "admin";
const SUPER_ADMIN_LOGIN_PASSWORD = "devdev";

export function isSuperAdminNickname(nickname: string | null | undefined): boolean {
  return (nickname || "").toLowerCase() === SUPER_ADMIN_NICKNAME;
}

export function isValidSuperAdminLoginPassword(password: string | null | undefined): boolean {
  return (password || "") === SUPER_ADMIN_LOGIN_PASSWORD;
}

function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === "MANAGER" || role === "COACH" || role === "ADMIN";
}

export function canAccessAdminByMember(member: { nickname?: string | null; role?: string | null; canAccessAdmin?: boolean } | null): boolean {
  if (!member) {
    return false;
  }

  return isSuperAdminNickname(member.nickname) || isPrivilegedRole(member.role) || Boolean(member.canAccessAdmin);
}

export async function getAuthorizedAdminMember() {
  const member = await getSessionMember();

  if (!canAccessAdminByMember(member)) {
    return null;
  }

  return member;
}
