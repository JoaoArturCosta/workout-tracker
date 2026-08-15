"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { api } from "@/lib/trpc";
import { getDeviceId } from "@/lib/offline-workouts/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, History, LogIn, Play } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SessionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const currentQuery = api.session.getCurrent.useQuery(undefined, { enabled: isAuthenticated });
  const historyQuery = api.session.getHistory.useQuery({ limit: 20 }, { enabled: isAuthenticated });
  const templatesQuery = api.template.getAll.useQuery({ includeArchived: true }, { enabled: isAuthenticated });
  const start = api.session.start.useMutation({ onSuccess: (session) => { toast.success("Workout started"); router.push(`/sessions/${session.id}`); }, onError: (error) => toast.error(error.message) });
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void getDeviceId().then((id) => { if (!cancelled) setDeviceId(id); }).catch((error: Error) => toast.error(error.message)); return () => { cancelled = true; }; }, []);

  const current = currentQuery.data;
  const templates = templatesQuery.data ?? [];
  const history = (historyQuery.data ?? []).filter((item) => item.status !== "Discarded");
  const startWorkout = (templateId: string) => { if (deviceId) start.mutate({ templateId, deviceId }); };

  if (status === "loading") return <div className="container mx-auto p-6">Loading…</div>;
  if (!isAuthenticated) return <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6"><Card className="max-w-md"><CardContent className="space-y-4 pt-6 text-center"><LogIn className="mx-auto" /><h2 className="text-xl font-semibold">Sign in required</h2><p className="text-sm text-muted-foreground">Sign in to start and review workouts.</p><Button onClick={() => signIn()}>Sign in</Button></CardContent></Card></div>;

  return <main className="container mx-auto space-y-6 p-4 sm:p-6"><header><h1 className="text-3xl font-bold">Workouts</h1><p className="text-muted-foreground">Start a workout or review your history.</p></header>
    {current && <Card className="border-orange-200 bg-orange-50"><CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">Active workout</p><p className="text-sm text-muted-foreground">{current.templateName}. Starting another workout will complete this one.</p></div><Button onClick={() => router.push(`/sessions/${current.id}`)}><Play className="h-4 w-4" />Resume</Button></CardContent></Card>}
    <Card><CardHeader><CardTitle>Start workout</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{templates.filter((template) => !template.archivedAt).map((template) => <div key={template.id} className="rounded-lg border p-4"><div className="mb-2 flex items-start justify-between gap-2"><div><h3 className="font-semibold">{template.name}</h3><p className="text-xs text-muted-foreground">{template.template_exercises.length} exercise occurrences</p></div><Badge variant="outline">Day {template.dayNumber}</Badge></div><Button size="sm" onClick={() => startWorkout(template.id)} disabled={!deviceId || start.isPending}>{start.isPending ? "Starting…" : "Start"}</Button></div>)}{templates.length === 0 && <p className="text-sm text-muted-foreground">Create a template first.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Workout history</CardTitle></CardHeader><CardContent className="space-y-3">{history.length === 0 && <p className="text-sm text-muted-foreground">No ended workouts yet.</p>}{history.map((item) => <button type="button" key={item.id} className="flex w-full items-center justify-between rounded-lg border p-4 text-left hover:bg-muted/40" onClick={() => router.push(`/sessions/${item.id}`)}><div><p className="font-medium">{item.templateName ?? "Workout"}</p><div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(item.startTime), "MMM d, yyyy")}</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{item.durationMinutes ? `${item.durationMinutes} min` : "—"}</span></div></div><Badge variant={item.status === "Completed" ? "default" : "secondary"}>{item.status}</Badge></button>)}</CardContent></Card>
  </main>;
}
