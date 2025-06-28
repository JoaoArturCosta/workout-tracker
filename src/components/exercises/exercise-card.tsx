"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, User, Database } from "lucide-react";
import { api } from "@/lib/trpc";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditExerciseForm } from "./edit-exercise-form";
import { toast } from "sonner";
import type { Exercise } from "@/lib/db/schema";

interface ExerciseCardProps {
  exercise: Exercise;
  showActions?: boolean;
}

const muscleGroupColors: Record<string, string> = {
  chest: "bg-red-100 text-red-800 border-red-200",
  back: "bg-blue-100 text-blue-800 border-blue-200",
  shoulders: "bg-yellow-100 text-yellow-800 border-yellow-200",
  arms: "bg-green-100 text-green-800 border-green-200",
  legs: "bg-purple-100 text-purple-800 border-purple-200",
  core: "bg-orange-100 text-orange-800 border-orange-200",
};

const muscleGroupLabels: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
};

export function ExerciseCard({
  exercise,
  showActions = false,
}: ExerciseCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.exercise.delete.useMutation({
    onSuccess: () => {
      utils.exercise.getCustom.invalidate();
      toast.success("Exercise deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete exercise: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${exercise.name}"? This action cannot be undone.`
      )
    ) {
      deleteMutation.mutate({ id: exercise.id });
    }
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    utils.exercise.getCustom.invalidate();
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg leading-tight">
              {exercise.name}
            </CardTitle>
            {showActions && exercise.isCustom && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={muscleGroupColors[exercise.muscleGroup] || ""}
              >
                {muscleGroupLabels[exercise.muscleGroup] ||
                  exercise.muscleGroup}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {exercise.isCustom ? (
                  <>
                    <User className="h-3 w-3 mr-1" />
                    Custom
                  </>
                ) : (
                  <>
                    <Database className="h-3 w-3 mr-1" />
                    Default
                  </>
                )}
              </Badge>
            </div>
            {exercise.equipment && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Equipment:</span>{" "}
                {exercise.equipment}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
          </DialogHeader>
          <EditExerciseForm exercise={exercise} onSuccess={handleEditSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}
