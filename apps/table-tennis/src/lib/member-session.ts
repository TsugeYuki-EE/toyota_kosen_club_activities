import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const MEMBER_SESSION_COOKIE = "ttn_member_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionMember = {
  id: string;
  name: string;
  nickname: string | null;
  grade: string | null;
  yearlyGoal: string | null;
  monthlyGoal: string | null;
  canAccessAdmin: boolean;
  role: "PLAYER" | "MANAGER" | "COACH" | "ADMIN";
  createdAt: Date;
};

export async function getSessionMember() {
  const cookieStore = await cookies();
  const memberId = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;

  if (!memberId) {
    return null;
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      nickname: true,
      grade: true,
      yearlyGoal: true,
      monthlyGoal: true,
      canAccessAdmin: true,
      role: true,
      createdAt: true,
    },
  });

  return member as SessionMember | null;
}

export async function setMemberSession(memberId: string) {
  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, memberId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearMemberSession() {
  const cookieStore = await cookies();
  cookieStore.delete(MEMBER_SESSION_COOKIE);
}
