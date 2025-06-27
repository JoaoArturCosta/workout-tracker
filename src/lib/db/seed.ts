import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Load environment variables
config({ path: ".env.local" });

// Create database connection for seeding
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle(pool, { schema });
const { exercises } = schema;

const coreExercises = [
  // Chest
  { name: "Bench Press", muscleGroup: "chest", equipment: "Barbell" },
  { name: "Incline Bench Press", muscleGroup: "chest", equipment: "Barbell" },
  {
    name: "Dumbbell Bench Press",
    muscleGroup: "chest",
    equipment: "Dumbbells",
  },
  {
    name: "Incline Dumbbell Press",
    muscleGroup: "chest",
    equipment: "Dumbbells",
  },
  { name: "Push-ups", muscleGroup: "chest", equipment: "Bodyweight" },
  { name: "Chest Dips", muscleGroup: "chest", equipment: "Bodyweight" },
  { name: "Cable Chest Fly", muscleGroup: "chest", equipment: "Cable" },
  { name: "Decline Bench Press", muscleGroup: "chest", equipment: "Barbell" },
  { name: "Chest Press Machine", muscleGroup: "chest", equipment: "Machine" },
  { name: "Pec Deck", muscleGroup: "chest", equipment: "Machine" },

  // Back
  { name: "Pull-ups", muscleGroup: "back", equipment: "Bodyweight" },
  { name: "Deadlift", muscleGroup: "back", equipment: "Barbell" },
  { name: "Bent-over Row", muscleGroup: "back", equipment: "Barbell" },
  { name: "Lat Pulldown", muscleGroup: "back", equipment: "Cable" },
  { name: "Seated Cable Row", muscleGroup: "back", equipment: "Cable" },
  { name: "One-arm Dumbbell Row", muscleGroup: "back", equipment: "Dumbbell" },
  { name: "T-bar Row", muscleGroup: "back", equipment: "T-bar" },
  { name: "Chin-ups", muscleGroup: "back", equipment: "Bodyweight" },
  { name: "Romanian Deadlift", muscleGroup: "back", equipment: "Barbell" },
  { name: "Face Pulls", muscleGroup: "back", equipment: "Cable" },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "shoulders", equipment: "Barbell" },
  {
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    equipment: "Dumbbells",
  },
  { name: "Lateral Raises", muscleGroup: "shoulders", equipment: "Dumbbells" },
  { name: "Front Raises", muscleGroup: "shoulders", equipment: "Dumbbells" },
  { name: "Rear Delt Fly", muscleGroup: "shoulders", equipment: "Dumbbells" },
  { name: "Arnold Press", muscleGroup: "shoulders", equipment: "Dumbbells" },
  { name: "Pike Push-ups", muscleGroup: "shoulders", equipment: "Bodyweight" },
  { name: "Upright Row", muscleGroup: "shoulders", equipment: "Barbell" },
  { name: "Shoulder Shrugs", muscleGroup: "shoulders", equipment: "Dumbbells" },
  {
    name: "Machine Shoulder Press",
    muscleGroup: "shoulders",
    equipment: "Machine",
  },

  // Arms
  { name: "Bicep Curls", muscleGroup: "arms", equipment: "Dumbbells" },
  { name: "Hammer Curls", muscleGroup: "arms", equipment: "Dumbbells" },
  { name: "Tricep Dips", muscleGroup: "arms", equipment: "Bodyweight" },
  { name: "Close-grip Bench Press", muscleGroup: "arms", equipment: "Barbell" },
  { name: "Tricep Pushdowns", muscleGroup: "arms", equipment: "Cable" },
  {
    name: "Overhead Tricep Extension",
    muscleGroup: "arms",
    equipment: "Dumbbell",
  },
  { name: "Preacher Curls", muscleGroup: "arms", equipment: "Barbell" },
  { name: "Cable Bicep Curls", muscleGroup: "arms", equipment: "Cable" },
  { name: "Diamond Push-ups", muscleGroup: "arms", equipment: "Bodyweight" },
  { name: "21s Bicep Curls", muscleGroup: "arms", equipment: "Barbell" },

  // Legs
  { name: "Squats", muscleGroup: "legs", equipment: "Barbell" },
  { name: "Lunges", muscleGroup: "legs", equipment: "Bodyweight" },
  { name: "Leg Press", muscleGroup: "legs", equipment: "Machine" },
  { name: "Romanian Deadlift", muscleGroup: "legs", equipment: "Barbell" },
  {
    name: "Bulgarian Split Squats",
    muscleGroup: "legs",
    equipment: "Bodyweight",
  },
  { name: "Leg Curls", muscleGroup: "legs", equipment: "Machine" },
  { name: "Leg Extensions", muscleGroup: "legs", equipment: "Machine" },
  { name: "Calf Raises", muscleGroup: "legs", equipment: "Bodyweight" },
  { name: "Goblet Squats", muscleGroup: "legs", equipment: "Dumbbell" },
  { name: "Walking Lunges", muscleGroup: "legs", equipment: "Bodyweight" },

  // Core
  { name: "Planks", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Crunches", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Russian Twists", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Dead Bug", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Mountain Climbers", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Bicycle Crunches", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Leg Raises", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Side Plank", muscleGroup: "core", equipment: "Bodyweight" },
  { name: "Ab Wheel Rollouts", muscleGroup: "core", equipment: "Ab Wheel" },
  { name: "Hanging Leg Raises", muscleGroup: "core", equipment: "Pull-up Bar" },
] as const;

async function seedDatabase() {
  console.log("🌱 Seeding database with core exercises...");

  try {
    // Insert core exercises
    const insertedExercises = await db
      .insert(exercises)
      .values(
        coreExercises.map((exercise) => ({
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          isCustom: false,
          userId: null, // Default exercises don't belong to any user
        }))
      )
      .returning();

    console.log(`✅ Successfully seeded ${insertedExercises.length} exercises`);

    // Log summary by muscle group
    const summary = coreExercises.reduce((acc, exercise) => {
      acc[exercise.muscleGroup] = (acc[exercise.muscleGroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n📊 Exercise Summary:");
    Object.entries(summary).forEach(([muscleGroup, count]) => {
      console.log(`  ${muscleGroup}: ${count} exercises`);
    });

    console.log("\n🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Seed process failed:", error);
      process.exit(1);
    });
}
