"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { EditTemplateForm } from "@/components/templates/edit-template-form";
import { TemplateCard } from "@/components/templates/template-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [activeDay, setActiveDay] = useState("1");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: templates, refetch } = api.template.getAll.useQuery();
  const deleteTemplateMutation = api.template.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const duplicateTemplateMutation = api.template.duplicate.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDelete = async (templateId: string) => {
    try {
      await deleteTemplateMutation.mutateAsync({ id: templateId });
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const handleDuplicate = async (templateId: string, targetDay: number) => {
    try {
      const template = templates?.find((t: any) => t.id === templateId);
      if (!template) return;

      await duplicateTemplateMutation.mutateAsync({
        id: templateId,
        newDayNumber: targetDay,
        newName: `${template.name} (Copy)`,
      });
    } catch (error) {
      console.error("Failed to duplicate template:", error);
    }
  };

  const getTemplateForDay = (dayNumber: number) => {
    return templates?.find((t: any) => t.day_number === dayNumber);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workout Templates</h1>
          <p className="text-muted-foreground">
            Plan your workouts for each day of the week
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Workout Template</DialogTitle>
            </DialogHeader>
            <CreateTemplateForm
              onSuccess={() => {
                setCreateDialogOpen(false);
                refetch();
              }}
              selectedDay={parseInt(activeDay)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeDay} onValueChange={setActiveDay} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          {DAYS.map((day) => (
            <TabsTrigger key={day.number} value={day.number.toString()}>
              {day.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {DAYS.map((day) => (
          <TabsContent key={day.number} value={day.number.toString()}>
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{day.name} Workout</span>
                  <div className="flex gap-2">
                    {getTemplateForDay(day.number) && (
                      <>
                        <Dialog
                          open={editDialogOpen}
                          onOpenChange={setEditDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedTemplate(
                                  getTemplateForDay(day.number)?.id || null
                                )
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Workout Template</DialogTitle>
                            </DialogHeader>
                            {selectedTemplate && (
                              <EditTemplateForm
                                templateId={selectedTemplate}
                                onSuccess={() => {
                                  setEditDialogOpen(false);
                                  setSelectedTemplate(null);
                                  refetch();
                                }}
                              />
                            )}
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Template
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this template?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  getTemplateForDay(day.number)?.id &&
                                  handleDelete(
                                    getTemplateForDay(day.number)!.id
                                  )
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getTemplateForDay(day.number) ? (
                  <TemplateCard
                    template={getTemplateForDay(day.number)!}
                    onDuplicate={(targetDay: number) =>
                      handleDuplicate(
                        getTemplateForDay(day.number)!.id,
                        targetDay
                      )
                    }
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      No template created for {day.name}
                    </p>
                    <Button
                      onClick={() => setCreateDialogOpen(true)}
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
