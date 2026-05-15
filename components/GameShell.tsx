"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  Coins,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Trophy,
  User,
  X,
  Zap
} from "lucide-react";
import { hasClientFirebaseConfig } from "@/lib/firebase/client";

type PlayState = "idle" | "running" | "paused" | "ended";

type Snapshot = {
  score: number;
  best: number;
  energy: number;
  wave: number;
  speed: number;
  combo: number;
  meters: number;
  biomeName: string;
  state: PlayState;
};

type Skin = {
  id: string;
  name: string;
  price: number;
  color: number;
  emissive: number;
  pattern: "plain" | "stripe" | "bolt" | "target" | "wave" | "grid" | "split" | "star" | "rings";
  preview: string;
};

type ScoreRecord = {
  name: string;
  score: number;
  wave: number;
  createdAt: number;
};

const lanes = [-2.4, 0, 2.4] as const;
const skinCatalog: Skin[] = [
  {
    id: "cyan",
    name: "Aqua",
    price: 0,
    color: 0x67e8f9,
    emissive: 0x0e7490,
    pattern: "plain",
    preview: "linear-gradient(135deg,#67e8f9,#22d3ee)"
  },
  {
    id: "gold",
    name: "Oltin chiziq",
    price: 3000,
    color: 0xfacc15,
    emissive: 0xb45309,
    pattern: "stripe",
    preview: "repeating-linear-gradient(135deg,#facc15 0 8px,#78350f 8px 13px,#fde68a 13px 18px)"
  },
  {
    id: "ruby",
    name: "Qizil nishon",
    price: 5000,
    color: 0xfb7185,
    emissive: 0x9f1239,
    pattern: "target",
    preview: "radial-gradient(circle,#fff 0 12%,#fb7185 13% 34%,#7f1d1d 35% 54%,#fb7185 55%)"
  },
  {
    id: "neon",
    name: "Neon chaqmoq",
    price: 8000,
    color: 0xa78bfa,
    emissive: 0x6d28d9,
    pattern: "bolt",
    preview: "linear-gradient(135deg,#111827,#a78bfa 45%,#fef08a 46% 58%,#6d28d9 59%)"
  },
  {
    id: "emerald-wave",
    name: "Zumrad to'lqin",
    price: 10000,
    color: 0x34d399,
    emissive: 0x047857,
    pattern: "wave",
    preview:
      "repeating-radial-gradient(circle at 35% 35%,#d1fae5 0 8px,#34d399 9px 21px,#065f46 22px 30px)"
  },
  {
    id: "ice-grid",
    name: "Muz panjara",
    price: 12000,
    color: 0x93c5fd,
    emissive: 0x1d4ed8,
    pattern: "grid",
    preview:
      "linear-gradient(90deg,rgba(255,255,255,.75) 1px,transparent 1px),linear-gradient(#93c5fd,#1d4ed8)"
  },
  {
    id: "sun-split",
    name: "Quyosh yarim",
    price: 14000,
    color: 0xfb923c,
    emissive: 0xc2410c,
    pattern: "split",
    preview: "linear-gradient(135deg,#fef3c7 0 42%,#fb923c 43% 64%,#7c2d12 65%)"
  },
  {
    id: "violet-star",
    name: "Yulduzli shar",
    price: 16000,
    color: 0xc084fc,
    emissive: 0x7e22ce,
    pattern: "star",
    preview: "radial-gradient(circle at 50% 50%,#fef08a 0 16%,#c084fc 17% 54%,#581c87 55%)"
  },
  {
    id: "mint-rings",
    name: "Halqa mint",
    price: 18000,
    color: 0x5eead4,
    emissive: 0x0f766e,
    pattern: "rings",
    preview:
      "repeating-radial-gradient(circle at 50% 50%,#ccfbf1 0 8px,#5eead4 9px 20px,#134e4a 21px 28px)"
  },
  {
    id: "carbon-grid",
    name: "Karbon chiziq",
    price: 22000,
    color: 0x94a3b8,
    emissive: 0x334155,
    pattern: "grid",
    preview:
      "linear-gradient(45deg,rgba(255,255,255,.55) 1px,transparent 1px),linear-gradient(135deg,#0f172a,#94a3b8)"
  }
];
const initialSnapshot: Snapshot = {
  score: 0,
  best: 0,
  energy: 100,
  wave: 1,
  speed: 1,
  combo: 0,
  meters: 0,
  biomeName: "Neon vodiy",
  state: "idle"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readBestScore() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Number(window.localStorage.getItem("nexus-best") ?? 0);
}

function readStoredNumber(key: string, fallback = 0) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return Number(window.localStorage.getItem(key) ?? fallback);
}

function readOwnedSkins() {
  if (typeof window === "undefined") {
    return ["cyan"];
  }

  const value = window.localStorage.getItem("nexus-owned-skins");
  if (!value) {
    return ["cyan"];
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.from(new Set(["cyan", ...parsed]));
  } catch {
    return ["cyan"];
  }
}

function readSelectedSkin() {
  if (typeof window === "undefined") {
    return "cyan";
  }

  return window.localStorage.getItem("nexus-skin") ?? "cyan";
}

export default function GameShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const submittedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [playerName, setPlayerName] = useState("Pilot");
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [wallet, setWallet] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["cyan"]);
  const [selectedSkin, setSelectedSkin] = useState("cyan");
  const [shopOpen, setShopOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const firebaseReady = useMemo(() => hasClientFirebaseConfig(), []);
  const currentSkin = useMemo(
    () => skinCatalog.find((skin) => skin.id === selectedSkin) ?? skinCatalog[0],
    [selectedSkin]
  );

  const refreshScores = useCallback(async () => {
    const response = await fetch("/api/scores", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }

    const data = (await response.json()) as { scores?: ScoreRecord[] };
    setScores(data.scores ?? []);
  }, []);

  const submitScore = useCallback(
    async (finalSnapshot: Snapshot) => {
      if (submittedRef.current || finalSnapshot.score <= 0) {
        return;
      }

      submittedRef.current = true;

      await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName,
          score: finalSnapshot.score,
          wave: finalSnapshot.wave
        })
      }).catch(() => null);

      refreshScores();
    },
    [playerName, refreshScores]
  );
  const submitScoreRef = useRef(submitScore);

  useEffect(() => {
    submitScoreRef.current = submitScore;
  }, [submitScore]);

  const handleCoinCollect = useCallback(() => {
    setWallet((current) => {
      const next = current + 1000;
      window.localStorage.setItem("nexus-wallet", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setSnapshot((current) => ({ ...current, best: readBestScore() }));
    setWallet(readStoredNumber("nexus-wallet"));
    setOwnedSkins(readOwnedSkins());
    setSelectedSkin(readSelectedSkin());
    refreshScores();
  }, [refreshScores]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    setEngineReady(false);
    const engine = createEngine(
      hostRef.current,
      (nextSnapshot) => {
        setSnapshot(nextSnapshot);

        if (nextSnapshot.state === "ended") {
          submitScoreRef.current(nextSnapshot);
        }
      },
      handleCoinCollect,
      skinCatalog[0]
    );

    engineRef.current = engine;
    setEngineReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setEngineReady(false);
    };
  }, [handleCoinCollect]);

  useEffect(() => {
    engineRef.current?.setSkin(currentSkin);
  }, [currentSkin]);

  const start = () => {
    if (!engineRef.current) {
      return;
    }

    submittedRef.current = false;
    engineRef.current.start();
  };

  const restart = () => {
    if (!engineRef.current) {
      return;
    }

    submittedRef.current = false;
    engineRef.current.restart();
  };

  const paused = snapshot.state === "paused";
  const running = snapshot.state === "running";
  const ended = snapshot.state === "ended";
  const menuOpen = snapshot.state === "idle" || ended;
  const buyOrSelectSkin = (skin: Skin) => {
    if (ownedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      window.localStorage.setItem("nexus-skin", skin.id);
      engineRef.current?.setSkin(skin);
      return;
    }

    if (wallet < skin.price) {
      return;
    }

    const nextWallet = wallet - skin.price;
    const nextOwned = [...ownedSkins, skin.id];
    setWallet(nextWallet);
    setOwnedSkins(nextOwned);
    setSelectedSkin(skin.id);
    window.localStorage.setItem("nexus-wallet", String(nextWallet));
    window.localStorage.setItem("nexus-owned-skins", JSON.stringify(nextOwned));
    window.localStorage.setItem("nexus-skin", skin.id);
    engineRef.current?.setSkin(skin);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#071014] text-cyan-50">
      <div ref={hostRef} className="absolute inset-0 touch-none" />

      <section className="pointer-events-none relative z-10 flex min-h-dvh flex-col justify-between p-3 sm:p-5">
        {running ? (
          <button
            title="To'xtatish"
            onClick={() => engineRef.current?.stop()}
            className="pointer-events-auto absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-lg border border-red-200/30 bg-red-500/20 text-red-50 shadow-glow backdrop-blur transition active:scale-95 sm:hidden"
          >
            <Square size={18} fill="currentColor" />
          </button>
        ) : null}

        <div className={`flex flex-wrap items-start justify-between gap-3 ${running ? "pl-14 sm:pl-0" : ""}`}>
          <div className="glass pointer-events-auto grid min-w-[172px] grid-cols-2 gap-3 rounded-lg px-4 py-3 shadow-glow">
            <Stat icon={<Sparkles size={17} />} label="Ball" value={snapshot.score} />
            <Stat icon={<Trophy size={17} />} label="Rekord" value={snapshot.best} />
            <div className="flex items-start justify-between gap-2">
              <Stat icon={<Shield size={17} />} label="Quvvat" value={`${snapshot.energy}%`} />
              <button
                title="Skin do'koni"
                onClick={() => setShopOpen(true)}
                className="mt-4 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/25 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20 active:scale-95"
              >
                <ShoppingCart size={17} />
              </button>
            </div>
            <Stat icon={<Coins size={17} />} label="So'm" value={wallet} />
          </div>

          <div className="glass pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
            <span className="text-right text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
              <span className="block">{firebaseReady ? "Firebase" : "Local"}</span>
              <span className="block text-[10px] text-amber-100">
                {(snapshot.meters / 1000).toFixed(1)} km · {snapshot.biomeName}
              </span>
            </span>
          </div>
        </div>

        {menuOpen ? (
          <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-1 items-center py-8">
            <div className="glass w-full rounded-lg p-5 shadow-glow sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">
                    Nexus Runner
                  </p>
                  <h1 className="mt-2 text-3xl font-black leading-none text-cyan-50 sm:text-5xl">
                    3D Arena
                  </h1>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-300/10">
                  <Zap className="text-amber-200" size={34} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Ball" value={snapshot.score} />
                <MiniStat label="So'm" value={wallet} />
                <MiniStat label="KM" value={(snapshot.meters / 1000).toFixed(1)} />
              </div>

              <label className="mt-5 block text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
                Ism
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value.slice(0, 18))}
                  className="mt-2 w-full rounded-lg border border-cyan-100/20 bg-slate-950/70 px-3 py-3 text-base font-bold text-cyan-50 outline-none ring-0 transition focus:border-amber-200"
                  maxLength={18}
                />
              </label>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={ended ? restart : start}
                  disabled={!engineReady}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 py-3 font-black text-slate-950 transition hover:bg-amber-200 active:scale-[0.98] disabled:cursor-wait disabled:bg-cyan-100/35 disabled:text-cyan-950/55"
                >
                  <Play size={19} />
                  {!engineReady ? "Yuklanmoqda" : ended ? "Qayta o'ynash" : "Boshlash"}
                </button>
              </div>

              <div className="mt-5 max-h-40 overflow-auto rounded-lg border border-cyan-100/15">
                {scores.length ? (
                  scores.slice(0, 5).map((score, index) => (
                    <div
                      key={`${score.createdAt}-${index}`}
                      className="flex items-center justify-between border-b border-cyan-100/10 px-3 py-2 last:border-b-0"
                    >
                      <span className="truncate text-sm font-bold text-cyan-50">
                        {index + 1}. {score.name}
                      </span>
                      <span className="hud-number text-sm text-amber-200">{score.score}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-cyan-100/80">Leaderboard tayyor</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 items-end justify-between gap-3 sm:flex">
            <button
              title={paused ? "Davom etish" : "Pauza"}
              onClick={() => engineRef.current?.togglePause()}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-100/20 bg-slate-950/60 text-cyan-50 backdrop-blur transition hover:bg-cyan-300/10"
            >
              {paused ? <Play size={21} /> : <Pause size={21} />}
            </button>

            <button
              title="Qayta boshlash"
              onClick={restart}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-100/20 bg-slate-950/60 text-cyan-50 backdrop-blur transition hover:bg-cyan-300/10"
            >
              <RotateCcw size={21} />
            </button>
          </div>
        )}

        {paused ? (
          <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/38 backdrop-blur-sm">
            <button
              onClick={() => engineRef.current?.togglePause()}
              className="flex items-center gap-2 rounded-lg bg-cyan-200 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-100 active:scale-[0.98]"
            >
              <Play size={19} />
              Davom etish
            </button>
          </div>
        ) : null}

        {running ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 gap-2 sm:flex">
            <kbd className="rounded border border-cyan-100/20 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              A
            </kbd>
            <kbd className="rounded border border-cyan-100/20 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              W
            </kbd>
            <kbd className="rounded border border-cyan-100/20 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              S
            </kbd>
            <kbd className="rounded border border-cyan-100/20 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              D
            </kbd>
          </div>
        ) : null}

        {shopOpen ? (
          <ShopPanel
            wallet={wallet}
            ownedSkins={ownedSkins}
            selectedSkin={selectedSkin}
            onClose={() => setShopOpen(false)}
            onPick={buyOrSelectSkin}
          />
        ) : null}
      </section>
    </main>
  );
}

function Stat({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-cyan-100/80">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className="hud-number mt-1 text-lg font-black leading-none text-cyan-50">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-cyan-100/15 bg-slate-950/45 px-2 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/75">
        {label}
      </div>
      <div className="hud-number mt-1 text-xl font-black text-cyan-50">{value}</div>
    </div>
  );
}

function ShopPanel({
  wallet,
  ownedSkins,
  selectedSkin,
  onClose,
  onPick
}: {
  wallet: number;
  ownedSkins: string[];
  selectedSkin: string;
  onClose: () => void;
  onPick: (skin: Skin) => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/46 p-3 backdrop-blur-sm">
      <div className="glass max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-auto rounded-lg p-5 shadow-glow sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
              <User size={15} />
              User
            </p>
            <h2 className="mt-2 text-2xl font-black leading-none text-cyan-50">Skin do&apos;koni</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100">
                Hamyon
              </div>
              <div className="hud-number text-lg font-black text-amber-200">{wallet}</div>
            </div>
            <button
              title="Yopish"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-100/20 bg-slate-950/55 text-cyan-50 transition hover:bg-cyan-300/10 active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {skinCatalog.map((skin) => {
            const owned = ownedSkins.includes(skin.id);
            const active = selectedSkin === skin.id;
            return (
              <button
                key={skin.id}
                onClick={() => onPick(skin)}
                className={`rounded-lg border p-3 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-amber-200 bg-amber-300/15"
                    : "border-cyan-100/15 bg-slate-950/45 hover:border-cyan-100/35"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <span
                      className="h-12 w-12 rounded-full border border-white/30"
                      style={{
                        background: skin.preview,
                        boxShadow: `0 0 18px #${skin.emissive.toString(16).padStart(6, "0")}`
                      }}
                    />
                    <span>
                      <span className="block text-sm font-black text-cyan-50">{skin.name}</span>
                      <span className="block text-xs text-cyan-100/70">
                        {owned ? (active ? "Tanlangan" : "Olingan") : `${skin.price} so'm`}
                      </span>
                    </span>
                  </span>
                  {owned ? (
                    <ShoppingBag className="text-emerald-200" size={18} />
                  ) : (
                    <Lock className="text-amber-200" size={18} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function createCoinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = ctx.createRadialGradient(92, 70, 18, 128, 128, 122);
  gradient.addColorStop(0, "#fff7ad");
  gradient.addColorStop(0.48, "#facc15");
  gradient.addColorStop(1, "#b45309");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 86, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#3f2505";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 54px Arial";
  ctx.fillText("1000", 128, 110);
  ctx.font = "900 34px Arial";
  ctx.fillText("SO'M", 128, 154);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createBallTexture(skin: Skin) {
  if (skin.pattern === "plain") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = `#${skin.color.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, 256, 256);

  if (skin.pattern === "stripe") {
    ctx.fillStyle = "#78350f";
    for (let x = -256; x < 420; x += 44) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-Math.PI / 6);
      ctx.fillRect(0, -80, 18, 430);
      ctx.restore();
    }
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, 72, 256, 18);
  }

  if (skin.pattern === "target") {
    const rings = [
      ["#fff1f2", 96],
      ["#fb7185", 72],
      ["#7f1d1d", 48],
      ["#fff1f2", 22]
    ] as const;
    rings.forEach(([color, radius]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(128, 128, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (skin.pattern === "bolt") {
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(145, 18);
    ctx.lineTo(70, 140);
    ctx.lineTo(122, 140);
    ctx.lineTo(98, 238);
    ctx.lineTo(190, 105);
    ctx.lineTo(136, 105);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#312e81";
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  if (skin.pattern === "wave") {
    ctx.strokeStyle = "#ecfeff";
    ctx.lineWidth = 14;
    for (let y = -20; y < 300; y += 44) {
      ctx.beginPath();
      for (let x = -20; x <= 276; x += 8) {
        const waveY = y + Math.sin(x / 22) * 13;
        if (x === -20) {
          ctx.moveTo(x, waveY);
        } else {
          ctx.lineTo(x, waveY);
        }
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(6,95,70,0.8)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (skin.pattern === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 8;
    for (let x = 24; x < 256; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 24; y < 256; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(15,23,42,0.65)";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 200, 200);
  }

  if (skin.pattern === "split") {
    const highlight = ctx.createLinearGradient(0, 0, 256, 256);
    highlight.addColorStop(0, "#fef3c7");
    highlight.addColorStop(0.5, "#fb923c");
    highlight.addColorStop(1, "#7c2d12");
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(15,23,42,0.72)";
    ctx.beginPath();
    ctx.moveTo(0, 222);
    ctx.lineTo(222, 0);
    ctx.lineTo(256, 0);
    ctx.lineTo(34, 256);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();
  }

  if (skin.pattern === "star") {
    ctx.fillStyle = "#fef08a";
    for (const [cx, cy, radius] of [
      [128, 128, 78],
      [54, 58, 28],
      [204, 64, 24],
      [58, 204, 22],
      [210, 202, 30]
    ] as const) {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const pointRadius = i % 2 === 0 ? radius : radius * 0.42;
        const x = cx + Math.cos(angle) * pointRadius;
        const y = cy + Math.sin(angle) * pointRadius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  if (skin.pattern === "rings") {
    for (let radius = 112; radius >= 24; radius -= 22) {
      ctx.strokeStyle = radius % 44 === 0 ? "#ccfbf1" : "#134e4a";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(128, 128, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#ccfbf1";
    ctx.beginPath();
    ctx.arc(128, 128, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const biomes = [
  {
    name: "Neon vodiy",
    clear: 0x071014,
    fog: 0x071014,
    road: 0x0e7490,
    side: 0x052e2f,
    edge: 0xfacc15,
    obstacle: 0xff4d5e,
    obstacleGlow: 0xfff1a8
  },
  {
    name: "Zumrad yo'l",
    clear: 0x06130e,
    fog: 0x06130e,
    road: 0x166534,
    side: 0x052e16,
    edge: 0x86efac,
    obstacle: 0x38bdf8,
    obstacleGlow: 0xbae6fd
  },
  {
    name: "Quyosh bekati",
    clear: 0x160c08,
    fog: 0x160c08,
    road: 0x9a3412,
    side: 0x431407,
    edge: 0xfdba74,
    obstacle: 0xa78bfa,
    obstacleGlow: 0xf5d0fe
  },
  {
    name: "Muz tunnel",
    clear: 0x07111f,
    fog: 0x07111f,
    road: 0x1d4ed8,
    side: 0x0f172a,
    edge: 0x67e8f9,
    obstacle: 0xf472b6,
    obstacleGlow: 0xfbcfe8
  }
];

function createEngine(
  host: HTMLDivElement,
  onSnapshot: (snapshot: Snapshot) => void,
  onCoinCollect: () => void,
  initialSkin: Skin
) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x071014, 18, 88);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
  camera.position.set(0, 5.2, 8.8);
  camera.lookAt(0, 0.8, -8);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x071014, 1);
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.userSelect = "none";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0x9af7ff, 0x172033, 2.2);
  const keyLight = new THREE.DirectionalLight(0xfff0b2, 3.2);
  keyLight.position.set(-3, 7, 5);
  scene.add(ambient, keyLight);

  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e7490,
    metalness: 0.3,
    roughness: 0.42
  });
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x052e2f,
    metalness: 0.05,
    roughness: 0.7
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0x3b2f05,
    metalness: 0.2,
    roughness: 0.32
  });
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: initialSkin.color,
    emissive: initialSkin.emissive,
    map: createBallTexture(initialSkin),
    metalness: 0.6,
    roughness: 0.24
  });
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4d5e,
    emissive: 0xb91c1c,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.22
  });
  const barrierGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
  const coinTexture = createCoinTexture();
  const coinSideMaterial = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x92400e,
    metalness: 0.6,
    roughness: 0.18
  });
  const coinFaceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.3,
    map: coinTexture,
    metalness: 0.3,
    roughness: 0.16
  });

  const road = new THREE.Group();
  const roadGeometry = new THREE.BoxGeometry(8.4, 0.12, 16);
  const sideGeometry = new THREE.BoxGeometry(11, 0.08, 16);
  const edgeGeometry = new THREE.BoxGeometry(0.08, 0.1, 16);
  const floorTiles: THREE.Mesh[] = [];
  const sideTiles: THREE.Mesh[] = [];

  for (let i = 0; i < 9; i += 1) {
    const tile = new THREE.Mesh(roadGeometry, laneMaterial);
    tile.position.set(0, -0.08, -i * 16);
    floorTiles.push(tile);
    road.add(tile);

    const leftSide = new THREE.Mesh(sideGeometry, sideMaterial);
    leftSide.position.set(-9.9, -0.13, -i * 16);
    sideTiles.push(leftSide);
    road.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeometry, sideMaterial);
    rightSide.position.set(9.9, -0.13, -i * 16);
    sideTiles.push(rightSide);
    road.add(rightSide);

    const leftEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    leftEdge.position.set(-4.25, 0.03, -i * 16);
    road.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    rightEdge.position.set(4.25, 0.03, -i * 16);
    road.add(rightEdge);
  }

  scene.add(road);

  const player = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 2), playerMaterial);
  player.position.set(0, 0.58, 0);
  scene.add(player);
  const shardGeometry = new THREE.TetrahedronGeometry(0.16, 0);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 32),
    new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.42 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  const obstacleGeometry = new THREE.BoxGeometry(1.55, 1.2, 0.5);
  const highObstacleGeometry = new THREE.BoxGeometry(1.7, 0.92, 0.54);
  const obstacleBarGeometry = new THREE.BoxGeometry(1.78, 0.12, 0.56);
  const coinGeometry = new THREE.CylinderGeometry(0.52, 0.52, 0.12, 56);
  const coinRingGeometry = new THREE.TorusGeometry(0.55, 0.035, 10, 48);
  const obstacles: THREE.Group[] = [];
  const coins: THREE.Group[] = [];
  const fragments: { mesh: THREE.Mesh; velocity: THREE.Vector3 }[] = [];

  let animationId = 0;
  let lastTime = performance.now();
  let laneIndex = 1;
  let targetLane = 1;
  let jumpVelocity = 0;
  let spawnTimer = 0;
  let crystalTimer = 0;
  let distance = 0;
  let score = 0;
  let best = readBestScore();
  let energy = 100;
  let wave = 1;
  let biomeIndex = 0;
  let combo = 0;
  let state: PlayState = "idle";
  let snapshotTimer = 0;
  let duckTimer = 0;
  let playerSkinTexture = playerMaterial.map;
  let pointerStart: { id: number; x: number; y: number } | null = null;
  let resizeTimer = 0;

  const emit = (force = false) => {
    if (!force && snapshotTimer < 0.12) {
      return;
    }

    snapshotTimer = 0;
    const nextBest = Math.max(best, score);
    onSnapshot({
      score: Math.floor(score),
      best: Math.floor(nextBest),
      energy: Math.ceil(energy),
      wave,
      speed: Number((1 + wave * 0.12).toFixed(1)),
      combo,
      meters: Math.floor(distance),
      biomeName: biomes[biomeIndex].name,
      state
    });
  };

  const applyBiome = (nextIndex: number) => {
    const biome = biomes[nextIndex % biomes.length];
    biomeIndex = nextIndex % biomes.length;
    renderer.setClearColor(biome.clear, 1);
    scene.fog = new THREE.Fog(biome.fog, 18, 92);
    laneMaterial.color.setHex(biome.road);
    sideMaterial.color.setHex(biome.side);
    edgeMaterial.color.setHex(biome.edge);
    edgeMaterial.emissive.setHex(biome.edge);
    obstacleMaterial.color.setHex(biome.obstacle);
    obstacleMaterial.emissive.setHex(biome.obstacle);
    barrierGlowMaterial.color.setHex(biome.obstacleGlow);
  };

  const resize = () => {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.35 : 1.7);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, true);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = width / height;
    camera.fov = width < 700 ? 64 : 56;
    camera.position.set(0, width < 700 ? 5.5 : 5.0, width < 700 ? 9.4 : 8.0);
    camera.updateProjectionMatrix();
  };

  const resetWorld = () => {
    [...obstacles, ...coins].forEach((mesh) => {
      scene.remove(mesh);
    });
    fragments.forEach(({ mesh }) => {
      scene.remove(mesh);
    });
    obstacles.length = 0;
    coins.length = 0;
    fragments.length = 0;
    laneIndex = 1;
    targetLane = 1;
    jumpVelocity = 0;
    duckTimer = 0;
    spawnTimer = 0;
    crystalTimer = 0;
    distance = 0;
    score = 0;
    energy = 100;
    wave = 1;
    applyBiome(0);
    combo = 0;
    player.visible = true;
    shadow.visible = true;
    player.scale.set(1, 1, 1);
    player.position.set(0, 0.58, 0);
    shadow.position.x = 0;
  };

  const shatterPlayer = () => {
    if (!player.visible || fragments.length) {
      return;
    }

    player.visible = false;
    shadow.visible = false;

    for (let i = 0; i < 18; i += 1) {
      const shard = new THREE.Mesh(shardGeometry, playerMaterial);
      shard.position.copy(player.position);
      shard.position.x += (Math.random() - 0.5) * 0.7;
      shard.position.y += (Math.random() - 0.5) * 0.45;
      shard.position.z += (Math.random() - 0.5) * 0.45;
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      fragments.push({
        mesh: shard,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5.2,
          3.4 + Math.random() * 3.6,
          (Math.random() - 0.5) * 4.6
        )
      });
      scene.add(shard);
    }
  };

  const finish = () => {
    energy = 0;
    state = "ended";
    best = Math.max(best, score);
    window.localStorage.setItem("nexus-best", String(Math.floor(best)));
    shatterPlayer();
    emit(true);
  };

  const move = (direction: number) => {
    if (state !== "running") {
      return;
    }

    targetLane = clamp(targetLane + direction, 0, lanes.length - 1);
  };

  const jump = () => {
    if (state !== "running" || player.position.y > 0.68) {
      return;
    }

    jumpVelocity = 8.2;
  };

  const duck = () => {
    if (state !== "running" || player.position.y > 0.7) {
      return;
    }

    duckTimer = 0.62;
  };

  const spawnObstacle = () => {
    const blockedLane = Math.floor(Math.random() * lanes.length);
    const kind = wave > 1 && Math.random() > 0.48 ? "high" : "low";
    const barrier = new THREE.Group();
    const body = new THREE.Mesh(kind === "high" ? highObstacleGeometry : obstacleGeometry, obstacleMaterial);
    const topLight = new THREE.Mesh(obstacleBarGeometry, barrierGlowMaterial);
    const bottomLight = new THREE.Mesh(obstacleBarGeometry, barrierGlowMaterial);

    if (kind === "high") {
      body.position.y = 1.55;
      topLight.position.y = 2.04;
      bottomLight.position.y = 1.04;
    } else {
      body.position.y = 0.6;
      topLight.position.y = 1.22;
      bottomLight.position.y = 0.03;
    }

    barrier.add(body, topLight, bottomLight);
    barrier.position.set(lanes[blockedLane], 0, -78);
    barrier.userData.kind = kind;
    obstacles.push(barrier);
    scene.add(barrier);
  };

  const spawnCoin = () => {
    const freeLane = Math.floor(Math.random() * lanes.length);
    const coin = new THREE.Group();
    const coinMesh = new THREE.Mesh(coinGeometry, [coinSideMaterial, coinFaceMaterial, coinFaceMaterial]);
    const ring = new THREE.Mesh(coinRingGeometry, barrierGlowMaterial);

    coinMesh.rotation.x = Math.PI / 2;
    coin.add(coinMesh, ring);
    coin.position.set(lanes[freeLane], 1.15, -66);
    coins.push(coin);
    scene.add(coin);
  };

  const updateObjects = (dt: number, speed: number) => {
    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.position.z += speed * dt;
      const kind = obstacle.userData.kind as "low" | "high";

      const nearPlayer = Math.abs(obstacle.position.z) < 0.78;
      const sameLane = Math.abs(obstacle.position.x - player.position.x) < 0.82;
      const lowEnough = player.position.y < 1.18;
      const hitsPlayer = kind === "high" ? duckTimer <= 0 : lowEnough;

      if (nearPlayer && sameLane && hitsPlayer) {
        scene.remove(obstacle);
        obstacles.splice(i, 1);
        energy = Math.max(0, energy - 34);
        combo = 0;

        if (energy === 0) {
          finish();
        }
      } else if (obstacle.position.z > 9) {
        scene.remove(obstacle);
        obstacles.splice(i, 1);
        score += 12 + combo;
      }
    }

    for (let i = coins.length - 1; i >= 0; i -= 1) {
      const coin = coins[i];
      coin.position.z += speed * dt;
      coin.rotation.y += dt * 3.6;

      const nearPlayer = Math.abs(coin.position.z) < 0.95;
      const sameLane = Math.abs(coin.position.x - player.position.x) < 0.88;
      const closeHeight = Math.abs(coin.position.y - player.position.y) < 0.95;

      if (nearPlayer && sameLane && closeHeight) {
        scene.remove(coin);
        coins.splice(i, 1);
        combo = Math.min(20, combo + 1);
        score += 55 + combo * 8;
        energy = Math.min(100, energy + 5);
        onCoinCollect();
      } else if (coin.position.z > 9) {
        scene.remove(coin);
        coins.splice(i, 1);
        combo = 0;
      }
    }
  };

  const loop = (time: number) => {
    const rawDt = (time - lastTime) / 1000;
    const dt = Math.min(rawDt, 0.033);
    lastTime = time;
    snapshotTimer += dt;

    if (state === "running") {
      const speed = 13 + wave * 1.7;
      distance += speed * dt;
      wave = Math.min(30, 1 + Math.floor(distance / 145));
      const nextBiome = Math.floor(distance / 520) % biomes.length;
      if (nextBiome !== biomeIndex) {
        applyBiome(nextBiome);
      }
      score += dt * (6 + wave * 1.5 + combo * 0.35);
      energy = Math.max(0, energy - dt * (1.9 + wave * 0.05));

      if (energy <= 0) {
        finish();
      }

      const targetX = lanes[targetLane];
      player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 15, dt);
      if (Math.abs(player.position.x - targetX) < 0.08) {
        laneIndex = targetLane;
      }

      duckTimer = Math.max(0, duckTimer - dt);

      jumpVelocity -= 22 * dt;
      player.position.y += jumpVelocity * dt;
      if (player.position.y < 0.58) {
        player.position.y = 0.58;
        jumpVelocity = 0;
      }

      player.rotation.x -= dt * (5 + wave * 0.2);
      player.rotation.z = THREE.MathUtils.damp(player.rotation.z, (targetLane - laneIndex) * -0.4, 8, dt);
      player.scale.y = THREE.MathUtils.damp(player.scale.y, duckTimer > 0 ? 0.46 : 1, 16, dt);
      player.scale.x = THREE.MathUtils.damp(player.scale.x, duckTimer > 0 ? 1.22 : 1, 16, dt);
      player.scale.z = THREE.MathUtils.damp(player.scale.z, duckTimer > 0 ? 1.22 : 1, 16, dt);
      shadow.position.x = player.position.x;
      shadow.scale.setScalar(1 + (player.position.y - 0.58) * 0.38);

      floorTiles.forEach((tile) => {
        tile.position.z += speed * dt;
        if (tile.position.z > 12) {
          tile.position.z -= 144;
        }
      });

      road.children.forEach((child) => {
        if (!floorTiles.includes(child as THREE.Mesh) && !sideTiles.includes(child as THREE.Mesh)) {
          child.position.z += speed * dt;
          if (child.position.z > 12) {
            child.position.z -= 144;
          }
        }
      });

      sideTiles.forEach((tile) => {
        tile.position.z += speed * dt;
        if (tile.position.z > 12) {
          tile.position.z -= 144;
        }
      });

      spawnTimer -= dt;
      crystalTimer -= dt;
      if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = Math.max(0.58, 1.24 - wave * 0.025 + Math.random() * 0.34);
      }
      if (crystalTimer <= 0) {
        spawnCoin();
        crystalTimer = Math.max(0.42, 0.86 - wave * 0.01 + Math.random() * 0.5);
      }

      updateObjects(dt, speed);
      emit();
    } else {
      player.rotation.y += dt * 0.65;
      coins.forEach((coin) => {
        coin.rotation.y += dt * 2.2;
      });
    }

    fragments.forEach((fragment) => {
      fragment.mesh.position.addScaledVector(fragment.velocity, dt);
      fragment.velocity.y -= 9.8 * dt;
      fragment.mesh.rotation.x += dt * 5;
      fragment.mesh.rotation.y += dt * 4;
    });

    camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x * 0.08, 4, dt);
    camera.lookAt(player.position.x * 0.08, 0.65, -10);
    renderer.render(scene, camera);
    animationId = window.requestAnimationFrame(loop);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      move(-1);
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      move(1);
    }
    if (event.key === "ArrowUp" || event.key === " " || event.key.toLowerCase() === "w") {
      event.preventDefault();
      jump();
    }
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      duck();
    }
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      togglePause();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (state !== "running" || event.pointerType === "mouse") {
      return;
    }

    event.preventDefault();
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    host.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    host.releasePointerCapture?.(event.pointerId);

    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) {
      jump();
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jump();
    } else {
      duck();
    }
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pointerStart?.id === event.pointerId) {
      pointerStart = null;
    }
  };

  const resizeSoon = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 80);
  };

  const start = () => {
    resetWorld();
    state = "running";
    lastTime = performance.now();
    emit(true);
  };

  const restart = () => {
    start();
  };

  const stop = () => {
    if (state === "running") {
      state = "paused";
      emit(true);
    }
  };

  const togglePause = () => {
    if (state === "running") {
      state = "paused";
      emit(true);
      return;
    }

    if (state === "paused") {
      state = "running";
      lastTime = performance.now();
      emit(true);
    }
  };

  resize();
  window.requestAnimationFrame(resize);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resizeSoon);
  window.visualViewport?.addEventListener("resize", resizeSoon);
  window.addEventListener("keydown", onKeyDown);
  host.addEventListener("pointerdown", onPointerDown, { passive: false });
  host.addEventListener("pointerup", onPointerUp, { passive: false });
  host.addEventListener("pointercancel", onPointerCancel);
  animationId = window.requestAnimationFrame(loop);
  emit(true);

  return {
    start,
    restart,
    move,
    jump,
    duck,
    stop,
    togglePause,
    setSkin(skin: Skin) {
      playerSkinTexture?.dispose();
      playerSkinTexture = createBallTexture(skin);
      playerMaterial.color.setHex(skin.color);
      playerMaterial.emissive.setHex(skin.emissive);
      playerMaterial.map = playerSkinTexture;
      playerMaterial.needsUpdate = true;
    },
    dispose() {
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resizeSoon);
      window.visualViewport?.removeEventListener("resize", resizeSoon);
      window.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      [...obstacles, ...coins].forEach((mesh) => {
        scene.remove(mesh);
      });
      roadGeometry.dispose();
      sideGeometry.dispose();
      edgeGeometry.dispose();
      obstacleGeometry.dispose();
      highObstacleGeometry.dispose();
      obstacleBarGeometry.dispose();
      coinGeometry.dispose();
      coinRingGeometry.dispose();
      shardGeometry.dispose();
      coinTexture.dispose();
      playerSkinTexture?.dispose();
      player.geometry.dispose();
      shadow.geometry.dispose();
      laneMaterial.dispose();
      edgeMaterial.dispose();
      playerMaterial.dispose();
      obstacleMaterial.dispose();
      barrierGlowMaterial.dispose();
      coinSideMaterial.dispose();
      coinFaceMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
