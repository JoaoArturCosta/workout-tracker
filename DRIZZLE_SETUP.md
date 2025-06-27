# Drizzle ORM Integration

## Overview

The workout tracker now uses **Drizzle ORM** for type-safe database operations with PostgreSQL/Supabase. Drizzle provides excellent TypeScript integration, better performance than traditional ORMs, and a SQL-like query builder.

## Setup Complete ✅

### 1. Dependencies Installed

- `drizzle-orm` - Core ORM functionality
- `drizzle-kit` - CLI tools for migrations and introspection
- `pg` + `@types/pg` - PostgreSQL driver
- `tsx` - TypeScript execution for seeding scripts
- `dotenv` - Environment variable loading

### 2. Configuration Files

#### `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### 3. Database Schema (`src/lib/db/schema.ts`)

Complete Drizzle schema definitions including:

- **8 core tables** with proper relationships
- **Type-safe enums** (muscle_group, weight_unit)
- **Indexes** for performance optimization
- **Foreign key constraints** with cascade deletes
- **Auto-generated types** for TypeScript

### 4. Database Client (`src/lib/db/index.ts`)

Connection pool configuration with:

- PostgreSQL connection pooling (max 20 connections)
- Proper timeout configurations
- Schema integration for type safety
- Re-exported types for convenience

### 5. Updated tRPC Context

Modified `src/server/api/trpc.ts` to use Drizzle:

```typescript
const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    db, // Drizzle database instance
  };
};
```

## Database Operations

### Schema Management

```bash
# Generate migration files
npm run db:generate

# Apply schema to database
npm run db:push

# Run migrations (for production)
npm run db:migrate

# Open Drizzle Studio (database browser)
npm run db:studio
```

### Data Seeding

```bash
# Seed database with core exercises
npm run db:seed
```

**Seeding Results:**

- ✅ 60 core exercises added
- 📊 10 exercises per muscle group
- 🏋️ Covers: chest, back, shoulders, arms, legs, core

## Query Examples

### Basic Queries

```typescript
// Select all exercises
const allExercises = await db.select().from(exercises);

// Filter by muscle group
const chestExercises = await db
  .select()
  .from(exercises)
  .where(eq(exercises.muscleGroup, "chest"));

// Search with conditions
const searchResults = await db
  .select()
  .from(exercises)
  .where(
    and(ilike(exercises.name, "%press%"), eq(exercises.muscleGroup, "chest"))
  )
  .limit(10);
```

### Joins and Relations

```typescript
// Get workout template with exercises
const templateWithExercises = await db
  .select()
  .from(workoutTemplates)
  .leftJoin(
    templateExercises,
    eq(workoutTemplates.id, templateExercises.templateId)
  )
  .leftJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
  .where(eq(workoutTemplates.userId, userId));
```

### Mutations

```typescript
// Insert new exercise
const newExercise = await db
  .insert(exercises)
  .values({
    name: "Custom Exercise",
    muscleGroup: "chest",
    equipment: "Dumbbells",
    isCustom: true,
    userId: userId,
  })
  .returning();

// Update exercise
await db
  .update(exercises)
  .set({ name: "Updated Name" })
  .where(eq(exercises.id, exerciseId));

// Delete exercise
await db.delete(exercises).where(eq(exercises.id, exerciseId));
```

## Updated Routers

### Exercise Router (`src/server/api/routers/exercise.ts`)

✅ **Fully migrated to Drizzle** with:

- Type-safe queries with filtering
- Search functionality with `ilike`
- CRUD operations for custom exercises
- Proper user authorization checks
- Optimized queries with limits and ordering

### Other Routers

The following routers are ready for Drizzle migration in Phase 2:

- `template.ts` - Workout template management
- `session.ts` - Workout session tracking
- `progress.ts` - Progress analytics and 1RM calculations

## Type Safety Benefits

### Inferred Types

```typescript
// Types automatically inferred from schema
type Exercise = typeof exercises.$inferSelect;
type NewExercise = typeof exercises.$inferInsert;

// Use in components/API
const createExercise = (data: NewExercise) => {
  return db.insert(exercises).values(data);
};
```

### Runtime Validation

- Schema validation at database level
- TypeScript compilation catches type errors
- Zod schemas for API input validation
- End-to-end type safety from DB to frontend

## Performance Optimizations

### Database Indexes

```sql
-- Automatically created indexes
CREATE INDEX "idx_exercises_muscle_group" ON "exercises" ("muscle_group");
CREATE INDEX "idx_exercises_user_id" ON "exercises" ("user_id");
CREATE INDEX "idx_workout_templates_user_id" ON "workout_templates" ("user_id");
CREATE INDEX "idx_workout_templates_day_number" ON "workout_templates" ("day_number");
-- ... and more
```

### Connection Pooling

- Pool size: 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds
- Efficient resource management

## Migration Strategy

### From Supabase Client to Drizzle

1. **Schema Definition** ✅ - Complete Drizzle schema matching Supabase
2. **Database Migration** ✅ - Tables created with proper constraints
3. **Data Seeding** ✅ - Core exercises populated
4. **Router Updates** ✅ - Exercise router fully migrated
5. **tRPC Context** ✅ - Database client integrated

### Next Steps for Phase 2

1. Migrate remaining routers (template, session, progress)
2. Update any direct Supabase client usage
3. Add more complex queries with joins
4. Implement advanced filtering and sorting

## Troubleshooting

### Common Issues

**Environment Variables**

- Ensure `.env.local` exists with `DATABASE_URL`
- Use `dotenv` for CLI scripts that need env vars

**Type Errors**

- Regenerate types: `npm run db:generate`
- Check schema definitions match database
- Ensure proper imports from `@/lib/db/schema`

**Database Connection**

- Verify Supabase connection string
- Check database permissions
- Test with `npm run db:studio`

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit CLI](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL with Drizzle](https://orm.drizzle.team/docs/get-started-postgresql)

---

**Status**: ✅ **Drizzle Integration Complete**  
**Ready for**: Phase 2 Development  
**Database**: 8 tables, 60 exercises seeded  
**Type Safety**: End-to-end with TypeScript
