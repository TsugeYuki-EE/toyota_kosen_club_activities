import { request as httpRequest } from "node:http";
import os from "node:os";
import { promises as fs } from "node:fs";

type DockerInfo = {
  Containers?: number;
  ContainersRunning?: number;
  ContainersPaused?: number;
  ContainersStopped?: number;
  NCPU?: number;
  MemTotal?: number;
  OperatingSystem?: string;
  ServerVersion?: string;
};

type DockerContainerSummary = {
  Id: string;
  Names: string[];
  Image: string;
  ImageID?: string;
  State: string;
  Status: string;
};

export type RaspberryPiStatus = {
  collectedAt: Date;
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  uptimeSeconds: number;
  loadAverage: [number, number, number];
  memory: {
    totalBytes: number;
    freeBytes: number;
    availableBytes: number;
  };
  disk: {
    totalBytes: number | null;
    freeBytes: number | null;
    note: string;
  };
  docker: {
    available: boolean;
    serverVersion: string | null;
    operatingSystem: string | null;
    totalContainers: number | null;
    runningContainers: number | null;
    containers: Array<{ name: string; image: string; state: string; status: string }>;
    error: string | null;
  };
};

async function readDockerJson<T>(path: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const request = httpRequest(
      {
        socketPath: "/var/run/docker.sock",
        path,
        method: "GET",
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Docker API ${path} returned ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function getDiskUsageNote(): Promise<{ totalBytes: number | null; freeBytes: number | null; note: string }> {
  const mountPath = "/app";
  try {
    const stat = await fs.stat(mountPath);
    return {
      totalBytes: null,
      freeBytes: null,
      note: `${mountPath} の存在を確認しました (inode=${stat.ino})`,
    };
  } catch {
    return {
      totalBytes: null,
      freeBytes: null,
      note: `${mountPath} は現在参照できません`,
    };
  }
}

export async function getRaspberryPiStatus(): Promise<RaspberryPiStatus> {
  const collectedAt = new Date();

  const baseStatus: RaspberryPiStatus = {
    collectedAt,
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    loadAverage: os.loadavg() as [number, number, number],
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      availableBytes: os.freemem(),
    },
    disk: await getDiskUsageNote(),
    docker: {
      available: false,
      serverVersion: null,
      operatingSystem: null,
      totalContainers: null,
      runningContainers: null,
      containers: [],
      error: null,
    },
  };

  try {
    const [info, version, containers] = await Promise.all([
      readDockerJson<DockerInfo>("/info"),
      readDockerJson<{ Version?: string }>("/version"),
      readDockerJson<DockerContainerSummary[]>("/containers/json?all=1"),
    ]);

    baseStatus.docker = {
      available: true,
      serverVersion: version.Version || info.ServerVersion || null,
      operatingSystem: info.OperatingSystem || null,
      totalContainers: typeof info.Containers === "number" ? info.Containers : containers.length,
      runningContainers: typeof info.ContainersRunning === "number"
        ? info.ContainersRunning
        : containers.filter((container) => container.State === "running").length,
      containers: containers
        .slice()
        .sort((left, right) => {
          const leftRunning = left.State === "running" ? 0 : 1;
          const rightRunning = right.State === "running" ? 0 : 1;
          if (leftRunning !== rightRunning) {
            return leftRunning - rightRunning;
          }
          return left.Names[0]?.localeCompare(right.Names[0] || "", "ja") || 0;
        })
        .map((container) => ({
          name: container.Names[0]?.replace(/^\//, "") || container.Id.slice(0, 12),
          image: container.Image,
          state: container.State,
          status: container.Status,
        })),
      error: null,
    };
  } catch (error) {
    baseStatus.docker.error = error instanceof Error ? error.message : "Docker API を取得できませんでした";
  }

  return baseStatus;
}

export function formatRaspberryPiStatusMessage(status: RaspberryPiStatus): string {
  const lines = [
    "【卓球部】ラズパイ状態レポート",
    `取得日時: ${status.collectedAt.toISOString()}`,
    `ホスト: ${status.hostname}`,
    `OS: ${status.platform} ${status.release} (${status.arch})`,
    `稼働時間: ${Math.floor(status.uptimeSeconds / 3600)}時間${Math.floor((status.uptimeSeconds % 3600) / 60)}分`,
    `負荷平均: ${status.loadAverage.map((value) => value.toFixed(2)).join(" / ")}`,
    `メモリ: ${(status.memory.freeBytes / 1024 / 1024).toFixed(0)}MB free / ${(status.memory.totalBytes / 1024 / 1024).toFixed(0)}MB total`,
    `ディスク: ${status.disk.note}`,
  ];

  if (status.docker.available) {
    lines.push(
      `Docker: ${status.docker.runningContainers ?? 0}/${status.docker.totalContainers ?? 0} 実行中`,
      `Docker Engine: ${status.docker.serverVersion || "unknown"}`,
      `Docker OS: ${status.docker.operatingSystem || "unknown"}`,
      "コンテナ一覧:",
    );

    for (const container of status.docker.containers) {
      lines.push(`- ${container.name} [${container.state}] ${container.status}`);
    }
  } else {
    lines.push(`Docker: 利用不可 (${status.docker.error || "unknown error"})`);
  }

  return lines.join("\n");
}