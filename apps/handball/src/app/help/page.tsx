import Link from "next/link";
import { readdir } from "node:fs/promises";
import path from "node:path";
import styles from "./help.module.css";

export const metadata = {
  title: "ヘルプ | Toyota Handball Notes",
  description: "リリースノートと各ページの使い方を確認できます。",
};

// Docker build 時に DB 接続有無へ依存せず、常に最新のルート一覧を表示できるよう動的化します。
export const dynamic = "force-dynamic";

type GuideAudience = "member" | "admin" | "support";

type GuideItem = {
  route: string;
  title: string;
  summary: string;
  steps: string[];
  audience: GuideAudience;
};

const EXCLUDED_ROUTE_PREFIXES = ["/api"];
const EXCLUDED_ROUTES = new Set(["/attendance", "/attendance/submit", "/practice-menus", "/practice-menus/new"]);

const GUIDE_OVERRIDES: Array<{
  test: (route: string) => boolean;
  title: string;
  summary: string;
  steps: string[];
  audience: GuideAudience;
}> = [
  {
    test: (route) => route === "/",
    title: "ホーム",
    summary: "カレンダー、通達、目標、フィードバック導線をまとめて確認するトップページです。",
    steps: [
      "月送りで予定のある日を探し、日付カードを押して詳細画面へ進みます。",
      "下部のメニューから体重入力、試合スコア、プロフィール更新へ移動します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/auth",
    title: "認証",
    summary: "ニックネームで登録またはログインを行う入口ページです。",
    steps: [
      "初回は登録フォームでニックネームを作成します。",
      "2回目以降は同じニックネームでログインします。",
    ],
    audience: "support",
  },
  {
    test: (route) => route === "/feedback",
    title: "フィードバック送信",
    summary: "アプリ改善の要望や不具合報告を送信するページです。",
    steps: [
      "内容を入力して送信します。",
      "送信された内容は管理者画面に表示され、サーバ管理者に通知されます。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/release-notes",
    title: "リリースノート",
    summary: "アプリの更新履歴と改善内容を確認するページです。",
    steps: [
      "新しい順で変更内容を確認します。",
      "運用ルール変更や追加機能がないか定期的に確認します。",
    ],
    audience: "support",
  },
  {
    test: (route) => route.startsWith("/calendar/"),
    title: "日別カレンダー",
    summary: "指定日のイベント詳細と自分の出席提出を確認するページです。",
    steps: [
      "予定のタイトル、時刻、メモを確認します。",
      "出席状態とコメントを入力して保存します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/self/profile",
    title: "プロフィール・目標",
    summary: "プロフィール情報と目標を更新するページです。",
    steps: [
      "表示名や学年など必要項目を更新します。",
      "年間目標、月間目標を入力して保存します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/self/weight",
    title: "体重入力",
    summary: "当日の体重とメモを登録するページです。",
    steps: [
      "体重を入力し、必要ならメモを追加します。",
      "保存後に履歴ページで推移を確認します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/self/weight-history",
    title: "体重履歴",
    summary: "体重の時系列推移を確認するページです。",
    steps: [
      "グラフで傾向を確認します。",
      "誤入力があれば対象データを削除します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/match-scores",
    title: "試合スコア一覧",
    summary: "試合ごとの結果や集計を閲覧するページです。",
    steps: [
      "一覧から対象試合を選びます。",
      "必要に応じて試合詳細ページへ進みます。",
    ],
    audience: "member",
  },
  {
    test: (route) => route.startsWith("/match-scores/"),
    title: "試合スコア詳細",
    summary: "1試合の詳細スタッツを確認するページです。",
    steps: [
      "前半・後半のスコア推移を確認します。",
      "選手別スタッツや記録内容を確認します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route === "/player-scores/new",
    title: "個人得点入力",
    summary: "試合ごとの個人得点やシュート本数を入力するページです。",
    steps: [
      "試合を選択して得点・試投数を入力します。",
      "必要に応じてメモを残して保存します。",
    ],
    audience: "member",
  },
  {
    test: (route) => route.startsWith("/l/"),
    title: "共有リンク入力",
    summary: "配布されたトークンURLから出席または体重を入力するページです。",
    steps: [
      "受け取ったURLを開いて入力画面へ進みます。",
      "必要項目を送信すると期限内に1回分が記録されます。",
    ],
    audience: "support",
  },
  {
    test: (route) => route === "/admin",
    title: "管理ダッシュボード",
    summary: "管理者とマネージャー向けの管理起点ページです。",
    steps: [
      "出席イベント作成、部員管理、各種管理ページへの導線を利用します。",
      "役割に応じて利用可能な管理機能を確認します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/feedback",
    title: "フィードバック一覧",
    summary: "部員から届いたフィードバックを確認する管理ページです。",
    steps: [
      "投稿日時順で内容を確認します。",
      "必要な改善タスクをチーム内で起票します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/manager",
    title: "マネージャーウィンドウ",
    summary: "出席率、得点率、最新体重などを俯瞰するページです。",
    steps: [
      "気になるメンバーの状態を確認します。",
      "詳細入力ページへ遷移してデータ更新します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/manager/weights",
    title: "体重一括入力",
    summary: "複数メンバーの体重をまとめて記録するページです。",
    steps: [
      "対象メンバーの体重を一覧入力します。",
      "保存後に反映内容を履歴で確認します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/manager/match-score",
    title: "試合スコア入力",
    summary: "試合結果のチームスコアと付随情報を入力するページです。",
    steps: [
      "対象試合を選んでスコアを入力します。",
      "必要なら詳細入力画面へ進みます。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/manager/match-score/input",
    title: "試合スコア詳細入力",
    summary: "前後半の詳細スタッツや出来事を記録するページです。",
    steps: [
      "前半・後半ごとのチームデータを入力します。",
      "保存後に表示画面で数値の整合性を確認します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route === "/admin/release-notes",
    title: "リリースノート管理",
    summary: "admin ユーザーがリリースノートを作成するページです。",
    steps: [
      "version、title、content を入力して作成します。",
      "公開後はユーザー向けページで表示確認します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route.startsWith("/admin/members/") && route.endsWith("/attendance"),
    title: "部員別出席履歴",
    summary: "部員個別の出席履歴を確認するページです。",
    steps: [
      "期間やイベントごとの傾向を確認します。",
      "必要なら本人へ入力運用を案内します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route.startsWith("/admin/members/") && route.endsWith("/weight"),
    title: "部員別体重推移",
    summary: "部員個別の体重推移を確認するページです。",
    steps: [
      "グラフや履歴の増減を確認します。",
      "必要に応じて入力漏れや異常値を点検します。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route.startsWith("/admin/members/") && route.endsWith("/scores"),
    title: "部員別得点履歴",
    summary: "部員個別の得点・シュート履歴を確認するページです。",
    steps: [
      "試合ごとの得点状況を確認します。",
      "分析したい試合は詳細ページで深掘りします。",
    ],
    audience: "admin",
  },
  {
    test: (route) => route.startsWith("/admin/members/"),
    title: "部員詳細ダッシュボード",
    summary: "部員単位の詳細データへアクセスするハブページです。",
    steps: [
      "基本情報と各種サマリーを確認します。",
      "出席、体重、得点など個別画面へ移動します。",
    ],
    audience: "admin",
  },
];

async function collectAppPageRoutes(dirPath: string, segments: string[] = []): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const routes: string[] = [];

  const hasPage = entries.some((entry) => entry.isFile() && entry.name === "page.tsx");
  if (hasPage) {
    routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith("_")) {
      continue;
    }
    const childPath = path.join(dirPath, entry.name);
    const childRoutes = await collectAppPageRoutes(childPath, [...segments, entry.name]);
    routes.push(...childRoutes);
  }

  return routes;
}

function includeRoute(route: string): boolean {
  if (EXCLUDED_ROUTES.has(route)) {
    return false;
  }

  return !EXCLUDED_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
}

function fallbackGuide(route: string): GuideItem {
  const isAdminRoute = route.startsWith("/admin");
  return {
    route,
    title: route === "/" ? "ホーム" : `ページ ${route}`,
    summary: "画面内の案内に沿って入力・閲覧を行うページです。",
    steps: [
      "ページ内の見出しと説明文を確認します。",
      "必要な入力欄やボタンを使って操作します。",
    ],
    audience: isAdminRoute ? "admin" : "member",
  };
}

function routeToGuide(route: string): GuideItem {
  const override = GUIDE_OVERRIDES.find((entry) => entry.test(route));
  if (!override) {
    return fallbackGuide(route);
  }

  return {
    route,
    title: override.title,
    summary: override.summary,
    steps: override.steps,
    audience: override.audience,
  };
}

function sortGuideItems(items: GuideItem[]): GuideItem[] {
  return [...items].sort((a, b) => a.route.localeCompare(b.route));
}

function sectionLabel(audience: GuideAudience): string {
  if (audience === "member") {
    return "部員向けページ";
  }
  if (audience === "admin") {
    return "管理者・マネージャー向けページ";
  }
  return "認証・共有・共通ページ";
}

function isDirectNavigableRoute(route: string): boolean {
  return !route.includes("[");
}

export default async function HelpPage() {
  const appDir = path.join(process.cwd(), "src", "app");
  const allRoutes = await collectAppPageRoutes(appDir);
  const guides = sortGuideItems(allRoutes.filter(includeRoute).map(routeToGuide));

  const grouped: Record<GuideAudience, GuideItem[]> = {
    member: guides.filter((item) => item.audience === "member"),
    admin: guides.filter((item) => item.audience === "admin"),
    support: guides.filter((item) => item.audience === "support"),
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>ヘルプ</h1>
        <p>リリースノートと、各ページの使い方をここで確認できます。</p>
        <div className={styles.actions}>
          <Link href="/release-notes" className={styles.primaryButton}>
            リリースノートを見る
          </Link>
          <a href="#guide" className={styles.secondaryButton}>
            使い方一覧へ移動
          </a>
        </div>
      </header>

      <section className={styles.noteCard}>
        <h2>使い方一覧について</h2>
        <p>
          この一覧は src/app 配下の page.tsx を読み取り、自動生成しています。
          ルートを追加するとヘルプにも自動で反映されます。
        </p>
      </section>

      <section id="guide" className={styles.guideSection}>
        {["member", "admin", "support"].map((audience) => {
          const key = audience as GuideAudience;
          const items = grouped[key];
          if (items.length === 0) {
            return null;
          }

          return (
            <article key={key} className={styles.groupCard}>
              <h2>{sectionLabel(key)}</h2>
              <ul className={styles.guideList}>
                {items.map((item) => (
                  <li key={item.route} className={styles.guideItem}>
                    <div className={styles.itemHeader}>
                      <h3>{item.title}</h3>
                      <span className={styles.routeLabel}>{item.route}</span>
                    </div>
                    <p className={styles.summary}>{item.summary}</p>
                    <ul className={styles.steps}>
                      {item.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                    {isDirectNavigableRoute(item.route) ? (
                      <Link href={item.route} className={styles.pageLink}>
                        このページを開く
                      </Link>
                    ) : (
                      <p className={styles.dynamicNote}>動的ルートのため、画面内リンクから開いてください。</p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </main>
  );
}