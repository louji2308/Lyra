import type { Metadata } from "next";
import { getBeatSchedule, getTodayBeatCalls } from "@/lib/voice/backend";
import { BeatScheduleClient } from "./components/BeatScheduleClient";

export const metadata: Metadata = { title: "Beat Schedule" };
export const dynamic = "force-dynamic";

export default async function BeatSchedulePage() {
  const [schedule, todayCalls] = await Promise.all([
    getBeatSchedule(),
    getTodayBeatCalls().catch(() => []),
  ]);
  return <BeatScheduleClient schedule={schedule} todayCalls={todayCalls} />;
}
