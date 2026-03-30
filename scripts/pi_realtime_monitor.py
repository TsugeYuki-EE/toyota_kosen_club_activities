#!/usr/bin/env python3
"""Terminal dashboard for Raspberry Pi system and Docker runtime metrics."""

from __future__ import annotations

import curses
import datetime as dt
import os
import shutil
import subprocess
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, List, Optional, Tuple


def run_command(cmd: List[str], timeout: float = 2.0) -> Tuple[int, str, str]:
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return completed.returncode, completed.stdout.strip(), completed.stderr.strip()
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        return 1, "", str(exc)


def command_exists(command: str) -> bool:
    return shutil.which(command) is not None


@dataclass
class SystemSnapshot:
    cpu_percent: float
    temp_c: Optional[float]
    mem_used_gb: float
    mem_total_gb: float
    mem_percent: float
    load_1: float
    load_5: float
    load_15: float
    uptime: str


@dataclass
class NetworkSnapshot:
    interface: Optional[str]
    rx_mbps: float
    tx_mbps: float
    rx_total_gb: float
    tx_total_gb: float


@dataclass
class AccessSnapshot:
    active_connections: int
    unique_remote_ips: int
    exposed_ports: str


@dataclass
class WifiSnapshot:
    interface: Optional[str]
    connected: bool
    ssid: Optional[str]
    signal_dbm: Optional[int]
    signal_percent: Optional[int]
    tx_bitrate: Optional[str]


@dataclass
class ContainerInfo:
    name: str
    state: str
    status: str
    image: str
    ports: str


class HistorySeries:
    def __init__(self, size: int = 60) -> None:
        self.values: Deque[float] = deque(maxlen=size)

    def push(self, value: float) -> None:
        self.values.append(value)

    def list(self) -> List[float]:
        return list(self.values)


class CpuSampler:
    def __init__(self) -> None:
        self.prev_total: Optional[int] = None
        self.prev_idle: Optional[int] = None

    def sample_percent(self) -> float:
        with open("/proc/stat", "r", encoding="utf-8") as fp:
            first = fp.readline().strip()

        parts = first.split()
        if len(parts) < 5 or parts[0] != "cpu":
            return 0.0

        values = [int(v) for v in parts[1:]]
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        total = sum(values)

        if self.prev_total is None or self.prev_idle is None:
            self.prev_total = total
            self.prev_idle = idle
            return 0.0

        diff_total = total - self.prev_total
        diff_idle = idle - self.prev_idle
        self.prev_total = total
        self.prev_idle = idle

        if diff_total <= 0:
            return 0.0

        return max(0.0, min(100.0, (1.0 - (diff_idle / diff_total)) * 100.0))


class NetSampler:
    def __init__(self) -> None:
        self.prev_rx: Optional[int] = None
        self.prev_tx: Optional[int] = None
        self.prev_ts: Optional[float] = None

    @staticmethod
    def _read_iface_bytes(interface: str) -> Tuple[int, int]:
        with open("/proc/net/dev", "r", encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if not line.startswith(interface + ":"):
                    continue
                raw = line.split(":", 1)[1].split()
                rx_bytes = int(raw[0])
                tx_bytes = int(raw[8])
                return rx_bytes, tx_bytes
        return 0, 0

    def sample(self, interface: Optional[str]) -> NetworkSnapshot:
        if not interface:
            return NetworkSnapshot(None, 0.0, 0.0, 0.0, 0.0)

        rx_bytes, tx_bytes = self._read_iface_bytes(interface)
        now = time.time()

        if self.prev_rx is None or self.prev_tx is None or self.prev_ts is None:
            self.prev_rx = rx_bytes
            self.prev_tx = tx_bytes
            self.prev_ts = now
            return NetworkSnapshot(interface, 0.0, 0.0, rx_bytes / (1024**3), tx_bytes / (1024**3))

        elapsed = max(0.001, now - self.prev_ts)
        rx_bps = max(0.0, (rx_bytes - self.prev_rx) / elapsed)
        tx_bps = max(0.0, (tx_bytes - self.prev_tx) / elapsed)

        self.prev_rx = rx_bytes
        self.prev_tx = tx_bytes
        self.prev_ts = now

        return NetworkSnapshot(
            interface=interface,
            rx_mbps=(rx_bps * 8.0) / 1_000_000.0,
            tx_mbps=(tx_bps * 8.0) / 1_000_000.0,
            rx_total_gb=rx_bytes / (1024**3),
            tx_total_gb=tx_bytes / (1024**3),
        )


def read_cpu_temp_c() -> Optional[float]:
    code, out, _ = run_command(["vcgencmd", "measure_temp"], timeout=1.0)
    if code == 0 and "temp=" in out:
        try:
            return float(out.split("=")[1].split("'")[0])
        except (ValueError, IndexError):
            pass

    thermal_path = "/sys/class/thermal/thermal_zone0/temp"
    if os.path.exists(thermal_path):
        try:
            with open(thermal_path, "r", encoding="utf-8") as fp:
                raw = fp.read().strip()
            milli_c = int(raw)
            return milli_c / 1000.0
        except (ValueError, OSError):
            return None

    return None


def read_meminfo() -> Tuple[float, float, float]:
    mem_total_kb = 0.0
    mem_available_kb = 0.0

    with open("/proc/meminfo", "r", encoding="utf-8") as fp:
        for line in fp:
            if line.startswith("MemTotal:"):
                mem_total_kb = float(line.split()[1])
            elif line.startswith("MemAvailable:"):
                mem_available_kb = float(line.split()[1])

    used_kb = max(0.0, mem_total_kb - mem_available_kb)
    mem_total_gb = mem_total_kb / (1024.0 * 1024.0)
    mem_used_gb = used_kb / (1024.0 * 1024.0)
    mem_percent = (used_kb / mem_total_kb * 100.0) if mem_total_kb > 0 else 0.0
    return mem_used_gb, mem_total_gb, mem_percent


def read_uptime() -> str:
    with open("/proc/uptime", "r", encoding="utf-8") as fp:
        seconds = int(float(fp.read().split()[0]))

    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)

    if days > 0:
        return f"{days}d {hours:02d}h {minutes:02d}m"
    return f"{hours:02d}h {minutes:02d}m"


def read_loadavg() -> Tuple[float, float, float]:
    try:
        with open("/proc/loadavg", "r", encoding="utf-8") as fp:
            parts = fp.read().split()
        return float(parts[0]), float(parts[1]), float(parts[2])
    except (OSError, ValueError, IndexError):
        return 0.0, 0.0, 0.0


def get_system_snapshot(cpu_sampler: CpuSampler) -> SystemSnapshot:
    cpu_percent = cpu_sampler.sample_percent()
    temp_c = read_cpu_temp_c()
    mem_used_gb, mem_total_gb, mem_percent = read_meminfo()
    load_1, load_5, load_15 = read_loadavg()
    uptime = read_uptime()
    return SystemSnapshot(
        cpu_percent=cpu_percent,
        temp_c=temp_c,
        mem_used_gb=mem_used_gb,
        mem_total_gb=mem_total_gb,
        mem_percent=mem_percent,
        load_1=load_1,
        load_5=load_5,
        load_15=load_15,
        uptime=uptime,
    )


def dbm_to_percent(dbm: int) -> int:
    return max(0, min(100, 2 * (dbm + 100)))


def detect_wifi_interface() -> Optional[str]:
    code, out, _ = run_command(["iw", "dev"])
    if code != 0:
        return None

    for line in out.splitlines():
        line = line.strip()
        if line.startswith("Interface "):
            name = line.split(" ", 1)[1].strip()
            if name.startswith("wlan"):
                return name

    return None


def detect_default_interface() -> Optional[str]:
    try:
        with open("/proc/net/route", "r", encoding="utf-8") as fp:
            for line in fp.readlines()[1:]:
                parts = line.split()
                if len(parts) < 2:
                    continue
                iface = parts[0]
                destination = parts[1]
                if destination == "00000000":
                    return iface
    except OSError:
        return None

    return None


def get_wifi_snapshot() -> WifiSnapshot:
    iface = detect_wifi_interface()
    if not iface:
        return WifiSnapshot(None, False, None, None, None, None)

    code, out, _ = run_command(["iw", "dev", iface, "link"])
    if code != 0 or "Not connected" in out:
        return WifiSnapshot(iface, False, None, None, None, None)

    ssid = None
    signal_dbm = None
    tx_bitrate = None

    for line in out.splitlines():
        text = line.strip()
        if text.startswith("SSID:"):
            ssid = text.split(":", 1)[1].strip()
        elif text.startswith("signal:"):
            try:
                signal_dbm = int(float(text.split(":", 1)[1].split("dBm")[0].strip()))
            except (ValueError, IndexError):
                signal_dbm = None
        elif text.startswith("tx bitrate:"):
            tx_bitrate = text.split(":", 1)[1].strip()

    signal_percent = dbm_to_percent(signal_dbm) if signal_dbm is not None else None
    return WifiSnapshot(iface, True, ssid, signal_dbm, signal_percent, tx_bitrate)


def get_access_snapshot() -> AccessSnapshot:
    exposed = {"3000", "3001", "3002"}
    if not command_exists("ss"):
        return AccessSnapshot(0, 0, ", ".join(sorted(exposed)))

    code, out, _ = run_command(["ss", "-H", "-tan"], timeout=2.0)
    if code != 0:
        return AccessSnapshot(0, 0, ", ".join(sorted(exposed)))

    active = 0
    unique_ips = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        state = parts[0]
        if state != "ESTAB":
            continue

        local = parts[3]
        peer = parts[4]
        local_port = local.rsplit(":", 1)[-1]
        if local_port not in exposed:
            continue

        active += 1
        peer_ip = peer.rsplit(":", 1)[0]
        peer_ip = peer_ip.strip("[]")
        if peer_ip:
            unique_ips.add(peer_ip)

    return AccessSnapshot(active, len(unique_ips), ", ".join(sorted(exposed)))


def get_container_snapshot() -> Tuple[bool, List[ContainerInfo], str]:
    if not command_exists("docker"):
        return False, [], "docker command not found"

    code, out, err = run_command(
        [
            "docker",
            "ps",
            "-a",
            "--format",
            "{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}",
        ],
        timeout=3.0,
    )
    if code != 0:
        message = err or "docker ps failed"
        return False, [], message

    containers: List[ContainerInfo] = []
    if out:
        for line in out.splitlines():
            parts = line.split("\t")
            while len(parts) < 5:
                parts.append("")
            name, state, status, image, ports = parts[:5]
            containers.append(
                ContainerInfo(
                    name=name,
                    state=state,
                    status=status,
                    image=image,
                    ports=ports,
                )
            )

    return True, containers, ""


def make_bar(value: float, minimum: float, maximum: float, width: int = 24) -> str:
    if width <= 0:
        return ""
    if maximum <= minimum:
        maximum = minimum + 1.0
    ratio = (value - minimum) / (maximum - minimum)
    ratio = max(0.0, min(1.0, ratio))
    filled = int(round(ratio * width))
    return "[" + ("#" * filled) + ("-" * (width - filled)) + "]"


def make_sparkline(values: List[float], width: int, minimum: float, maximum: float) -> str:
    if width <= 0:
        return ""
    if not values:
        return "." * width

    palette = " .:-=+*#%@"
    levels = len(palette) - 1
    if maximum <= minimum:
        maximum = minimum + 1.0

    if len(values) >= width:
        sampled = values[-width:]
    else:
        pad = [values[0]] * (width - len(values))
        sampled = pad + values

    chars = []
    for v in sampled:
        ratio = (v - minimum) / (maximum - minimum)
        ratio = max(0.0, min(1.0, ratio))
        idx = int(round(ratio * levels))
        chars.append(palette[idx])
    return "".join(chars)


def draw_line(stdscr: curses.window, y: int, text: str, width: int, attr: int = 0) -> None:
    if y < 0:
        return
    clipped = text[: max(0, width - 1)]
    stdscr.addstr(y, 0, clipped, attr)


def render(
    stdscr: curses.window,
    cpu_sampler: CpuSampler,
    net_sampler: NetSampler,
    cpu_hist: HistorySeries,
    temp_hist: HistorySeries,
    rx_hist: HistorySeries,
    tx_hist: HistorySeries,
) -> None:
    height, width = stdscr.getmaxyx()
    stdscr.erase()

    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    title = f"Raspberry Pi Live Monitor  |  {now}  |  q:quit r:refresh"
    draw_line(stdscr, 0, title, width, curses.A_BOLD)

    system = get_system_snapshot(cpu_sampler)
    wifi = get_wifi_snapshot()
    primary_iface = wifi.interface or detect_default_interface()
    net = net_sampler.sample(primary_iface)
    access = get_access_snapshot()
    docker_ok, containers, docker_err = get_container_snapshot()

    cpu_hist.push(system.cpu_percent)
    if system.temp_c is not None:
        temp_hist.push(system.temp_c)
    rx_hist.push(net.rx_mbps)
    tx_hist.push(net.tx_mbps)

    draw_line(stdscr, 2, "[System]", width, curses.A_BOLD)
    temp_text = f"{system.temp_c:.1f} C" if system.temp_c is not None else "N/A"
    cpu_bar = make_bar(system.cpu_percent, 0.0, 100.0)
    temp_bar = make_bar(system.temp_c if system.temp_c is not None else 0.0, 20.0, 90.0)
    draw_line(
        stdscr,
        3,
        (
            f"CPU: {cpu_bar} {system.cpu_percent:5.1f}%   TEMP: {temp_bar} {temp_text:>7}   "
            f"MEM: {system.mem_used_gb:.2f}/{system.mem_total_gb:.2f} GB ({system.mem_percent:4.1f}%)"
        ),
        width,
    )
    draw_line(
        stdscr,
        4,
        f"LOAD: {system.load_1:.2f} {system.load_5:.2f} {system.load_15:.2f}   UPTIME: {system.uptime}",
        width,
    )
    graph_width = max(12, min(64, width - 16))
    draw_line(stdscr, 5, f"CPU hist : {make_sparkline(cpu_hist.list(), graph_width, 0.0, 100.0)}", width)
    draw_line(stdscr, 6, f"TEMP hist: {make_sparkline(temp_hist.list(), graph_width, 20.0, 90.0)}", width)

    draw_line(stdscr, 8, "[Wi-Fi]", width, curses.A_BOLD)
    if wifi.interface is None:
        draw_line(stdscr, 9, "Wi-Fi interface not found (iw command or wlan interface missing)", width)
    elif not wifi.connected:
        draw_line(stdscr, 9, f"Interface: {wifi.interface}  Status: disconnected", width)
    else:
        signal_part = "N/A"
        if wifi.signal_dbm is not None and wifi.signal_percent is not None:
            signal_part = f"{wifi.signal_dbm} dBm ({wifi.signal_percent}%)"
        bitrate_part = wifi.tx_bitrate or "N/A"
        draw_line(
            stdscr,
            9,
            (
                f"Interface: {wifi.interface}  SSID: {wifi.ssid or 'N/A'}  "
                f"Signal: {signal_part}  Tx: {bitrate_part}"
            ),
            width,
        )

    draw_line(stdscr, 11, "[Access / Internet]", width, curses.A_BOLD)
    draw_line(
        stdscr,
        12,
        (
            f"Active access: {access.active_connections}  "
            f"Unique client IPs(now): {access.unique_remote_ips}  "
            f"Exposed ports: {access.exposed_ports}"
        ),
        width,
    )
    draw_line(
        stdscr,
        13,
        (
            f"Interface: {net.interface or 'N/A'}  "
            f"RX: {net.rx_mbps:6.2f} Mbps  TX: {net.tx_mbps:6.2f} Mbps  "
            f"Total RX/TX: {net.rx_total_gb:.2f}/{net.tx_total_gb:.2f} GB"
        ),
        width,
    )
    net_max = max(1.0, max(rx_hist.list()[-graph_width:] + tx_hist.list()[-graph_width:] if rx_hist.list() and tx_hist.list() else [1.0]))
    draw_line(stdscr, 14, f"RX hist  : {make_sparkline(rx_hist.list(), graph_width, 0.0, net_max)}", width)
    draw_line(stdscr, 15, f"TX hist  : {make_sparkline(tx_hist.list(), graph_width, 0.0, net_max)}", width)

    draw_line(stdscr, 17, "[Docker Containers]", width, curses.A_BOLD)
    if not docker_ok:
        draw_line(stdscr, 18, f"Docker unavailable: {docker_err}", width)
    else:
        running_count = sum(1 for c in containers if c.state == "running")
        draw_line(
            stdscr,
            18,
            f"Total: {len(containers)}  Running: {running_count}  Stopped: {len(containers) - running_count}",
            width,
        )
        draw_line(stdscr, 19, "NAME                 STATE     STATUS                           PORTS", width, curses.A_UNDERLINE)

        line = 20
        for c in containers:
            if line >= height - 1:
                break
            row = f"{c.name[:20]:20} {c.state[:9]:9} {c.status[:31]:31} {c.ports[:max(0, width - 66)]}"
            attr = curses.A_NORMAL
            if c.state == "running":
                attr = curses.color_pair(2)
            elif c.state in {"exited", "dead"}:
                attr = curses.color_pair(1)
            draw_line(stdscr, line, row, width, attr)
            line += 1

    draw_line(stdscr, height - 1, "Refresh: 1s  |  This monitor is read-only", width, curses.A_DIM)
    stdscr.refresh()


def main(stdscr: curses.window) -> None:
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(1000)

    if curses.has_colors():
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_RED, -1)
        curses.init_pair(2, curses.COLOR_GREEN, -1)

    cpu_sampler = CpuSampler()
    net_sampler = NetSampler()
    cpu_hist = HistorySeries(80)
    temp_hist = HistorySeries(80)
    rx_hist = HistorySeries(80)
    tx_hist = HistorySeries(80)
    cpu_sampler.sample_percent()

    while True:
        render(stdscr, cpu_sampler, net_sampler, cpu_hist, temp_hist, rx_hist, tx_hist)
        key = stdscr.getch()
        if key in (ord("q"), ord("Q")):
            break
        if key in (ord("r"), ord("R")):
            continue
        time.sleep(0.02)


if __name__ == "__main__":
    curses.wrapper(main)
