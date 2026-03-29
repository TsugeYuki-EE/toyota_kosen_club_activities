import { NextRequest, NextResponse } from "next/server";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/request-utils";

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// 卓球ノートの保存・更新・削除を行う
export async function POST(request: NextRequest) {
  const member = await getSessionMember();
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") || "/table-tennis-notes");
  const redirectUrl = buildAppUrl(request, redirectTo);
  const intent = String(formData.get("intent") || "save");
  const noteDateKey = String(formData.get("noteDateKey") || "");
  const content = String(formData.get("content") || "").trim();

  if (!member) {
    redirectUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (!isDateKey(noteDateKey)) {
    redirectUrl.searchParams.set("error", "invalid-date");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    if (intent === "delete") {
      await prisma.tableTennisNote.deleteMany({
        where: {
          memberId: member.id,
          noteDateKey,
        },
      });
      redirectUrl.searchParams.set("ok", "deleted");
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (!content) {
      redirectUrl.searchParams.set("error", "invalid-input");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const existed = await prisma.tableTennisNote.findUnique({
      where: {
        memberId_noteDateKey: {
          memberId: member.id,
          noteDateKey,
        },
      },
      select: { id: true },
    });

    await prisma.tableTennisNote.upsert({
      where: {
        memberId_noteDateKey: {
          memberId: member.id,
          noteDateKey,
        },
      },
      update: {
        content,
      },
      create: {
        memberId: member.id,
        noteDateKey,
        content,
      },
    });

    redirectUrl.searchParams.set("ok", existed ? "updated" : "created");
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    console.error("Failed to save table tennis note", error);
    redirectUrl.searchParams.set("error", "save-failed");
    return NextResponse.redirect(redirectUrl, 303);
  }
}
