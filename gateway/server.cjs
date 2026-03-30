const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const SPORT_COOKIE = "club_sport";
const HAND = "handball";
const TT = "table-tennis";
const LISTEN_PORT = Number(process.env.PORT || 3000);
const FORCE_HTTPS = String(process.env.FORCE_HTTPS || "false").toLowerCase() === "true";
const HANDBALL_LOCAL_DB_URL = "postgresql://club:clubpass@postgres:5432/handball_notes?schema=public";
const TABLE_TENNIS_LOCAL_DB_URL = "postgresql://club:clubpass@postgres:5432/table_tennis_notes?schema=public";

const handballTarget = `http://127.0.0.1:${process.env.HANDBALL_PORT || 3001}`;
const tableTennisTarget = `http://127.0.0.1:${process.env.TABLE_TENNIS_PORT || 3002}`;

const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${LISTEN_PORT}`;

const app = express();
app.set("trust proxy", true);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
	if (!FORCE_HTTPS) {
		next();
		return;
	}

	const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
	if (!forwardedProto || forwardedProto === "https") {
		next();
		return;
	}

	const host = req.headers.host;
	if (!host) {
		next();
		return;
	}

	res.redirect(301, `https://${host}${req.originalUrl}`);
});

const childProcesses = [];

function getSport(req) {
	const value = req.cookies?.[SPORT_COOKIE];
	if (value === HAND || value === TT) {
		return value;
	}
	return null;
}

function runOrFail(command, args, env, label) {
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		env,
		stdio: "inherit",
		shell: false,
	});

	if (result.status !== 0) {
		throw new Error(`${label} failed with exit code ${result.status}`);
	}
}

function runWithStatus(command, args, env) {
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		env,
		stdio: "inherit",
		shell: false,
	});

	return result.status === 0;
}

function canConnectPostgres(host, port) {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host, port });
		let finished = false;

		const done = (ok) => {
			if (finished) {
				return;
			}
			finished = true;
			socket.destroy();
			resolve(ok);
		};

		socket.once("connect", () => done(true));
		socket.once("error", () => done(false));
		socket.setTimeout(1000, () => done(false));
	});
}

async function waitForPostgres() {
	const maxAttempts = 120;
	const host = "postgres";
	const port = 5432;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const ok = await canConnectPostgres(host, port);
		if (ok) {
			console.log("postgres is ready");
			return;
		}

		if (attempt % 10 === 0) {
			console.warn(`waiting for postgres... (${attempt}/${maxAttempts})`);
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	throw new Error("postgres did not become ready in time");
}

function launchStandaloneApp(label, appDir, port, env) {
	const nestedStandalonePath = `.next/standalone/${appDir.replace(/\\/g, "/")}/server.js`;
	const serverEntry = fs.existsSync(`${appDir}/${nestedStandalonePath}`)
		? nestedStandalonePath
		: ".next/standalone/server.js";

	const child = spawn("node", [serverEntry], {
		cwd: appDir,
		env: {
			...env,
			PORT: String(port),
		},
		stdio: "inherit",
		shell: false,
	});

	child.on("exit", (code) => {
		if (code !== 0) {
			console.error(`${label} exited with code ${code}`);
		}
	});

	childProcesses.push(child);
}

function buildAppEnv(baseEnv, dbUrl, adminKey) {
	return {
		...baseEnv,
		DATABASE_URL: dbUrl,
		ADMIN_VIEW_KEY: adminKey,
		NEXT_PUBLIC_APP_BASE_URL: publicBaseUrl,
		HOSTNAME: "0.0.0.0",
	};
}

async function startInternalApps() {
	await waitForPostgres();

	const handballEnv = buildAppEnv(
		process.env,
		HANDBALL_LOCAL_DB_URL,
		process.env.HANDBALL_ADMIN_VIEW_KEY || "toyota-handball-admin",
	);
	const tableTennisEnv = buildAppEnv(
		process.env,
		TABLE_TENNIS_LOCAL_DB_URL,
		process.env.TABLE_TENNIS_ADMIN_VIEW_KEY || "toyota-table-tennis-admin",
	);

	const handballMigrateOk = runWithStatus("npm", ["--prefix", "apps/handball", "run", "db:migrate:deploy"], handballEnv);
	if (!handballMigrateOk) {
		console.warn("handball migrate deploy failed; fallback to db:push");
		runOrFail("npm", ["--prefix", "apps/handball", "run", "db:push"], handballEnv, "handball db push");
	}

	const tableTennisMigrateOk = runWithStatus(
		"npm",
		["--prefix", "apps/table-tennis", "run", "db:migrate:deploy"],
		tableTennisEnv,
	);
	if (!tableTennisMigrateOk) {
		console.warn("table-tennis migrate deploy failed; fallback to db:push");
		runOrFail("npm", ["--prefix", "apps/table-tennis", "run", "db:push"], tableTennisEnv, "table-tennis db push");
	}

	launchStandaloneApp("handball", "apps/handball", Number(process.env.HANDBALL_PORT || 3001), handballEnv);
	launchStandaloneApp("table-tennis", "apps/table-tennis", Number(process.env.TABLE_TENNIS_PORT || 3002), tableTennisEnv);
}

app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
	const selected = getSport(req);
	const selectedLabel = selected === HAND ? "現在はハンドボールを選択中" : selected === TT ? "現在は卓球を選択中" : "まだ未選択です";

	res.status(200).type("html").send(`<!doctype html>
<html lang="ja">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Toyota Kosen Club Activities</title>
	<style>
		:root { color-scheme: light; }
		body { margin: 0; font-family: "Segoe UI", sans-serif; background: linear-gradient(135deg, #f9fbff, #e8f1ff); color: #13233a; }
		main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
		.card { width: min(520px, 100%); background: rgba(255,255,255,0.95); border-radius: 20px; box-shadow: 0 18px 50px rgba(19,35,58,0.12); padding: 28px; }
		h1 { margin: 0 0 10px; font-size: 1.6rem; }
		p { margin: 0 0 12px; line-height: 1.6; }
		.status { margin: 0 0 20px; font-weight: 600; color: #24508b; }
		form { display: grid; gap: 12px; }
		button { border: 0; border-radius: 12px; padding: 12px 14px; font-weight: 700; cursor: pointer; }
		.hand { background: linear-gradient(120deg, #170f11 0%, #2c0f17 56%, #3a121b 100%); color: #fff2f4; }
		.tt { background: #ffffff; color: #2f4d61; border: 1px solid #cbd9e2; }
		.go { background: #1e40af; color: #fff; margin-top: 8px; width: 100%; }
	</style>
</head>
<body>
	<main>
		<section class="card">
			<h1>部活アプリを選択</h1>
			<p>最初に利用する部活を選択してください。選択後は同じURLで各アプリのログインページへ遷移します。</p>
			<p class="status">${selectedLabel}</p>
			<form action="/select" method="post">
				<button class="hand" type="submit" name="sport" value="${HAND}">ハンドボール</button>
				<button class="tt" type="submit" name="sport" value="${TT}">卓球</button>
			</form>
			${selected ? "<form action=\"/auth\" method=\"get\"><button class=\"go\" type=\"submit\">選択中のアプリへ進む</button></form>" : ""}
		</section>
	</main>
</body>
</html>`);
});

app.post("/select", (req, res) => {
	const sport = String(req.body.sport || "");

	if (sport !== HAND && sport !== TT) {
		res.redirect(303, "/");
		return;
	}

	res.cookie(SPORT_COOKIE, sport, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});

	res.redirect(303, "/auth");
});

app.get("/auth", (req, res) => {
	const selected = getSport(req);
	if (!selected) {
		res.redirect(303, "/");
		return;
	}

	const target = selected === HAND ? handballTarget : tableTennisTarget;
	res.redirect(303, `${target}/login`);
});

const proxy = createProxyMiddleware({
	changeOrigin: true,
	ws: true,
	router: (req) => {
		const sport = getSport(req);
		return sport === HAND ? handballTarget : tableTennisTarget;
	},
});

app.use((req, res, next) => {
	if (req.path === "/" || req.path === "/select" || req.path === "/health") {
		next();
		return;
	}

	const selected = getSport(req);
	if (!selected) {
		res.redirect(303, "/");
		return;
	}

	proxy(req, res, next);
});

function shutdown() {
	for (const child of childProcesses) {
		if (!child.killed) {
			child.kill("SIGTERM");
		}
	}
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

(async () => {
	try {
		await startInternalApps();

		app.listen(LISTEN_PORT, "0.0.0.0", () => {
			console.log(`gateway listening on ${LISTEN_PORT}`);
		});
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
