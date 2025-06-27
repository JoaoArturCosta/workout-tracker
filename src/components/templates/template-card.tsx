import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Dumbbell, Clock, Target } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface TemplateExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rpe_target?: number | null;
  exercises: {
    id: string;
    name: string;
    muscle_group: string;
    equipment?: string | null;
  };
}

interface Template {
  id: string;
  name: string;
  day_number: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  template_exercises: TemplateExercise[];
}

interface TemplateCardProps {
  template: Template;
  onDuplicate: (targetDay: number) => void;
}

const DAYS = [
  { number: 1, name: "Day 1" },
  { number: 2, name: "Day 2" },
  { number: 3, name: "Day 3" },
  { number: 4, name: "Day 4" },
  { number: 5, name: "Day 5" },
  { number: 6, name: "Day 6" },
  { number: 7, name: "Day 7" },
];

export function TemplateCard({ template, onDuplicate }: TemplateCardProps) {
  const [selectedDay, setSelectedDay] = useState<string>("");

  const exercises =
    template.template_exercises?.sort(
      (a, b) => a.order_index - b.order_index
    ) || [];

  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const estimatedTime = exercises.length * 3 + totalSets * 2; // Rough estimation

  const handleDuplicate = () => {
    if (selectedDay) {
      onDuplicate(parseInt(selectedDay));
      setSelectedDay("");
    }
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{template.name}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              {exercises.length} exercises
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {totalSets} sets
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />~{estimatedTime} min
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Copy to..." />
            </SelectTrigger>
            <SelectContent>
              {DAYS.filter((day) => day.number !== template.day_number).map(
                (day) => (
                  <SelectItem key={day.number} value={day.number.toString()}>
                    {day.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={!selectedDay}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {exercises.length > 0 ? (
        <div className="space-y-3">
          {exercises.map((templateExercise, index) => (
            <Card
              key={templateExercise.id}
              className="border-l-4 border-l-primary"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <h4 className="font-medium">
                        {templateExercise.exercises.name}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={getMuscleGroupColor(
                          templateExercise.exercises.muscle_group
                        )}
                      >
                        {templateExercise.exercises.muscle_group}
                      </Badge>
                      {templateExercise.exercises.equipment && (
                        <Badge variant="outline">
                          {templateExercise.exercises.equipment}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{templateExercise.sets} sets</span>
                      <span>
                        {templateExercise.reps_min === templateExercise.reps_max
                          ? `${templateExercise.reps_min} reps`
                          : `${templateExercise.reps_min}-${templateExercise.reps_max} reps`}
                      </span>
                      {templateExercise.rpe_target && (
                        <span>RPE {templateExercise.rpe_target}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          No exercises added to this template yet.
        </div>
      )}
    </div>
  );
}
