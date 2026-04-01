import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const globalForPeerPrisma = globalThis;

function getPeerPrisma() {
  const peerUrl = process.env.PEER_DATABASE_URL?.trim();
  if (!peerUrl || peerUrl === process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForPeerPrisma.__peerPrisma || globalForPeerPrisma.__peerPrismaUrl !== peerUrl) {
    globalForPeerPrisma.__peerPrisma = new PrismaClient({
      datasourceUrl: peerUrl,
      log: ["warn", "error"],
    });
    globalForPeerPrisma.__peerPrismaUrl = peerUrl;
  }

  return globalForPeerPrisma.__peerPrisma;
}

function getClients() {
  const peer = getPeerPrisma();
  return peer ? [prisma, peer] : [prisma];
}

async function resolveAuthorId(client, preferredId, preferredNickname) {
  const byPreferredId = await client.member.findUnique({
    where: { id: preferredId },
    select: { id: true },
  });
  if (byPreferredId?.id) {
    return byPreferredId.id;
  }

  if (preferredNickname) {
    const byNickname = await client.member.findUnique({
      where: { nickname: preferredNickname },
      select: { id: true },
    });
    if (byNickname?.id) {
      return byNickname.id;
    }
  }

  const superAdminNickname = process.env.SUPER_ADMIN_NICKNAME?.trim() || "admin";
  const bySuperAdmin = await client.member.findUnique({
    where: { nickname: superAdminNickname },
    select: { id: true },
  });
  return bySuperAdmin?.id || null;
}

function uniqueByVersion(notes) {
  const sorted = [...notes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const map = new Map();
  for (const note of sorted) {
    if (!map.has(note.version)) {
      map.set(note.version, note);
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function uniqueAnnouncements(rows) {
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const map = new Map();
  for (const row of sorted) {
    const key = `${row.id}::${row.message}::${row.startsAt.toISOString()}::${row.endsAt.toISOString()}`;
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function fetchUnifiedReleaseNotes() {
  const clients = getClients();
  const results = await Promise.all(
    clients.map(async (client) => {
      try {
        return await client.releaseNote.findMany({
          select: {
            id: true,
            version: true,
            title: true,
            content: true,
            createdBy: { select: { nickname: true } },
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
      } catch {
        return [];
      }
    })
  );

  return uniqueByVersion(results.flat());
}

export async function hasReleaseNoteVersion(version) {
  const clients = getClients();
  for (const client of clients) {
    try {
      const hit = await client.releaseNote.findUnique({ where: { version }, select: { id: true } });
      if (hit) {
        return true;
      }
    } catch {
      // ignore peer DB read failure
    }
  }
  return false;
}

export async function createReleaseNoteInAllDbs(input) {
  const clients = getClients();
  for (const client of clients) {
    const authorId = await resolveAuthorId(client, input.authorId, input.authorNickname);
    if (!authorId) {
      continue;
    }

    await client.releaseNote.upsert({
      where: { version: input.version },
      update: {
        title: input.title,
        content: input.content,
      },
      create: {
        version: input.version,
        title: input.title,
        content: input.content,
        createdByMemberId: authorId,
      },
    });
  }
}

export async function fetchUnifiedAnnouncements() {
  const clients = getClients();
  const results = await Promise.all(
    clients.map(async (client) => {
      try {
        return await client.adminAnnouncement.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            message: true,
            startsAt: true,
            endsAt: true,
            createdAt: true,
          },
        });
      } catch {
        return [];
      }
    })
  );

  return uniqueAnnouncements(results.flat());
}

export async function fetchActiveAnnouncement(now) {
  const rows = await fetchUnifiedAnnouncements();
  return rows.find((row) => row.startsAt.getTime() <= now.getTime() && row.endsAt.getTime() >= now.getTime()) || null;
}

export async function createAnnouncementInAllDbs(input) {
  const announcementId = randomUUID();
  const clients = getClients();
  for (const client of clients) {
    const authorId = await resolveAuthorId(client, input.authorId, input.authorNickname);
    if (!authorId) {
      continue;
    }

    await client.adminAnnouncement.create({
      data: {
        id: announcementId,
        message: input.message,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdByMemberId: authorId,
      },
    });
  }
}

export async function deleteAnnouncementInAllDbs(input) {
  const clients = getClients();
  for (const client of clients) {
    const orConditions = [];

    if (input.announcementId) {
      orConditions.push({ id: input.announcementId });
    }

    if (input.message && input.startsAt && input.endsAt) {
      orConditions.push({
        message: input.message,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
    }

    if (orConditions.length === 0) {
      continue;
    }

    await client.adminAnnouncement.deleteMany({
      where: {
        OR: orConditions,
      },
    });
  }
}

export async function fetchPeerFeedbacks() {
  const peer = getPeerPrisma();
  if (!peer) {
    return [];
  }

  try {
    return await peer.feedback.findMany({
      select: {
        id: true,
        memberNameSnapshot: true,
        content: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    });
  } catch {
    return [];
  }
}
