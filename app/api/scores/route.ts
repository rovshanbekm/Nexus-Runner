import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type ScoreRecord = {
  name: string;
  score: number;
  wave: number;
  createdAt: number;
};

const fallbackScores: ScoreRecord[] = [];

function cleanName(value: unknown) {
  const name = String(value ?? "Pilot").trim();
  return name.slice(0, 18).replace(/[^\w .'-]/g, "") || "Pilot";
}

function cleanScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(999999, Math.floor(score)));
}

function cleanWave(value: unknown) {
  const wave = Number(value);
  if (!Number.isFinite(wave)) {
    return 1;
  }

  return Math.max(1, Math.min(99, Math.floor(wave)));
}

export async function GET() {
  const db = getAdminFirestore();

  if (db) {
    const snapshot = await db
      .collection("scores")
      .orderBy("score", "desc")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    return NextResponse.json({
      source: "firebase",
      scores: snapshot.docs.map((doc) => doc.data())
    });
  }

  return NextResponse.json({
    source: "memory",
    scores: [...fallbackScores].sort((a, b) => b.score - a.score).slice(0, 10)
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<ScoreRecord>;
  const score: ScoreRecord = {
    name: cleanName(body.name),
    score: cleanScore(body.score),
    wave: cleanWave(body.wave),
    createdAt: Date.now()
  };

  const db = getAdminFirestore();

  if (db) {
    await db.collection("scores").add(score);
  } else {
    fallbackScores.push(score);
    fallbackScores.sort((a, b) => b.score - a.score);
    fallbackScores.splice(10);
  }

  return NextResponse.json({ ok: true, score });
}
