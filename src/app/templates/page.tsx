"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { EditTemplateForm } from "@/components/templates/edit-template-form";
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Dumbbell,
  Target,
  Clock,
  Calendar,
  LogIn,
} from "lucide-react";
import { api } from "@/lib/trpc";
import { toast } from "sonner";

const DAYS = [
  { number: 1, name: "Day 1" },
  { number: 2, name: "Day 2" },
  { number: 3, name: "Day 3" },
  { number: 4, name: "Day 4" },
  { number: 5, name: "Day 5" },
  { number: 6, name: "Day 6" },
  { number: 7, name: "Day 7" },
];

export default function TemplatesPage() {
  const { data: session, status } = useSession();
  const [selectedDay, setSelectedDay] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

  const { data: templates, refetch } = api.template.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const deleteTemplateMutation = api.template.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });

  const duplicateTemplateMutation = api.template.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Template duplicated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to duplicate template: " + error.message);
    },
  });

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setEditingTemplate(null);
    refetch();
  };

  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    toast(`Delete "${templateName}"?`, {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: () => deleteTemplateMutation.mutate({ id: templateId }),
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const handleDuplicateTemplate = (
    templateId: string,
    templateName: string
  ) => {
    const targetDay = selectedDay === 7 ? 1 : selectedDay + 1;
    duplicateTemplateMutation.mutate({
      id: templateId,
      newDayNumber: targetDay,
      newName: `${templateName} (Copy)`,
    });
  };

  const getTemplatesForDay = (dayNumber: number) => {
    return (
      templates?.filter((template) => template.dayNumber === dayNumber) || []
    );
  };

  const getMuscleGroupColor = (muscleGroup: string) => {
    const colors: Record<string, string> = {
      chest: "bg-red-100 text-red-800",
      back: "bg-blue-100 text-blue-800",
      shoulders: "bg-yellow-100 text-yellow-800",
      arms: "bg-purple-100 text-purple-800",
      legs: "bg-green-100 text-green-800",
      core: "bg-orange-100 text-orange-800",
    };
    return colors[muscleGroup] || "bg-gray-100 text-gray-800";
  };

  const selectedDayTemplates = getTemplatesForDay(selectedDay);

  // Show loading state
  if (status === "loading") {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show sign in prompt if not authenticated
  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <LogIn className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h2 className="text-xl font-semibold">Sign In Required</h2>
                  <p className="text-muted-foreground mt-2">
                    You need to sign in to create and manage workout templates.
                  </p>
                </div>
                <Button onClick={() => signIn()} className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workout Templates</h1>
          <p className="text-muted-foreground">
            Create and manage your weekly workout plans
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <CreateTemplateForm
              selectedDay={selectedDay}
              onSuccess={handleCreateSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Day Tabs */}
      <Tabs
        value={selectedDay.toString()}
        onValueChange={(value) => setSelectedDay(parseInt(value))}
      >
        <TabsList className="grid w-full grid-cols-7">
          {DAYS.map((day) => (
            <TabsTrigger key={day.number} value={day.number.toString()}>
              {day.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {DAYS.map((day) => (
          <TabsContent
            key={day.number}
            value={day.number.toString()}
            className="mt-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{day.name} Templates</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {getTemplatesForDay(day.number).length} template(s)
                </div>
              </div>

              {getTemplatesForDay(day.number).length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getTemplatesForDay(day.number).map((template) => (
                    <Card
                      key={template.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {template.name}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{day.name}</Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Dumbbell className="h-3 w-3" />
                                {template.template_exercises?.length || 0}{" "}
                                exercises
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTemplate(template.id)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDuplicateTemplate(
                                  template.id,
                                  template.name
                                )
                              }
                              disabled={duplicateTemplateMutation.isPending}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteTemplate(template.id, template.name)
                              }
                              disabled={deleteTemplateMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {template.template_exercises?.reduce(
                                (sum, te) => sum + te.sets,
                                0
                              ) || 0}{" "}
                              sets
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />~
                              {(template.template_exercises?.length || 0) * 3 +
                                (template.template_exercises?.reduce(
                                  (sum, te) => sum + te.sets,
                                  0
                                ) || 0) *
                                  2}{" "}
                              min
                            </div>
                          </div>

                          <div className="space-y-2">
                            {template.template_exercises
                              ?.slice(0, 3)
                              .map((te, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs ${getMuscleGroupColor(
                                        te.exercise?.muscleGroup || ""
                                      )}`}
                                    >
                                      {te.exercise?.muscleGroup}
                                    </Badge>
                                    <span className="font-medium">
                                      {te.exercise?.name}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground">
                                    {te.sets} × {te.repsMin}-{te.repsMax}
                                  </span>
                                </div>
                              ))}
                            {(template.template_exercises?.length || 0) > 3 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +
                                {(template.template_exercises?.length || 0) - 3}{" "}
                                more exercises
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">
                      No Templates for {day.name}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first template for this day to get started.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog
          open={!!editingTemplate}
          onOpenChange={() => setEditingTemplate(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>
            <EditTemplateForm
              templateId={editingTemplate}
              onSuccess={handleEditSuccess}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
