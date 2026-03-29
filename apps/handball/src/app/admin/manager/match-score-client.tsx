"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/date-format";
import styles from "./match-score.module.css";

type MatchOption = {
  id: string;
  title: string;
  opponent: string | null;
  scheduledAtMs: number;
  distanceDays: number;
};

type MemberOption = {
  id: string;
  name: string;
  nickname: string | null;
  grade: string | null;
};

type SelectedPlayer = {
  id: string;
  memberId: string;
  goals: number;
  shotAttempts: number;
  isGoalkeeper: boolean;
};

type MatchScoreState = {
  attendanceEvent: {
    id: string;
    title: string;
    scheduledAt: string;
    opponent: string;
  };
  match: {
    id: string;
    ourScore: number;
    theirScore: number;
    matchDate: string;
  };
  members: MemberOption[];
  selectedPlayers: SelectedPlayer[];
  periodStatus: {
    firstHalfSaved: boolean;
    secondHalfSaved: boolean;
    firstHalfScore: {
      period: "FIRST_HALF";
      ourScore: number;
      theirScore: number;
      quickCount: number;
      quickSuccessCount: number;
      leftCount: number;
      leftSuccessCount: number;
      centerCount: number;
      centerSuccessCount: number;
      pivotCount: number;
      pivotSuccessCount: number;
      reboundCount: number;
      reboundSuccessCount: number;
      sevenMeterCount: number;
      sevenMeterSuccessCount: number;
    } | null;
    secondHalfScore: {
      period: "SECOND_HALF";
      ourScore: number;
      theirScore: number;
      quickCount: number;
      quickSuccessCount: number;
      leftCount: number;
      leftSuccessCount: number;
      centerCount: number;
      centerSuccessCount: number;
      pivotCount: number;
      pivotSuccessCount: number;
      reboundCount: number;
      reboundSuccessCount: number;
      sevenMeterCount: number;
      sevenMeterSuccessCount: number;
    } | null;
    periodPlayerRows: Array<{
      period: "FIRST_HALF" | "SECOND_HALF";
      memberId: string;
      goals: number;
      shotAttempts: number;
      isGoalkeeper: boolean;
    }>;
    periodIncidentRows: Array<{
      id: string;
      period: "FIRST_HALF" | "SECOND_HALF";
      team: IncidentTeam;
      kind: IncidentKind;
      minute: number;
      playerName: string | null;
    }>;
  };
  draft: {
    payload: unknown;
    updatedAt: string;
  } | null;
};

type LocalPlayerStat = {
  memberId: string;
  shotAttempts: number;
  goals: number;
  isGoalkeeper: boolean;
};

type LocalTeamStats = {
  quickAttempts: number;
  quickSuccesses: number;
  leftAttempts: number;
  leftSuccesses: number;
  centerAttempts: number;
  centerSuccesses: number;
  pivotAttempts: number;
  pivotSuccesses: number;
  reboundAttempts: number;
  reboundSuccesses: number;
  sevenMeterAttempts: number;
  sevenMeterSuccesses: number;
};

type TeamCategoryKey = "quick" | "left" | "center" | "pivot" | "rebound" | "sevenMeter";
type TeamStatKey = keyof LocalTeamStats;

type PeriodKey = "FIRST_HALF" | "SECOND_HALF";
type Phase = "SETUP" | "FIRST_HALF" | "SECOND_HALF" | "FINISHED";
type IncidentTeam = "OUR" | "OPPONENT";
type IncidentKind = "TWO_MIN" | "YELLOW";

type TeamIncident = {
  id: string;
  period: PeriodKey;
  minute: string;
  kind: IncidentKind;
  team: IncidentTeam;
  playerName: string;
};

type DraftSnapshot = {
  version: 1;
  phase: Phase;
  selectedMemberIds: string[];
  goalkeeperMemberIds: string[];
  firstHalfScore: { our: number; their: number };
  secondHalfScore: { our: number; their: number };
  firstHalfStats: LocalPlayerStat[];
  secondHalfStats: LocalPlayerStat[];
  firstHalfTeamStats: LocalTeamStats;
  secondHalfTeamStats: LocalTeamStats;
  firstHalfIncidents: TeamIncident[];
  secondHalfIncidents: TeamIncident[];
  firstHalfSaved: boolean;
  secondHalfSaved: boolean;
  updatedAt: string;
};

type Props = {
  matchOptions: MatchOption[];
  members: MemberOption[];
  mode?: "setup" | "input";
  initialAttendanceEventId?: string;
};

const DRAFT_DEBOUNCE_MS = 5000;
const DRAFT_SYNC_INTERVAL_MS = 60000;

async function postJson(url: string, body: unknown): Promise<MatchScoreState> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "保存に失敗しました");
  }

  return data as MatchScoreState;
}

function toLocalStats(members: string[], rows: MatchScoreState["periodStatus"]["periodPlayerRows"], period: PeriodKey): LocalPlayerStat[] {
  const map = new Map(rows.filter((row) => row.period === period).map((row) => [row.memberId, row]));
  return members.map((memberId) => {
    const found = map.get(memberId);
    return {
      memberId,
      shotAttempts: found?.shotAttempts ?? 0,
      goals: found?.goals ?? 0,
      isGoalkeeper: found?.isGoalkeeper ?? false,
    };
  });
}

function toLocalIncidents(rows: MatchScoreState["periodStatus"]["periodIncidentRows"], period: PeriodKey): TeamIncident[] {
  return rows
    .filter((row) => row.period === period)
    .map((row) => ({
      id: row.id,
      period: row.period,
      team: row.team,
      kind: row.kind,
      minute: String(row.minute),
      playerName: row.playerName ?? "",
    }));
}

function emptyTeamStats(): LocalTeamStats {
  return {
    quickAttempts: 0,
    quickSuccesses: 0,
    leftAttempts: 0,
    leftSuccesses: 0,
    centerAttempts: 0,
    centerSuccesses: 0,
    pivotAttempts: 0,
    pivotSuccesses: 0,
    reboundAttempts: 0,
    reboundSuccesses: 0,
    sevenMeterAttempts: 0,
    sevenMeterSuccesses: 0,
  };
}

function toTeamStatKeys(category: TeamCategoryKey): { attemptsKey: TeamStatKey; successesKey: TeamStatKey } {
  if (category === "quick") return { attemptsKey: "quickAttempts", successesKey: "quickSuccesses" };
  if (category === "left") return { attemptsKey: "leftAttempts", successesKey: "leftSuccesses" };
  if (category === "center") return { attemptsKey: "centerAttempts", successesKey: "centerSuccesses" };
  if (category === "pivot") return { attemptsKey: "pivotAttempts", successesKey: "pivotSuccesses" };
  if (category === "rebound") return { attemptsKey: "reboundAttempts", successesKey: "reboundSuccesses" };
  return { attemptsKey: "sevenMeterAttempts", successesKey: "sevenMeterSuccesses" };
}

function isDraftSnapshot(value: unknown): value is DraftSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const target = value as Partial<DraftSnapshot>;
  return target.version === 1
    && Array.isArray(target.selectedMemberIds)
    && Array.isArray(target.goalkeeperMemberIds)
    && Boolean(target.firstHalfScore)
    && Boolean(target.secondHalfScore)
    && Array.isArray(target.firstHalfStats)
    && Array.isArray(target.secondHalfStats)
    && Boolean(target.firstHalfTeamStats)
    && Boolean(target.secondHalfTeamStats)
    && Array.isArray(target.firstHalfIncidents)
    && Array.isArray(target.secondHalfIncidents);
}

export function MatchScoreClient({
  matchOptions,
  members,
  mode = "setup",
  initialAttendanceEventId,
}: Props) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState<string>(matchOptions[0]?.id || "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [goalkeeperMemberIds, setGoalkeeperMemberIds] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>("SETUP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const [meta, setMeta] = useState<{
    attendanceEventId: string;
    opponent: string;
  } | null>(null);

  const [firstHalfScore, setFirstHalfScore] = useState({ our: 0, their: 0 });
  const [secondHalfScore, setSecondHalfScore] = useState({ our: 0, their: 0 });
  const [firstHalfStats, setFirstHalfStats] = useState<LocalPlayerStat[]>([]);
  const [secondHalfStats, setSecondHalfStats] = useState<LocalPlayerStat[]>([]);
  const [firstHalfTeamStats, setFirstHalfTeamStats] = useState<LocalTeamStats>(emptyTeamStats());
  const [secondHalfTeamStats, setSecondHalfTeamStats] = useState<LocalTeamStats>(emptyTeamStats());
  const [firstHalfSaved, setFirstHalfSaved] = useState(false);
  const [secondHalfSaved, setSecondHalfSaved] = useState(false);
  const [isFetchingInputState, setIsFetchingInputState] = useState(mode === "input");
  const [showTransitionLoading, setShowTransitionLoading] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [orientationAcknowledged, setOrientationAcknowledged] = useState(mode !== "input");
  const [pendingMemberId, setPendingMemberId] = useState("");
  const [addAsGoalkeeper, setAddAsGoalkeeper] = useState(false);
  const [firstHalfIncidents, setFirstHalfIncidents] = useState<TeamIncident[]>([]);
  const [secondHalfIncidents, setSecondHalfIncidents] = useState<TeamIncident[]>([]);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentModalTeam, setIncidentModalTeam] = useState<IncidentTeam>("OUR");
  const [incidentKind, setIncidentKind] = useState<IncidentKind>("TWO_MIN");
  const [incidentMinute, setIncidentMinute] = useState("");
  const [incidentPlayerName, setIncidentPlayerName] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [draftSyncStatus, setDraftSyncStatus] = useState<"synced" | "pending" | "offline" | "error">("synced");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string>("");
  const lastSyncedDraftRawRef = useRef<string>("");

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.includes(member.id)),
    [members, selectedMemberIds],
  );

  const addableMembers = useMemo(
    () => members.filter((member) => !selectedMemberIds.includes(member.id)),
    [members, selectedMemberIds],
  );

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const activeStats = phase === "SECOND_HALF" || phase === "FINISHED" ? secondHalfStats : firstHalfStats;
  const activeTeamStats = phase === "SECOND_HALF" || phase === "FINISHED" ? secondHalfTeamStats : firstHalfTeamStats;

  const liveOurScore = firstHalfScore.our + (phase === "FIRST_HALF" ? 0 : secondHalfScore.our);
  const liveTheirScore = firstHalfScore.their + (phase === "FIRST_HALF" ? 0 : secondHalfScore.their);

  const rowView = useMemo(
    () => activeStats.map((stat) => ({ stat, member: memberMap.get(stat.memberId) })),
    [activeStats, memberMap],
  );

  const activeAttendanceEventId = meta?.attendanceEventId || initialAttendanceEventId || selectedEventId;
  const draftStorageKey = activeAttendanceEventId ? `match-score-draft:${activeAttendanceEventId}` : "";

  const activeIncidents = phase === "SECOND_HALF" || phase === "FINISHED" ? secondHalfIncidents : firstHalfIncidents;
  const ownIncidents = activeIncidents.filter((item) => item.team === "OUR");
  const opponentTwoMinIncidents = activeIncidents.filter((item) => item.team === "OPPONENT" && item.kind === "TWO_MIN");

  const clearDraft = useCallback(async (attendanceEventId: string) => {
    const key = `match-score-draft:${attendanceEventId}`;
    window.localStorage.removeItem(key);
    setDraftSyncStatus("synced");

    try {
      await fetch("/api/manager-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "clearDraft",
          attendanceEventId,
        }),
      });
    } catch {
      // Ignore clear errors; final score save is already committed.
    }
  }, []);

  useEffect(() => {
    document.body.dataset.disableGlobalNavLoading = "true";

    return () => {
      delete document.body.dataset.disableGlobalNavLoading;
    };
  }, []);

  function updateCurrentScore(side: "our" | "their", delta: number) {
    if (phase === "FIRST_HALF") {
      setFirstHalfScore((prev) => ({
        ...prev,
        [side]: Math.max(0, prev[side] + delta),
      }));
      return;
    }

    if (phase === "SECOND_HALF") {
      setSecondHalfScore((prev) => ({
        ...prev,
        [side]: Math.max(0, prev[side] + delta),
      }));
    }
  }

  function updateCurrentPlayerStat(memberId: string, key: "shotAttempts" | "goals", delta: number) {
    const setter = phase === "SECOND_HALF" ? setSecondHalfStats : setFirstHalfStats;
    setter((prev) =>
      prev.map((row) => {
        if (row.memberId !== memberId) return row;
        return {
          ...row,
          [key]: Math.max(0, row[key] + delta),
        };
      }),
    );
  }

  function toggleCurrentGoalkeeper(memberId: string, checked: boolean) {
    const setter = phase === "SECOND_HALF" ? setSecondHalfStats : setFirstHalfStats;
    setter((prev) => prev.map((row) => (
      row.memberId === memberId
        ? { ...row, isGoalkeeper: checked }
        : row
    )));
  }

  function updateCurrentTeamStatValue(key: TeamStatKey, delta: number) {
    const setter = phase === "SECOND_HALF" ? setSecondHalfTeamStats : setFirstHalfTeamStats;
    setter((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  }

  function addMemberDuringMatch() {
    if (phase === "SETUP" || phase === "FINISHED") {
      setError("試合中のみメンバー追加できます");
      return;
    }

    if (!pendingMemberId) {
      setError("追加するメンバーを選択してください");
      return;
    }

    if (selectedMemberIds.includes(pendingMemberId)) {
      setError("このメンバーは既に参加メンバーです");
      return;
    }

    setError("");
    setSelectedMemberIds((prev) => [...prev, pendingMemberId]);

    setFirstHalfStats((prev) => {
      if (prev.some((row) => row.memberId === pendingMemberId)) {
        return prev;
      }
      return [
        ...prev,
        {
          memberId: pendingMemberId,
          shotAttempts: 0,
          goals: 0,
          isGoalkeeper: phase === "FIRST_HALF" ? addAsGoalkeeper : false,
        },
      ];
    });

    setSecondHalfStats((prev) => {
      if (prev.some((row) => row.memberId === pendingMemberId)) {
        return prev;
      }
      return [
        ...prev,
        {
          memberId: pendingMemberId,
          shotAttempts: 0,
          goals: 0,
          isGoalkeeper: phase === "SECOND_HALF" ? addAsGoalkeeper : false,
        },
      ];
    });

    setPendingMemberId("");
    setAddAsGoalkeeper(false);
  }

  function openIncidentModal(team: IncidentTeam, defaultKind?: IncidentKind) {
    if (phase === "SETUP") {
      setError("試合中に記録してください");
      return;
    }
    if (phase === "FINISHED") {
      setError("試合終了後は記録できません");
      return;
    }

    const nextKind = defaultKind ?? (team === "OUR" ? "YELLOW" : "TWO_MIN");
    setIncidentModalTeam(team);
    setIncidentKind(nextKind);
    setIncidentMinute("");
    setIncidentPlayerName("");
    setIsIncidentModalOpen(true);
  }

  function closeIncidentModal() {
    setIsIncidentModalOpen(false);
  }

  function saveIncident() {
    const minuteText = incidentMinute.trim();
    if (!/^\d{1,3}$/.test(minuteText)) {
      setError("時間(分)は数字で入力してください");
      return;
    }

    if (incidentModalTeam === "OUR" && incidentPlayerName.trim().length === 0) {
      setError("自チームは選手名を入力してください");
      return;
    }

    const next: TeamIncident = {
      id: crypto.randomUUID(),
      period: phase === "SECOND_HALF" ? "SECOND_HALF" : "FIRST_HALF",
      minute: minuteText,
      kind: incidentModalTeam === "OPPONENT" ? "TWO_MIN" : incidentKind,
      team: incidentModalTeam,
      playerName: incidentPlayerName.trim(),
    };

    const setter = phase === "SECOND_HALF" ? setSecondHalfIncidents : setFirstHalfIncidents;
    setter((prev) => [...prev, next]);
    setError("");
    closeIncidentModal();
  }

  function deleteIncident(incidentId: string) {
    const setter = phase === "SECOND_HALF" ? setSecondHalfIncidents : setFirstHalfIncidents;
    setter((prev) => prev.filter((item) => item.id !== incidentId));
  }

  const applyDraftSnapshot = useCallback((snapshot: DraftSnapshot) => {
    setSelectedMemberIds(snapshot.selectedMemberIds);
    setGoalkeeperMemberIds(snapshot.goalkeeperMemberIds);
    setFirstHalfScore(snapshot.firstHalfScore);
    setSecondHalfScore(snapshot.secondHalfScore);
    setFirstHalfStats(snapshot.firstHalfStats);
    setSecondHalfStats(snapshot.secondHalfStats);
    setFirstHalfTeamStats(snapshot.firstHalfTeamStats);
    setSecondHalfTeamStats(snapshot.secondHalfTeamStats);
    setFirstHalfIncidents(snapshot.firstHalfIncidents);
    setSecondHalfIncidents(snapshot.secondHalfIncidents);
    setFirstHalfSaved(snapshot.firstHalfSaved);
    setSecondHalfSaved(snapshot.secondHalfSaved);
    setPhase(snapshot.phase);
  }, []);

  const applyMatchState = useCallback((next: MatchScoreState, fallbackGoalkeeperIds: string[] = []) => {
    const selectedIds = next.selectedPlayers.map((row) => row.memberId);
    const keeperIds = next.selectedPlayers.filter((row) => row.isGoalkeeper).map((row) => row.memberId);
    const initKeeperIds = keeperIds.length > 0 ? keeperIds : fallbackGoalkeeperIds;
    const firstStats = toLocalStats(selectedIds, next.periodStatus.periodPlayerRows, "FIRST_HALF");
    const secondStats = toLocalStats(selectedIds, next.periodStatus.periodPlayerRows, "SECOND_HALF");
    const firstIncidents = toLocalIncidents(next.periodStatus.periodIncidentRows, "FIRST_HALF");
    const secondIncidents = toLocalIncidents(next.periodStatus.periodIncidentRows, "SECOND_HALF");

    if (!next.periodStatus.periodPlayerRows.some((row) => row.period === "FIRST_HALF" && row.isGoalkeeper)) {
      for (const row of firstStats) {
        row.isGoalkeeper = initKeeperIds.includes(row.memberId);
      }
    }

    if (!next.periodStatus.periodPlayerRows.some((row) => row.period === "SECOND_HALF" && row.isGoalkeeper)) {
      for (const row of secondStats) {
        row.isGoalkeeper = initKeeperIds.includes(row.memberId);
      }
    }

    setSelectedEventId(next.attendanceEvent.id);
    setSelectedMemberIds(selectedIds);
    setGoalkeeperMemberIds(initKeeperIds);
    setMeta({
      attendanceEventId: next.attendanceEvent.id,
      opponent: next.attendanceEvent.opponent,
    });
    setFirstHalfScore({
      our: next.periodStatus.firstHalfScore?.ourScore ?? 0,
      their: next.periodStatus.firstHalfScore?.theirScore ?? 0,
    });
    setSecondHalfScore({
      our: next.periodStatus.secondHalfScore?.ourScore ?? 0,
      their: next.periodStatus.secondHalfScore?.theirScore ?? 0,
    });
    setFirstHalfTeamStats({
      quickAttempts: next.periodStatus.firstHalfScore?.quickCount ?? 0,
      quickSuccesses: next.periodStatus.firstHalfScore?.quickSuccessCount ?? 0,
      leftAttempts: next.periodStatus.firstHalfScore?.leftCount ?? 0,
      leftSuccesses: next.periodStatus.firstHalfScore?.leftSuccessCount ?? 0,
      centerAttempts: next.periodStatus.firstHalfScore?.centerCount ?? 0,
      centerSuccesses: next.periodStatus.firstHalfScore?.centerSuccessCount ?? 0,
      pivotAttempts: next.periodStatus.firstHalfScore?.pivotCount ?? 0,
      pivotSuccesses: next.periodStatus.firstHalfScore?.pivotSuccessCount ?? 0,
      reboundAttempts: next.periodStatus.firstHalfScore?.reboundCount ?? 0,
      reboundSuccesses: next.periodStatus.firstHalfScore?.reboundSuccessCount ?? 0,
      sevenMeterAttempts: next.periodStatus.firstHalfScore?.sevenMeterCount ?? 0,
      sevenMeterSuccesses: next.periodStatus.firstHalfScore?.sevenMeterSuccessCount ?? 0,
    });
    setSecondHalfTeamStats({
      quickAttempts: next.periodStatus.secondHalfScore?.quickCount ?? 0,
      quickSuccesses: next.periodStatus.secondHalfScore?.quickSuccessCount ?? 0,
      leftAttempts: next.periodStatus.secondHalfScore?.leftCount ?? 0,
      leftSuccesses: next.periodStatus.secondHalfScore?.leftSuccessCount ?? 0,
      centerAttempts: next.periodStatus.secondHalfScore?.centerCount ?? 0,
      centerSuccesses: next.periodStatus.secondHalfScore?.centerSuccessCount ?? 0,
      pivotAttempts: next.periodStatus.secondHalfScore?.pivotCount ?? 0,
      pivotSuccesses: next.periodStatus.secondHalfScore?.pivotSuccessCount ?? 0,
      reboundAttempts: next.periodStatus.secondHalfScore?.reboundCount ?? 0,
      reboundSuccesses: next.periodStatus.secondHalfScore?.reboundSuccessCount ?? 0,
      sevenMeterAttempts: next.periodStatus.secondHalfScore?.sevenMeterCount ?? 0,
      sevenMeterSuccesses: next.periodStatus.secondHalfScore?.sevenMeterSuccessCount ?? 0,
    });
    setFirstHalfStats(firstStats);
    setSecondHalfStats(secondStats);
    setFirstHalfSaved(next.periodStatus.firstHalfSaved);
    setSecondHalfSaved(next.periodStatus.secondHalfSaved);
    setFirstHalfIncidents(firstIncidents);
    setSecondHalfIncidents(secondIncidents);

    if (next.periodStatus.secondHalfSaved) {
      setPhase("FINISHED");
    } else if (next.periodStatus.firstHalfSaved) {
      setPhase("SECOND_HALF");
    } else {
      setPhase("FIRST_HALF");
    }
  }, []);

  useEffect(() => {
    if (mode !== "input" || !initialAttendanceEventId) {
      return;
    }

    let cancelled = false;
    setIsFetchingInputState(true);
    setShowOrientationModal(false);
    setOrientationAcknowledged(false);
    setFirstHalfIncidents([]);
    setSecondHalfIncidents([]);
    setError("");

    fetch(`/api/manager-match-score?attendanceEventId=${encodeURIComponent(initialAttendanceEventId)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "試合状態の取得に失敗しました");
        }
        return data as MatchScoreState;
      })
      .then((next) => {
        if (cancelled) {
          return;
        }
        applyMatchState(next);

        const key = `match-score-draft:${next.attendanceEvent.id}`;
        const localRaw = window.localStorage.getItem(key);
        if (localRaw) {
          try {
            const parsedLocal = JSON.parse(localRaw) as unknown;
            if (isDraftSnapshot(parsedLocal)) {
              applyDraftSnapshot(parsedLocal);
            }
          } catch {
            window.localStorage.removeItem(key);
          }
        } else if (next.draft && isDraftSnapshot(next.draft.payload)) {
          applyDraftSnapshot(next.draft.payload);
          lastSyncedDraftRawRef.current = JSON.stringify(next.draft.payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "試合状態の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) {
          setIsFetchingInputState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyDraftSnapshot, applyMatchState, initialAttendanceEventId, mode]);

  const flushDraftToServer = useCallback(async () => {
    if (mode !== "input" || phase === "SETUP" || phase === "FINISHED" || !activeAttendanceEventId || !draftStorageKey) {
      return;
    }

    if (!navigator.onLine) {
      setDraftSyncStatus("offline");
      return;
    }

    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) {
      setDraftSyncStatus("synced");
      lastSyncedDraftRawRef.current = "";
      return;
    }

    if (raw === lastSyncedDraftRawRef.current) {
      setDraftSyncStatus("synced");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setDraftSyncStatus("error");
      return;
    }

    if (!isDraftSnapshot(parsed)) {
      setDraftSyncStatus("error");
      return;
    }

    try {
      setDraftSyncStatus("pending");
      const response = await fetch("/api/manager-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "saveDraft",
          attendanceEventId: activeAttendanceEventId,
          draft: parsed,
        }),
      });

      if (!response.ok) {
        throw new Error("draft save failed");
      }

      setDraftSyncStatus("synced");
      setLastDraftSavedAt(new Date().toISOString());
      lastSyncedDraftRawRef.current = raw;
    } catch {
      setDraftSyncStatus(navigator.onLine ? "error" : "offline");
    }
  }, [activeAttendanceEventId, draftStorageKey, mode, phase]);

  useEffect(() => {
    if (mode !== "input" || phase === "SETUP" || phase === "FINISHED" || !draftStorageKey) {
      return;
    }

    const snapshot: DraftSnapshot = {
      version: 1,
      phase,
      selectedMemberIds,
      goalkeeperMemberIds,
      firstHalfScore,
      secondHalfScore,
      firstHalfStats,
      secondHalfStats,
      firstHalfTeamStats,
      secondHalfTeamStats,
      firstHalfIncidents,
      secondHalfIncidents,
      firstHalfSaved,
      secondHalfSaved,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    setDraftSyncStatus(navigator.onLine ? "pending" : "offline");
    setDraftRevision((prev) => prev + 1);
  }, [
    draftStorageKey,
    mode,
    phase,
    selectedMemberIds,
    goalkeeperMemberIds,
    firstHalfScore,
    secondHalfScore,
    firstHalfStats,
    secondHalfStats,
    firstHalfTeamStats,
    secondHalfTeamStats,
    firstHalfIncidents,
    secondHalfIncidents,
    firstHalfSaved,
    secondHalfSaved,
  ]);

  useEffect(() => {
    if (draftRevision === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void flushDraftToServer();
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftRevision, flushDraftToServer]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void flushDraftToServer();
    }, DRAFT_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [flushDraftToServer]);

  useEffect(() => {
    const handleOnline = () => {
      void flushDraftToServer();
    };

    const handleOffline = () => {
      setDraftSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushDraftToServer]);

  useEffect(() => {
    if (mode !== "input") {
      return;
    }
    if (isFetchingInputState || error || phase === "SETUP" || orientationAcknowledged) {
      return;
    }

    setOrientationAcknowledged(true);
    setShowOrientationModal(true);
  }, [error, isFetchingInputState, mode, orientationAcknowledged, phase]);

  async function initializeMatch() {
    if (!selectedEventId) {
      setError("試合を選択してください");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("参加メンバーを1人以上選択してください");
      return;
    }
    if (goalkeeperMemberIds.length === 0) {
      setError("キーパーを1人以上選択してください");
      return;
    }
    if (goalkeeperMemberIds.some((memberId) => !selectedMemberIds.includes(memberId))) {
      setError("キーパーは参加メンバーから選択してください");
      return;
    }

    setIsSubmitting(true);
    setError("");
    if (mode === "setup") {
      setShowTransitionLoading(true);
    }

    let keepLoadingUntilUnmount = false;
    try {
      const next = await postJson("/api/manager-match-score", {
        intent: "init",
        attendanceEventId: selectedEventId,
        selectedMemberIds,
        goalkeeperMemberIds,
      });

      if (mode === "setup") {
        keepLoadingUntilUnmount = true;
        router.push(`/admin/manager/match-score/input?attendanceEventId=${encodeURIComponent(next.attendanceEvent.id)}`);
        return;
      }

      applyMatchState(next, goalkeeperMemberIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "初期化に失敗しました");
    } finally {
      setIsSubmitting(false);
      if (!keepLoadingUntilUnmount) {
        setShowTransitionLoading(false);
      }
    }
  }

  async function savePeriod(period: PeriodKey) {
    if (!meta) return;

    const periodStats = period === "FIRST_HALF" ? firstHalfStats : secondHalfStats;
    const keeperCount = periodStats.filter((row) => row.isGoalkeeper).length;

    if (keeperCount < 1) {
      setError("キーパーを1人以上選択してください");
      return;
    }

    const periodScore = period === "FIRST_HALF" ? firstHalfScore : secondHalfScore;
    const periodTeamStats = period === "FIRST_HALF" ? firstHalfTeamStats : secondHalfTeamStats;
    const periodIncidents = period === "FIRST_HALF" ? firstHalfIncidents : secondHalfIncidents;

    setIsSubmitting(true);
    setError("");
    try {
      const payload = {
        intent: "savePeriod" as const,
        attendanceEventId: meta.attendanceEventId,
        period,
        ourScore: periodScore.our,
        theirScore: periodScore.their,
        teamStats: periodTeamStats,
        playerStats: periodStats,
        incidents: periodIncidents.map((incident) => ({
          team: incident.team,
          kind: incident.kind,
          minute: Number(incident.minute),
          playerName: incident.playerName || null,
        })),
      };

      const next = await postJson("/api/manager-match-score", payload);

      setFirstHalfSaved(next.periodStatus.firstHalfSaved);
      setSecondHalfSaved(next.periodStatus.secondHalfSaved);

      if (period === "FIRST_HALF") {
        setPhase("SECOND_HALF");
      } else {
        setPhase("FINISHED");
        await clearDraft(meta.attendanceEventId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteMatchScore() {
    if (!meta) return;

    const confirmed = window.confirm("この試合のスコア記録を削除します。部員の累計シュート数・得点数からもこの試合分が差し引かれます。よろしいですか？");
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/manager-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "deleteMatch",
          attendanceEventId: meta.attendanceEventId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "削除に失敗しました");
      }

      setPhase("SETUP");
      setMeta(null);
      setFirstHalfScore({ our: 0, their: 0 });
      setSecondHalfScore({ our: 0, their: 0 });
      setFirstHalfTeamStats(emptyTeamStats());
      setSecondHalfTeamStats(emptyTeamStats());
      setFirstHalfStats([]);
      setSecondHalfStats([]);
      setFirstHalfSaved(false);
      setSecondHalfSaved(false);
      setPendingMemberId("");
      setAddAsGoalkeeper(false);
      setFirstHalfIncidents([]);
      setSecondHalfIncidents([]);
      await clearDraft(meta.attendanceEventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  const draftSyncLabel = draftSyncStatus === "synced"
    ? "同期済み"
    : draftSyncStatus === "pending"
      ? "保存中"
      : draftSyncStatus === "offline"
        ? "オフライン（端末に一時保存中）"
        : "同期エラー（自動再試行）";

  return (
    <>
      {(showTransitionLoading
        || (mode === "input" && isFetchingInputState)
        || (mode === "input" && !isFetchingInputState && !orientationAcknowledged && !error)
        || (mode === "input" && isSubmitting && phase !== "SETUP")) ? (
        <div className={styles.blockingLoadingOverlay} aria-live="polite" aria-busy="true">
          <section className={styles.blockingLoadingPanel} role="status" aria-label={isSubmitting ? "試合結果を送信中です" : "ページを読み込み中です"}>
            <h2 className={styles.blockingLoadingTitle}>TOYOTA_KOSEN HANDBALL NOTES</h2>
            <div className={styles.blockingLoadingSpinner} aria-hidden="true" />
            <p className={styles.blockingLoadingLabel}>{isSubmitting ? "試合結果を送信中..." : "読み込み中..."}</p>
          </section>
        </div>
      ) : null}

      {showOrientationModal ? (
        <div className={styles.orientationModalBackdrop} role="dialog" aria-modal="true" aria-label="入力推奨環境の案内">
          <section className={styles.orientationModal}>
            <h3>入力前のご案内</h3>
            <p>このページはタブレットを使うか、スマホの画面を横にして入力してください</p>
            <button
              type="button"
              className={styles.button}
              onClick={() => setShowOrientationModal(false)}
            >
              OK
            </button>
          </section>
        </div>
      ) : null}

      {isIncidentModalOpen ? (
        <div className={styles.orientationModalBackdrop} role="dialog" aria-modal="true" aria-label="退場・警告記録の入力">
          <section className={styles.orientationModal}>
            <h3>{incidentModalTeam === "OUR" ? "自チームの退場・警告を記録" : "相手チームの2分退場を記録"}</h3>

            <label className={styles.modalLabel}>
              時間(分)
              <input
                type="text"
                inputMode="numeric"
                value={incidentMinute}
                onChange={(event) => setIncidentMinute(event.target.value)}
                placeholder="例: 17"
              />
            </label>

            {incidentModalTeam === "OUR" ? (
              <>
                <label className={styles.modalLabel}>
                  種別
                  <select value={incidentKind} onChange={(event) => setIncidentKind(event.target.value as IncidentKind)}>
                    <option value="YELLOW">イエロー</option>
                    <option value="TWO_MIN">2分退場</option>
                  </select>
                </label>
                <label className={styles.modalLabel}>
                  選手名
                  <input
                    type="text"
                    value={incidentPlayerName}
                    onChange={(event) => setIncidentPlayerName(event.target.value)}
                    placeholder="ニックネームまたは名前"
                  />
                </label>
              </>
            ) : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryLink} onClick={closeIncidentModal}>キャンセル</button>
              <button type="button" className={styles.button} onClick={saveIncident}>保存</button>
            </div>
          </section>
        </div>
      ) : null}

      {error ? <p className={styles.error}>エラー: {error}</p> : null}

      {mode === "setup" ? (
        <section className={styles.card}>
          <h2>1. 試合を選択</h2>
          <div className={styles.selectRow}>
            <label>
              出席イベント(試合)
              <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} disabled={phase !== "SETUP"}>
                {matchOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${formatDateTime(new Date(option.scheduledAtMs))} / ${option.title} (${option.opponent || "対戦相手未設定"})`}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.meta}>予定日と現在日が近い順で表示しています。</p>
          </div>
        </section>
      ) : null}

      {mode === "setup" ? (
        <section className={styles.card}>
          <h2>2. 参加メンバーを選択</h2>
          <div className={styles.memberTableWrapLike}>
            <table className={styles.memberTableLike}>
              <thead>
                <tr>
                  <th>選択</th>
                  <th>ニックネーム</th>
                  <th>学年</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <tr key={member.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={phase !== "SETUP"}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedMemberIds((prev) => [...prev, member.id]);
                            } else {
                              setSelectedMemberIds((prev) => prev.filter((id) => id !== member.id));
                              setGoalkeeperMemberIds((prev) => prev.filter((id) => id !== member.id));
                            }
                          }}
                        />
                      </td>
                      <td>{member.nickname || member.name}</td>
                      <td>{member.grade || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {mode === "setup" ? (
        <section className={styles.card}>
          <h2>3. キーパーを選択</h2>
          <div className={styles.goalkeeperRow}>
            <div className={styles.memberTableWrapLike}>
              <table className={styles.memberTableLike}>
                <thead>
                  <tr>
                    <th>選択</th>
                    <th>ニックネーム</th>
                    <th>学年</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMembers.map((member) => {
                    const checked = goalkeeperMemberIds.includes(member.id);
                    return (
                      <tr key={member.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={phase !== "SETUP"}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setGoalkeeperMemberIds((prev) => [...prev, member.id]);
                              } else {
                                setGoalkeeperMemberIds((prev) => prev.filter((id) => id !== member.id));
                              }
                            }}
                          />
                        </td>
                        <td>{member.nickname || member.name}</td>
                        <td>{member.grade || "-"}</td>
                      </tr>
                    );
                  })}
                  {selectedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.meta}>先に参加メンバーを選択してください。</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <button type="button" className={styles.button} onClick={initializeMatch} disabled={isSubmitting || phase !== "SETUP"}>
              試合スコア入力を開始する
            </button>
          </div>
        </section>
      ) : null}

      {mode === "input" && isFetchingInputState ? (
        <section className={styles.card}>
          <p className={styles.meta}>試合スコア入力データを読み込み中です...</p>
        </section>
      ) : null}

      {phase !== "SETUP" && meta && !isFetchingInputState ? (
        <section className={styles.card}>
          <h2>{mode === "input" ? "試合中入力" : "4. 試合中入力"}</h2>

          <div className={styles.memberAddPanel}>
            <h3>途中参加メンバーを追加</h3>
            {addableMembers.length > 0 ? (
              <>
                <div className={styles.memberAddControls}>
                  <select
                    value={pendingMemberId}
                    onChange={(event) => setPendingMemberId(event.target.value)}
                    disabled={isSubmitting || phase === "FINISHED"}
                  >
                    <option value="">追加するメンバーを選択</option>
                    {addableMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {(member.nickname || member.name) + (member.grade ? ` (${member.grade})` : "")}
                      </option>
                    ))}
                  </select>
                  <label className={styles.memberAddCheckbox}>
                    <input
                      type="checkbox"
                      checked={addAsGoalkeeper}
                      onChange={(event) => setAddAsGoalkeeper(event.target.checked)}
                      disabled={isSubmitting || phase === "FINISHED"}
                    />
                    追加時にキーパーとしても登録
                  </label>
                </div>
                <button type="button" className={styles.button} onClick={addMemberDuringMatch} disabled={isSubmitting || phase === "FINISHED"}>
                  メンバーを追加
                </button>
              </>
            ) : (
              <p className={styles.meta}>追加できるメンバーはいません。</p>
            )}
          </div>

          <div className={styles.scoreBoard}>
            <div className={styles.scoreTitle}>{`豊田高専 VS ${meta.opponent}`}</div>
            <div className={styles.phaseBadge}>現在: {phase === "FIRST_HALF" ? "前半" : phase === "SECOND_HALF" ? "後半" : "試合終了"}</div>
            <div className={styles.scoreDisplay}>
              <div className={styles.teamScore}>
                <h3>豊田高専</h3>
                <div className={styles.scoreValue}>{liveOurScore}</div>
                <div className={styles.scoreActions}>
                  <button type="button" className={styles.smallButton} onClick={() => updateCurrentScore("our", -1)} disabled={isSubmitting || phase === "FINISHED"}>-</button>
                  <button type="button" className={styles.smallButton} onClick={() => updateCurrentScore("our", 1)} disabled={isSubmitting || phase === "FINISHED"}>+</button>
                </div>
                <button
                  type="button"
                  className={styles.incidentPrimaryButton}
                  onClick={() => openIncidentModal("OUR", "YELLOW")}
                  disabled={isSubmitting || phase === "FINISHED"}
                >
                  退場/警告入力
                </button>
                <ul className={styles.incidentList}>
                  {ownIncidents.length === 0 ? <li>記録なし</li> : null}
                  {ownIncidents.map((incident) => (
                    <li key={incident.id} className={styles.incidentRow}>
                      <span>{incident.kind === "YELLOW" ? "イエロー" : "2分退場"}</span>
                      <span>{incident.minute}分</span>
                      <span>{incident.playerName}</span>
                      <button type="button" className={styles.tinyDangerButton} onClick={() => deleteIncident(incident.id)}>削除</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.teamScore}>
                <h3>相手</h3>
                <div className={styles.scoreValue}>{liveTheirScore}</div>
                <div className={styles.scoreActions}>
                  <button type="button" className={styles.smallButton} onClick={() => updateCurrentScore("their", -1)} disabled={isSubmitting || phase === "FINISHED"}>-</button>
                  <button type="button" className={styles.smallButton} onClick={() => updateCurrentScore("their", 1)} disabled={isSubmitting || phase === "FINISHED"}>+</button>
                </div>
                <button
                  type="button"
                  className={styles.incidentPrimaryButton}
                  onClick={() => openIncidentModal("OPPONENT", "TWO_MIN")}
                  disabled={isSubmitting || phase === "FINISHED"}
                >
                  相手2分退場入力
                </button>
                <ul className={styles.incidentList}>
                  {opponentTwoMinIncidents.length === 0 ? <li>記録なし</li> : null}
                  {opponentTwoMinIncidents.map((incident) => (
                    <li key={incident.id} className={styles.incidentRow}>
                      <span>2分退場</span>
                      <span>{incident.minute}分</span>
                      <button type="button" className={styles.tinyDangerButton} onClick={() => deleteIncident(incident.id)}>削除</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.halfSummary}>
              <span>{`前半: ${firstHalfScore.our} - ${firstHalfScore.their}`}</span>
              <span>{`後半: ${secondHalfScore.our} - ${secondHalfScore.their}`}</span>
              <span>{`送信状況: 前半${firstHalfSaved ? "済" : "未"} / 後半${secondHalfSaved ? "済" : "未"}`}</span>
              <span>{`自動保存: ${draftSyncLabel}`}</span>
              {lastDraftSavedAt ? <span>{`最終同期: ${formatDateTime(new Date(lastDraftSavedAt))}`}</span> : null}
            </div>
          </div>

          <div>
            <h3>チーム項目記録（試行 / 成功 / 成功率）</h3>
            <div className={styles.playerTableWrap}>
              <table className={styles.playerTable}>
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>試行本数</th>
                    <th>成功数</th>
                    <th>成功率</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["quick", "速"],
                    ["left", "L"],
                    ["center", "C"],
                    ["pivot", "P"],
                    ["rebound", "Re"],
                    ["sevenMeter", "7"],
                  ] as const).map(([key, label]) => {
                    const keys = toTeamStatKeys(key);
                    const attempts = activeTeamStats[keys.attemptsKey];
                    const successes = activeTeamStats[keys.successesKey];
                    const rate = attempts > 0 ? `${Math.round((successes / attempts) * 100)}%` : "-";

                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        <td>{attempts}</td>
                        <td>{successes}</td>
                        <td>{rate}</td>
                        <td>
                          <div className={styles.scoreActions}>
                            <button type="button" className={styles.smallButton} onClick={() => updateCurrentTeamStatValue(keys.attemptsKey, -1)} disabled={isSubmitting || phase === "FINISHED"}>試-</button>
                            <button type="button" className={styles.smallButton} onClick={() => updateCurrentTeamStatValue(keys.attemptsKey, 1)} disabled={isSubmitting || phase === "FINISHED"}>試+</button>
                            <button type="button" className={styles.smallButton} onClick={() => updateCurrentTeamStatValue(keys.successesKey, -1)} disabled={isSubmitting || phase === "FINISHED"}>入-</button>
                            <button type="button" className={styles.smallButton} onClick={() => updateCurrentTeamStatValue(keys.successesKey, 1)} disabled={isSubmitting || phase === "FINISHED"}>入+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.playerTableWrap}>
            <table className={styles.playerTable}>
              <thead>
                <tr>
                  <th>選手</th>
                  <th>キーパー</th>
                  <th>シュート本数</th>
                  <th>ゴール数</th>
                  <th>成功率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rowView.map(({ stat, member }) => {
                  const label = member?.nickname || member?.name || "不明";
                  const ratio = stat.shotAttempts > 0
                    ? `${Math.round((stat.goals / stat.shotAttempts) * 100)}%`
                    : "-";

                  return (
                    <tr key={stat.memberId}>
                      <td>{label}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={stat.isGoalkeeper}
                          onChange={(event) => toggleCurrentGoalkeeper(stat.memberId, event.target.checked)}
                          disabled={isSubmitting || phase === "FINISHED"}
                        />
                      </td>
                      <td>{stat.shotAttempts}</td>
                      <td>{stat.goals}</td>
                      <td>{ratio}</td>
                      <td>
                        <div className={styles.scoreActions}>
                          <button type="button" className={styles.smallButton} onClick={() => updateCurrentPlayerStat(stat.memberId, "shotAttempts", -1)} disabled={isSubmitting || phase === "FINISHED"}>試-</button>
                          <button type="button" className={styles.smallButton} onClick={() => updateCurrentPlayerStat(stat.memberId, "shotAttempts", 1)} disabled={isSubmitting || phase === "FINISHED"}>試+</button>
                          <button type="button" className={styles.smallButton} onClick={() => updateCurrentPlayerStat(stat.memberId, "goals", -1)} disabled={isSubmitting || phase === "FINISHED"}>入-</button>
                          <button type="button" className={styles.smallButton} onClick={() => updateCurrentPlayerStat(stat.memberId, "goals", 1)} disabled={isSubmitting || phase === "FINISHED"}>入+</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.phaseActions}>
            {phase === "FIRST_HALF" ? (
              <button type="button" className={styles.button} onClick={() => savePeriod("FIRST_HALF")} disabled={isSubmitting}>
                前半終了を保存
              </button>
            ) : null}
            {phase === "SECOND_HALF" ? (
              <button type="button" className={styles.button} onClick={() => savePeriod("SECOND_HALF")} disabled={isSubmitting}>
                試合終了を保存
              </button>
            ) : null}
            <button type="button" className={styles.dangerButton} onClick={deleteMatchScore} disabled={isSubmitting}>
              この試合スコアを削除
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
