"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./home-dashboard.module.css";

type FloatingMobileTabsProps = {
  monthQuery: string;
};

type TimerPreset = {
  id: string;
  label: string;
  durationSeconds: number;
  setCount?: number;
  description: string;
  isSystemPreset?: boolean;
  createdByMemberId?: string | null;
  canDelete?: boolean;
};

type TimerState = {
  presetId: string;
  label: string;
  durationSeconds: number;
  setCount: number;
  totalDurationSeconds: number;
  startedAt: number;
  endAt: number;
};

const STORAGE_KEY = "club-activity-timer-state-v1";
const BOTTOM_THRESHOLD_PX = 24;
const DEFAULT_TIMER_PRESETS: TimerPreset[] = [
  { id: "timer-system-break-120", label: "休憩2分", durationSeconds: 120, description: "休憩", isSystemPreset: true },
  { id: "timer-system-interval-120-6", label: "2:00 × 6セット", durationSeconds: 120, setCount: 6, description: "2分セットの練習", isSystemPreset: true },
  { id: "timer-system-interval-150-6", label: "2:30 × 6セット", durationSeconds: 150, setCount: 6, description: "2分30秒セットの練習", isSystemPreset: true },
];

function isNearBottom(): boolean {
  const documentHeight = document.documentElement.scrollHeight;
  const viewportBottom = window.scrollY + window.innerHeight;
  return viewportBottom >= documentHeight - BOTTOM_THRESHOLD_PX;
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  if (minutes === 0) {
    return `${seconds}秒`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTimerPreset(preset: TimerPreset): string {
  if (!preset.setCount || preset.setCount === 1) {
    return formatDuration(preset.durationSeconds);
  }

  const totalDurationSeconds = preset.durationSeconds * preset.setCount;
  return `${formatDuration(preset.durationSeconds)} × ${preset.setCount}（合計 ${formatDuration(totalDurationSeconds)}）`;
}

function getTimerProgress(timerState: TimerState, remainingSeconds: number, referenceTime: number) {
  const elapsedSeconds = Math.max(0, Math.floor((referenceTime - timerState.startedAt) / 1000));
  const completedSets = Math.min(timerState.setCount, Math.floor(elapsedSeconds / timerState.durationSeconds));
  const currentSetIndex = Math.min(timerState.setCount, Math.max(1, completedSets + (remainingSeconds > 0 ? 1 : 0)));
  const remainingSets = Math.max(0, timerState.setCount - completedSets);
  const currentSetElapsedSeconds = timerState.durationSeconds === 0 ? 0 : elapsedSeconds % timerState.durationSeconds;
  const setRemainingSeconds = remainingSeconds > 0 ? Math.max(0, timerState.durationSeconds - currentSetElapsedSeconds) : 0;

  return {
    currentSetIndex,
    completedSets,
    remainingSets,
    currentSetElapsedSeconds,
    setRemainingSeconds,
  };
}

function readStoredTimer(): TimerState | null {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<TimerState>;
    if (
      typeof parsed.presetId !== "string"
      || typeof parsed.label !== "string"
      || typeof parsed.durationSeconds !== "number"
      || typeof parsed.startedAt !== "number"
      || typeof parsed.endAt !== "number"
      || parsed.endAt <= Date.now()
    ) {
      return null;
    }

    return {
      presetId: parsed.presetId,
      label: parsed.label,
      durationSeconds: parsed.durationSeconds,
      setCount: typeof parsed.setCount === "number" && parsed.setCount > 0 ? parsed.setCount : 1,
      totalDurationSeconds:
        typeof parsed.totalDurationSeconds === "number" && parsed.totalDurationSeconds > 0
          ? parsed.totalDurationSeconds
          : parsed.durationSeconds,
      startedAt: parsed.startedAt,
      endAt: parsed.endAt,
    };
  } catch {
    return null;
  }
}

function createCompletionTone(audioContext: AudioContext) {
  [0, 0.16, 0.32].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = index === 1 ? 1046 : 880;
    gainNode.gain.value = 0.0001;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const startAt = audioContext.currentTime + offset;
    oscillator.start(startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.22, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
    oscillator.stop(startAt + 0.16);
  });
}

function playCompletionTone(audioContext: AudioContext | null) {
  try {
    if (!audioContext) {
      return;
    }

    createCompletionTone(audioContext);
  } catch {
    // 音声再生に失敗してもタイマー完了は継続します。
  }
}

export function FloatingMobileTabs({ monthQuery }: FloatingMobileTabsProps) {
  const [raised, setRaised] = useState(false);
  const [isTimerSheetOpen, setIsTimerSheetOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("5");
  const [timerPresets, setTimerPresets] = useState<TimerPreset[]>(DEFAULT_TIMER_PRESETS);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [statusMessage, setStatusMessage] = useState("");
  const [intervalFlashMessage, setIntervalFlashMessage] = useState("");
  const [completionFlashMessage, setCompletionFlashMessage] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const [newPresetName, setNewPresetName] = useState("マイタイマー");
  const [newPresetMinutes, setNewPresetMinutes] = useState("1");
  const [newPresetSeconds, setNewPresetSeconds] = useState("30");
  const [newPresetSetCount, setNewPresetSetCount] = useState("1");
  const [newPresetDescription, setNewPresetDescription] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetFormMessage, setPresetFormMessage] = useState("");
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const completionAlarmIntervalRef = useRef<number | null>(null);
  const intervalFlashTimeoutRef = useRef<number | null>(null);
  const lastAnnouncedCompletedSetsRef = useRef(0);

  useEffect(() => {
    const update = () => setRaised(isNearBottom());

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    setTimerState(readStoredTimer());
  }, []);

  useEffect(() => {
    if (!timerState) {
      lastAnnouncedCompletedSetsRef.current = 0;
      if (completionAlarmIntervalRef.current !== null) {
        window.clearInterval(completionAlarmIntervalRef.current);
        completionAlarmIntervalRef.current = null;
      }
      if (intervalFlashTimeoutRef.current !== null) {
        window.clearTimeout(intervalFlashTimeoutRef.current);
        intervalFlashTimeoutRef.current = null;
      }
      setIntervalFlashMessage("");
      setCompletionFlashMessage("");
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    lastAnnouncedCompletedSetsRef.current = Math.min(
      timerState.setCount,
      Math.floor(Math.max(0, Date.now() - timerState.startedAt) / 1000 / timerState.durationSeconds),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timerState));
  }, [timerState]);

  useEffect(() => {
    if (!timerState) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerState]);

  useEffect(() => {
    let cancelled = false;

    async function loadTimerPresets() {
      try {
        const response = await fetch("/api/timer-presets", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { timerPresets?: TimerPreset[] };
        if (!cancelled && Array.isArray(data.timerPresets) && data.timerPresets.length > 0) {
          setTimerPresets(data.timerPresets);
        }
      } catch {
        // 取得に失敗した場合は組み込みプリセットをそのまま使います。
      }
    }

    void loadTimerPresets();

    return () => {
      cancelled = true;
    };
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!timerState) {
      return 0;
    }

    return Math.max(0, Math.ceil((timerState.endAt - now) / 1000));
  }, [now, timerState]);

  const timerProgress = useMemo(() => {
    if (!timerState) {
      return null;
    }

    return getTimerProgress(timerState, remainingSeconds, now);
  }, [remainingSeconds, timerState]);

  useEffect(() => {
    if (!timerState || remainingSeconds <= 0) {
      return;
    }

    const completedSets = Math.min(timerState.setCount, Math.floor(Math.max(0, (now - timerState.startedAt) / 1000) / timerState.durationSeconds));
    if (completedSets > lastAnnouncedCompletedSetsRef.current) {
      const audioContext = ensureAudioContext();
      if (audioContext && audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {});
      }

      for (let completedSet = lastAnnouncedCompletedSetsRef.current + 1; completedSet <= completedSets; completedSet += 1) {
        playCompletionTone(audioContextRef.current);
      }

      lastAnnouncedCompletedSetsRef.current = completedSets;

      if (completedSets < timerState.setCount) {
        const remainingSets = timerState.setCount - completedSets;
        setStatusMessage(`${completedSets}/${timerState.setCount} セットが終了しました。残り ${remainingSets} セットです`);
        setCompletionFlashMessage("");
        setIntervalFlashMessage(`${completedSets}/${timerState.setCount} セット終了`);
        if (intervalFlashTimeoutRef.current !== null) {
          window.clearTimeout(intervalFlashTimeoutRef.current);
        }
        intervalFlashTimeoutRef.current = window.setTimeout(() => {
          setIntervalFlashMessage("");
          intervalFlashTimeoutRef.current = null;
        }, 900);
      }
    }
  }, [now, remainingSeconds, timerState]);

  useEffect(() => {
    if (!timerState || remainingSeconds > 0) {
      return;
    }

    const completedSets = timerState.setCount;
    if (completedSets > lastAnnouncedCompletedSetsRef.current) {
      const audioContext = ensureAudioContext();
      if (audioContext && audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {});
      }

      for (let completedSet = lastAnnouncedCompletedSetsRef.current + 1; completedSet <= completedSets; completedSet += 1) {
        playCompletionTone(audioContextRef.current);
      }

      lastAnnouncedCompletedSetsRef.current = completedSets;
    }

    if (!completionFlashMessage) {
      const finishedLabel = timerState.label;
      if (intervalFlashTimeoutRef.current !== null) {
        window.clearTimeout(intervalFlashTimeoutRef.current);
        intervalFlashTimeoutRef.current = null;
      }
      setIntervalFlashMessage("");
      setCompletionFlashMessage(finishedLabel);
      setStatusMessage(`${finishedLabel}が終了しました。タップして音を止めます。`);
      playCompletionTone(audioContextRef.current);

      if (completionAlarmIntervalRef.current === null) {
        completionAlarmIntervalRef.current = window.setInterval(() => {
          playCompletionTone(audioContextRef.current);
        }, 1200);
      }

      if ("vibrate" in navigator) {
        navigator.vibrate([180, 80, 180]);
      }
    }
  }, [completionFlashMessage, remainingSeconds, timerState]);

  function ensureAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const audioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioContextConstructor) {
      return null;
    }

    audioContextRef.current = new audioContextConstructor();
    return audioContextRef.current;
  }

  function clearCompletionAlarm() {
    if (completionAlarmIntervalRef.current !== null) {
      window.clearInterval(completionAlarmIntervalRef.current);
      completionAlarmIntervalRef.current = null;
    }
  }

  function clearIntervalFlash() {
    if (intervalFlashTimeoutRef.current !== null) {
      window.clearTimeout(intervalFlashTimeoutRef.current);
      intervalFlashTimeoutRef.current = null;
    }

    setIntervalFlashMessage("");
  }

  function dismissCompletionAlert() {
    clearCompletionAlarm();
    clearIntervalFlash();
    const finishedLabel = completionFlashMessage;
    setCompletionFlashMessage("");
    setTimerState(null);
    if (finishedLabel) {
      setStatusMessage(`${finishedLabel}が終了しました`);
    }
  }

  function startTimer(preset: TimerPreset) {
    clearCompletionAlarm();
    clearIntervalFlash();
    setCompletionFlashMessage("");
    const startedAt = Date.now();
    const setCount = preset.setCount && preset.setCount > 0 ? preset.setCount : 1;
    const totalDurationSeconds = preset.durationSeconds * setCount;
    const audioContext = ensureAudioContext();
    if (audioContext && audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }
    setTimerState({
      presetId: preset.id,
      label: preset.label,
      durationSeconds: preset.durationSeconds,
      setCount,
      totalDurationSeconds,
      startedAt,
      endAt: startedAt + totalDurationSeconds * 1000,
    });
    setStatusMessage(`${preset.label}を開始しました`);
    setIsTimerSheetOpen(false);
  }

  async function createTimerPreset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSavingPreset) {
      return;
    }

    const minutes = Number(newPresetMinutes);
    const seconds = Number(newPresetSeconds);
    const setCount = Number(newPresetSetCount);
    const totalDurationSeconds = Math.round(minutes * 60 + seconds);

    if (!newPresetName.trim()) {
      setPresetFormMessage("名前を入力してください");
      return;
    }

    if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds < 10) {
      setPresetFormMessage("10秒以上になるように設定してください");
      return;
    }

    if (!Number.isFinite(setCount) || setCount < 1 || setCount > 99) {
      setPresetFormMessage("セット数は1〜99で入力してください");
      return;
    }

    const optimisticPreset: TimerPreset = {
      id: `timer-optimistic-${Date.now()}`,
      label: newPresetName.trim(),
      durationSeconds: totalDurationSeconds,
      setCount,
      description: newPresetDescription.trim() || "自作タイマー",
      isSystemPreset: false,
      canDelete: true,
    };

    startTimer(optimisticPreset);
    setIsSavingPreset(true);
    setPresetFormMessage("");
    const requestAbortController = new AbortController();
    const requestTimeoutId = window.setTimeout(() => {
      requestAbortController.abort();
    }, 15000);

    try {
      const response = await fetch("/api/timer-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestAbortController.signal,
        body: JSON.stringify({
          label: newPresetName.trim(),
          durationSeconds: totalDurationSeconds,
          setCount,
          description: newPresetDescription.trim(),
        }),
      });

      const payload = (await response.json()) as { timerPreset?: TimerPreset; error?: string };
      if (!response.ok || !payload.timerPreset) {
        setPresetFormMessage(payload.error === "unauthorized" ? "ログインが必要です" : "タイマーの登録に失敗しました");
        return;
      }

      const createdPreset = payload.timerPreset;
      setTimerPresets((current) => [createdPreset, ...current.filter((preset) => preset.id !== createdPreset.id)]);
      setTimerState((current) => {
        if (!current || current.presetId !== optimisticPreset.id) {
          return current;
        }

        const savedSetCount = createdPreset.setCount && createdPreset.setCount > 0 ? createdPreset.setCount : 1;
        const savedTotalDurationSeconds = createdPreset.durationSeconds * savedSetCount;

        return {
          ...current,
          presetId: createdPreset.id,
          label: createdPreset.label,
          durationSeconds: createdPreset.durationSeconds,
          setCount: savedSetCount,
          totalDurationSeconds: savedTotalDurationSeconds,
          endAt: current.startedAt + savedTotalDurationSeconds * 1000,
        };
      });
      setPresetFormMessage("タイマーを登録して開始しました");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setPresetFormMessage("タイマーは開始しました。登録通信がタイムアウトしました");
        return;
      }
      setPresetFormMessage("タイマーは開始しました。登録に失敗しました");
    } finally {
      window.clearTimeout(requestTimeoutId);
      setIsSavingPreset(false);
    }
  }

  async function deleteTimerPreset(preset: TimerPreset) {
    if (preset.isSystemPreset) {
      return;
    }

    const confirmed = window.confirm(`${preset.label}を削除しますか？`);
    if (!confirmed) {
      return;
    }

    setDeletingPresetId(preset.id);
    setPresetFormMessage("");

    try {
      const response = await fetch(`/api/timer-presets/${preset.id}`, { method: "DELETE" });
      if (!response.ok) {
        setPresetFormMessage(response.status === 403 ? "このタイマーは削除できません" : "タイマーの削除に失敗しました");
        return;
      }

      setTimerPresets((current) => current.filter((item) => item.id !== preset.id));
      setPresetFormMessage("タイマーを削除しました");
    } catch {
      setPresetFormMessage("タイマーの削除に失敗しました");
    } finally {
      setDeletingPresetId(null);
    }
  }

  function startCustomTimer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
      setStatusMessage("1〜120分の範囲で入力してください");
      return;
    }

    const durationSeconds = Math.round(minutes * 60);
    startTimer({
      id: `custom-${minutes}`,
      label: `${minutes}分タイマー`,
      durationSeconds,
      description: "カスタム設定",
    });
  }

  function stopTimer() {
    if (!timerState) {
      return;
    }

    clearCompletionAlarm();
    clearIntervalFlash();
    setCompletionFlashMessage("");
    setTimerState(null);
    setStatusMessage(`${timerState.label}を停止しました`);
  }

  return (
    <>
      <nav
        className={`${styles.mobileTabs} ${raised ? styles.mobileTabsRaised : ""}`.trim()}
        aria-label="メイン操作タブ"
      >
        <Link href="/table-tennis-notes" className={styles.mobileTab}>卓球ノート</Link>
        <Link href="/match-feedbacks" className={styles.mobileTab}>試合振り返り</Link>
        <Link href={`/self/profile${monthQuery}`} className={styles.mobileTab}>プロフィール</Link>
        <button
          type="button"
          className={`${styles.mobileTab} ${timerState ? styles.timerTabActive : ""}`.trim()}
          aria-haspopup="dialog"
          aria-expanded={isTimerSheetOpen}
          onClick={() => setIsTimerSheetOpen(true)}
        >
          <span className={styles.mobileTabLabel}>タイマー</span>
          <span className={styles.timerTabValue}>
            {timerState ? (
              timerState.setCount > 1 && timerProgress ? (
                <>
                  <span>{`${timerProgress.currentSetIndex}/${timerState.setCount}`}</span>
                  <span>{`残り ${timerProgress.remainingSets} セット`}</span>
                </>
              ) : (
                <span>{formatDuration(remainingSeconds)}</span>
              )
            ) : (
              <span>選択</span>
            )}
          </span>
        </button>
      </nav>

      {completionFlashMessage ? (
        <button
          type="button"
          className={styles.timerCompletionFlash}
          onClick={dismissCompletionAlert}
          aria-label={`${completionFlashMessage}が終了しました。タップして音を止めます。`}
        >
          <span className={styles.timerCompletionFlashInner}>
            <span>{completionFlashMessage} が終了しました</span>
            <span>タップして音を止めます</span>
          </span>
        </button>
      ) : null}

      {intervalFlashMessage ? (
        <div className={styles.timerIntervalFlash} aria-hidden="true">
          <span className={styles.timerIntervalFlashInner}>
            <span>{intervalFlashMessage}</span>
            <span>残り {timerProgress ? timerProgress.remainingSets : timerState?.setCount ?? 0} セット</span>
          </span>
        </div>
      ) : null}

      {isTimerSheetOpen ? (
        <div className={styles.timerOverlay} role="presentation" onClick={() => setIsTimerSheetOpen(false)}>
          <section
            className={styles.timerCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-timer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.timerCardHeader}>
              <div>
                <p className={styles.timerEyebrow}>部活動タイマー</p>
                <h2 id="activity-timer-title">タイマーを選択</h2>
                <p className={styles.timerLead}>練習や休憩の切り替えに使うタイマーをすぐ起動できます。</p>
              </div>
              <button type="button" className={styles.timerCloseButton} onClick={() => setIsTimerSheetOpen(false)}>
                閉じる
              </button>
            </div>

            {timerState ? (
              <section className={styles.timerActivePanel}>
                <div>
                  <p className={styles.timerActiveLabel}>実行中</p>
                  <h3>{timerState.label}</h3>
                  {timerState.setCount > 1 ? (
                    <>
                      <p className={styles.timerSetLabel}>
                        {timerProgress ? `${timerProgress.currentSetIndex}/${timerState.setCount} セット` : `${timerState.setCount} セット`}
                      </p>
                      {timerProgress ? <p className={styles.timerSetLabel}>残り {timerProgress.remainingSets} セット</p> : null}
                    </>
                  ) : null}
                </div>
                <div className={styles.timerCountdown}>{formatDuration(remainingSeconds)}</div>
                {timerState.setCount > 1 && timerProgress ? (
                  <div className={styles.timerSetProgressText}>
                    現在のセット残り {formatDuration(timerProgress.setRemainingSeconds)} / 残り {timerProgress.remainingSets} セット / 合計 {formatDuration(remainingSeconds)}
                  </div>
                ) : null}
                <div className={styles.timerProgressTrack} aria-hidden="true">
                  <div
                    className={styles.timerProgressFill}
                    style={{ width: `${Math.max(0, Math.min(100, (remainingSeconds / timerState.totalDurationSeconds) * 100))}%` }}
                  />
                </div>
                <div className={styles.timerCardActions}>
                  <button type="button" className={styles.secondaryButton} onClick={stopTimer}>停止</button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => startTimer(timerPresets.find((preset) => preset.id === timerState.presetId) || timerPresets[0])}
                  >
                    同じタイマーを再開
                  </button>
                </div>
              </section>
            ) : null}

            <section className={styles.timerSection}>
              <h3>プリセット</h3>
              <div className={styles.timerPresetGrid}>
                {timerPresets.map((preset) => (
                  <div key={preset.id} className={styles.timerPresetCard}>
                    <button
                      type="button"
                      className={styles.timerPresetButton}
                      onClick={() => startTimer(preset)}
                    >
                      <span className={styles.timerPresetBadge}>{preset.isSystemPreset ? "標準" : "自作"}</span>
                      <span className={styles.timerPresetLabel}>{preset.label}</span>
                      <span className={styles.timerPresetDuration}>{formatTimerPreset(preset)}</span>
                      <span className={styles.timerPresetDescription}>{preset.description}</span>
                    </button>
                    {preset.canDelete ? (
                      <div className={styles.timerPresetActions}>
                        <button
                          type="button"
                          className={styles.timerPresetDeleteButton}
                          disabled={deletingPresetId === preset.id}
                          onClick={() => deleteTimerPreset(preset)}
                        >
                          {deletingPresetId === preset.id ? "削除中..." : "削除"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.timerCreateSection}>
              <h3>新しいタイマーを登録</h3>
              <form className={styles.timerCreateForm} onSubmit={createTimerPreset} data-disable-global-nav-loading="true">
                <label className={styles.timerField}>
                  <span>名前</span>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(event) => setNewPresetName(event.target.value)}
                    placeholder="例: 追い込みインターバル"
                  />
                </label>
                <label className={styles.timerField}>
                  <span>分</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    value={newPresetMinutes}
                    onChange={(event) => setNewPresetMinutes(event.target.value)}
                  />
                </label>
                <label className={styles.timerField}>
                  <span>秒</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={newPresetSeconds}
                    onChange={(event) => setNewPresetSeconds(event.target.value)}
                  />
                </label>
                <label className={styles.timerField}>
                  <span>セット数</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    value={newPresetSetCount}
                    onChange={(event) => setNewPresetSetCount(event.target.value)}
                  />
                </label>
                <label className={`${styles.timerField} ${styles.timerCreateDescriptionField}`.trim()}>
                  <span>説明</span>
                  <input
                    type="text"
                    value={newPresetDescription}
                    onChange={(event) => setNewPresetDescription(event.target.value)}
                    placeholder="例: 守備フットワーク用"
                  />
                </label>
                <div className={styles.timerCreateActions}>
                  <button type="submit" className={styles.primaryButton}>登録して開始</button>
                </div>
              </form>
              {presetFormMessage ? <p className={styles.timerStatus}>{presetFormMessage}</p> : null}
            </section>

            <form className={styles.timerCustomForm} onSubmit={startCustomTimer} data-disable-global-nav-loading="true">
              <label className={styles.timerField}>
                <span>カスタム分数</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  inputMode="numeric"
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                />
              </label>
              <button type="submit" className={styles.primaryButton}>この分数で開始</button>
            </form>

            {statusMessage ? <p className={styles.timerStatus}>{statusMessage}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
