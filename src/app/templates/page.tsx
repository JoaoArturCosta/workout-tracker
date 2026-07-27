"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { api } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { EditTemplateForm } from "@/components/templates/edit-template-form";
import { Clock, Copy, Edit, Plus, Archive, RotateCcw, Dumbbell, LogIn } from "lucide-react";
import { toast } from "sonner";

// Legacy and expanded template rows coexist until the contract migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default function TemplatesPage() {
  const { data: session, status } = useSession();
  const [selectedDay, setSelectedDay] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const templateApi = api.template;
  const query = templateApi.getAll.useQuery(undefined, { enabled: !!session?.user });
  const templates = ((query.data ?? []) as AnyRecord[]);
  const duplicate = templateApi.duplicate.useMutation({ onSuccess: () => { toast.success("Template duplicated"); query.refetch(); }, onError: (error) => toast.error(error.message) });
  const archive = templateApi.archive.useMutation({ onSuccess: () => { toast.success("Template archived"); query.refetch(); }, onError: (error) => toast.error(error.message) });
  const restore = templateApi.restore.useMutation({ onSuccess: () => { toast.success("Template restored"); query.refetch(); }, onError: (error) => toast.error(error.message) });

  if (status === "loading") return <div className="container mx-auto p-6">Loading…</div>;
  if (status === "unauthenticated") return <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6"><Card className="max-w-md"><CardContent className="space-y-4 pt-6 text-center"><LogIn className="mx-auto" /><h2 className="text-xl font-semibold">Sign in required</h2><p className="text-sm text-muted-foreground">Sign in to manage workout templates.</p><Button onClick={() => signIn()}>Sign in</Button></CardContent></Card></div>;

  const byDay = (day: number) => templates.filter((item) => Number(item.dayNumber ?? item.day_number) === day);
  const isArchived = (item: AnyRecord) => !!item.archivedAt || !!item.archived_at;
  const act = (item: AnyRecord) => { const id = item.id; if (isArchived(item)) restore?.mutate({ id }); else archive?.mutate({ id }); };

  return <main className="container mx-auto space-y-6 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-bold">Workout templates</h1><p className="text-muted-foreground">Set your Reps and Duration exercise targets.</p></div><Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4" />Create template</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader><CreateTemplateForm selectedDay={selectedDay} onSuccess={() => { setCreateOpen(false); query.refetch(); }} /></DialogContent></Dialog></header>
    <Tabs value={String(selectedDay)} onValueChange={(value) => setSelectedDay(Number(value))}><TabsList className="grid w-full grid-cols-7">{Array.from({ length: 7 }, (_, i) => <TabsTrigger key={i + 1} value={String(i + 1)}>Day {i + 1}</TabsTrigger>)}</TabsList>{Array.from({ length: 7 }, (_, i) => i + 1).map((day) => <TabsContent key={day} value={String(day)} className="mt-5"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{byDay(day).map((template) => { const rows = template.template_exercises ?? template.templateExercises ?? []; const archived = isArchived(template); return <Card key={template.id} className={archived ? "opacity-70" : ""}><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle>{template.name}</CardTitle><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">Day {day}</Badge><span>{rows.length} exercises</span>{archived && <Badge variant="secondary">Archived</Badge>}</div></div><div className="flex gap-1">{!archived && <Button variant="ghost" size="icon" onClick={() => setEditingId(template.id)} aria-label="Edit"><Edit className="h-4 w-4" /></Button>}{!archived && <Button variant="ghost" size="icon" onClick={() => duplicate.mutate({ id: template.id, newDayNumber: day === 7 ? 1 : day + 1, newName: `${template.name} (Copy)` })} aria-label="Duplicate"><Copy className="h-4 w-4" /></Button>}{(archive || restore) && <Button variant="ghost" size="icon" onClick={() => act(template)} aria-label={archived ? "Restore" : "Archive"}>{archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>}</div></div></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><Dumbbell className="h-3 w-3" />{rows.reduce((sum: number, row: AnyRecord) => sum + Number(row.sets ?? 0), 0)} sets</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{rows.reduce((sum: number, row: AnyRecord) => sum + Number(row.sets ?? 0) * Number(row.restTimeSeconds ?? row.rest_time_seconds ?? 120), 0)} sec rest</span></div>{rows.slice(0, 4).map((row: AnyRecord, index: number) => <div key={row.id ?? index} className="flex items-center justify-between text-xs"><span>{row.exercise?.name ?? row.exercises?.name ?? "Exercise"}</span><Badge variant="outline">{row.mode === "Duration" ? `${row.targetSeconds ?? row.target_seconds ?? "—"} sec` : `${row.repsMin ?? row.reps_min ?? "—"}-${row.repsMax ?? row.reps_max ?? "—"} reps`}</Badge></div>)}</CardContent></Card>; })}</div>{byDay(day).length === 0 && <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">No templates for Day {day}.</CardContent></Card>}</TabsContent>)}</Tabs>
    {editingId && <Dialog open onOpenChange={() => setEditingId(null)}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Edit template</DialogTitle></DialogHeader><EditTemplateForm templateId={editingId} onSuccess={() => { setEditingId(null); query.refetch(); }} /></DialogContent></Dialog>}
  </main>;
}
