"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- bridges old and expanded analytics payloads during rollout. */

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Dumbbell, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

type AnyRecord = Record<string, any>;

export default function ProgressPage() {
  const progressApi = api.progress as any;
  const exerciseApi = api.exercise as any;
  const [exerciseId, setExerciseId] = useState("");
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");
  const [online, setOnline] = useState(true);
  const [bodyWeight, setBodyWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); setOnline(navigator.onLine); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);

  const exercisesQuery = exerciseApi.getAll.useQuery({});
  const historyQuery = progressApi.getSessionHistory.useQuery({ limit: 20 });
  const recordsQuery = progressApi.getPersonalRecords.useQuery({ timeframe });
  const volumeQuery = progressApi.getVolumeProgression.useQuery({ exerciseId, timeframe }, { enabled: !!exerciseId });
  const oneRmQuery = progressApi.getOneRM.useQuery({ exerciseId }, { enabled: !!exerciseId });
  const durationQuery = progressApi.getDurationSummary?.useQuery?.({ timeframe });
  const logWeight = progressApi.logBodyWeight.useMutation({ onSuccess: () => { setBodyWeight(""); toast.success("Body weight logged"); }, onError: (error: Error) => toast.error(error.message) });
  const history = ((historyQuery.data ?? []) as AnyRecord[]).filter((item) => (item.status ?? (item.completed ? "Completed" : "Partial")) !== "Discarded");
  const records = (recordsQuery.data ?? []) as AnyRecord[];
  const volume = (volumeQuery.data ?? []) as AnyRecord[];
  const duration = (durationQuery?.data ?? {}) as AnyRecord;
  const totalDurationSets = Number(duration.completedDurationSets ?? duration.durationSetCount ?? history.reduce((sum, item) => sum + Number(item.stats?.durationSetCount ?? 0), 0));
  const totalSeconds = Number(duration.totalActualSeconds ?? duration.durationSeconds ?? history.reduce((sum, item) => sum + Number(item.stats?.totalActualSeconds ?? 0), 0));

  return <main className="container mx-auto space-y-6 p-4 sm:p-6"><header className="flex items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">Progress</h1><p className="text-muted-foreground">Reps and Duration metrics stay separate.</p></div><span className="inline-flex items-center gap-1 text-sm text-muted-foreground">{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? "Online" : "Offline"}</span></header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card><CardHeader><CardTitle className="text-sm">Ended workouts</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{history.length}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Reps PR cards</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{records.length}</p><p className="text-xs text-muted-foreground">Reps mode only</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Duration sets</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalDurationSets}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Actual seconds</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalSeconds}</p><p className="text-xs text-muted-foreground">Never treated as reps</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Exercise analytics (Reps mode)</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={exerciseId} onValueChange={setExerciseId}><SelectTrigger><SelectValue placeholder="Choose an exercise" /></SelectTrigger><SelectContent>{((exercisesQuery.data ?? []) as AnyRecord[]).map((exercise) => <SelectItem key={exercise.id} value={exercise.id}>{exercise.name}</SelectItem>)}</SelectContent></Select>{exerciseId && <div className="grid gap-4 md:grid-cols-2">{oneRmQuery.data && <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Estimated 1RM</p><p className="text-2xl font-bold">{oneRmQuery.data.oneRepMax} kg</p></div>}<div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Load × reps volume</p><p className="text-2xl font-bold">{volume.reduce((sum, row) => sum + Number(row.volume ?? 0), 0)} kg</p></div></div>}</CardContent></Card>
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>History</CardTitle><Select value={timeframe} onValueChange={(value: "week" | "month" | "year") => setTimeframe(value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent></Select></CardHeader><CardContent className="space-y-3">{history.length === 0 && <p className="text-sm text-muted-foreground">No ended workouts.</p>}{history.map((item) => { const status = item.status ?? (item.completed ? "Completed" : "Partial"); const stats = item.stats ?? {}; return <div key={item.id} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{item.templateName ?? item.workout_templates?.name ?? "Workout"}</p><p className="text-xs text-muted-foreground">{item.startTime ?? item.start_time ? new Date(item.startTime ?? item.start_time).toLocaleDateString() : "—"}</p></div><Badge variant={status === "Completed" ? "default" : "secondary"}>{status}</Badge></div><div className="mt-3 flex flex-wrap gap-4 text-sm"><span className="inline-flex items-center gap-1"><Dumbbell className="h-3 w-3" />{stats.totalVolume ?? 0} kg Reps volume</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{stats.durationSetCount ?? 0} Duration sets · {stats.totalActualSeconds ?? 0}s</span></div></div>; })}</CardContent></Card>
    <Card><CardHeader><CardTitle>Body weight</CardTitle></CardHeader><CardContent><div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="body-weight">Weight</Label><Input id="body-weight" type="number" min="0" value={bodyWeight} onChange={(event) => setBodyWeight(event.target.value)} /></div><Select value={unit} onValueChange={(value: "kg" | "lbs") => setUnit(value)}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="lbs">lbs</SelectItem></SelectContent></Select><Button onClick={() => logWeight.mutate({ weight: Number(bodyWeight), unit })} disabled={!bodyWeight || logWeight.isPending}>Log</Button></div></CardContent></Card>
  </main>;
}
