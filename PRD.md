# Workout Tracker App - Product Requirements Document

## 1. Project Overview

### 1.1 Mission Statement

Build a comprehensive workout tracking application that enables users to plan workouts, execute sessions, and track progress with detailed analytics and strength standards comparison.

### 1.2 Core Objectives

- **Planning**: Create flexible workout templates organized by days (1-7)
- **Execution**: Track live workout sessions with weight, reps, and RPE
- **Progress**: Comprehensive analytics including 1RM calculations and volume tracking
- **Intelligence**: Auto-populate previous session values for seamless progression

### 1.3 Technology Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, ShadCN UI
- **Backend**: tRPC, NextAuth (Google provider)
- **Database**: Supabase with Row Level Security
- **Validation**: Zod (runtime validation, env variables, forms)
- **State Management**: tRPC + React state

## 2. User Stories & Requirements

### 2.1 Core User Flows

#### Workout Planning

- **As a user**, I want to create workout templates for up to 7 days
- **As a user**, I want to select exercises from a curated database organized by muscle groups
- **As a user**, I want to add custom exercises when needed
- **As a user**, I want to specify sets, rep ranges, and target RPE for each exercise

#### Workout Execution

- **As a user**, I want to select a day from my workout template to start a session
- **As a user**, I want previous session values auto-populated for each set
- **As a user**, I want to log actual weight and reps performed
- **As a user**, I want the app to track my workout duration automatically

#### Progress Tracking

- **As a user**, I want to see my 1RM calculations using proven formulas
- **As a user**, I want to track my body weight over time
- **As a user**, I want to see volume progression and personal records
- **As a user**, I want to compare my lifts against strength standards

### 2.2 Technical Requirements

#### Performance

- **Sub-2s page loads** for all major routes
- **Real-time updates** during workout sessions
- **Offline capability** for active workout sessions
- **Optimistic updates** for seamless UX

#### Security

- **Google OAuth integration** via NextAuth
- **Row Level Security** for all user data
- **Environment validation** with Zod schemas
- **Type-safe API** with runtime validation

#### Scalability

- **Efficient database queries** with proper indexing
- **Modular component architecture** for future features
- **Extensible exercise system** for additional exercises

## 3. Technical Architecture

### 3.1 Database Schema

```sql
-- Authentication (managed by NextAuth)
users
  id: uuid (primary key)
  email: string
  name: string
  image: string
  created_at: timestamp

-- Exercise Database
exercises
  id: uuid (primary key)
  name: string (1-100 chars)
  muscle_group: enum (chest, back, shoulders, arms, legs, core)
  equipment: string (optional)
  is_custom: boolean (default false)
  user_id: uuid (foreign key, null for default exercises)
  created_at: timestamp

-- Workout Templates
workout_templates
  id: uuid (primary key)
  user_id: uuid (foreign key)
  name: string (1-50 chars)
  day_number: integer (1-7)
  created_at: timestamp
  updated_at: timestamp

-- Template Exercises
template_exercises
  id: uuid (primary key)
  template_id: uuid (foreign key)
  exercise_id: uuid (foreign key)
  order_index: integer
  sets: integer (1-20)
  reps_min: integer (1-100)
  reps_max: integer (1-100)
  rpe_target: integer (6-10, optional)

-- Workout Sessions
workout_sessions
  id: uuid (primary key)
  user_id: uuid (foreign key)
  template_id: uuid (foreign key)
  start_time: timestamp
  end_time: timestamp (optional)
  duration_minutes: integer (optional)
  completed: boolean (default false)

-- Session Exercises
session_exercises
  id: uuid (primary key)
  session_id: uuid (foreign key)
  exercise_id: uuid (foreign key)
  order_index: integer

-- Session Sets
session_sets
  id: uuid (primary key)
  session_exercise_id: uuid (foreign key)
  set_number: integer
  weight: decimal (positive, max 1000)
  reps: integer (1-100)
  rpe: integer (6-10, optional)
  completed: boolean (default false)

-- Body Weight Logs
body_weight_logs
  id: uuid (primary key)
  user_id: uuid (foreign key)
  weight: decimal (positive, max 1000)
  unit: enum (kg, lbs, default kg)
  logged_at: timestamp
```

### 3.2 Zod Validation Schemas

```typescript
// Environment Validation
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// Core Data Schemas
const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  muscleGroup: z.enum(["chest", "back", "shoulders", "arms", "legs", "core"]),
  equipment: z.string().optional(),
  isCustom: z.boolean().default(false),
  userId: z.string().uuid().optional(),
});

const WorkoutTemplateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  dayNumber: z.number().min(1).max(7),
  exercises: z.array(TemplateExerciseSchema),
});

const SessionSetSchema = z.object({
  weight: z.number().positive().max(1000),
  reps: z.number().min(1).max(100),
  rpe: z.number().min(6).max(10).optional(),
  completed: z.boolean().default(false),
});
```

### 3.3 tRPC API Design

```typescript
// Exercise Router
export const exerciseRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(z.object({ muscleGroup: z.string().optional() }))
    .query(({ input }) => {
      /* fetch exercises */
    }),

  getCustom: protectedProcedure.query(({ ctx }) => {
    /* fetch user custom exercises */
  }),

  create: protectedProcedure
    .input(CreateExerciseSchema)
    .mutation(({ input, ctx }) => {
      /* create custom exercise */
    }),
});

// Template Router
export const templateRouter = createTRPCRouter({
  getAll: protectedProcedure.query(({ ctx }) => {
    /* fetch user templates */
  }),

  create: protectedProcedure
    .input(CreateTemplateSchema)
    .mutation(({ input, ctx }) => {
      /* create template */
    }),

  getByDay: protectedProcedure
    .input(z.object({ dayNumber: z.number().min(1).max(7) }))
    .query(({ input, ctx }) => {
      /* fetch template by day */
    }),
});

// Session Router
export const sessionRouter = createTRPCRouter({
  start: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(({ input, ctx }) => {
      /* start workout session */
    }),

  updateSet: protectedProcedure
    .input(UpdateSetSchema)
    .mutation(({ input, ctx }) => {
      /* update set data */
    }),

  complete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(({ input, ctx }) => {
      /* complete session */
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(({ input, ctx }) => {
      /* fetch session history */
    }),
});

// Progress Router
export const progressRouter = createTRPCRouter({
  getOneRM: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(({ input, ctx }) => {
      /* calculate 1RM */
    }),

  getVolumeProgression: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        timeframe: z.enum(["week", "month", "year"]),
      })
    )
    .query(({ input, ctx }) => {
      /* volume progression */
    }),

  getStrengthStandards: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(({ input, ctx }) => {
      /* strength standards comparison */
    }),
});
```

## 4. UI/UX Requirements

### 4.1 Design System

- **Component Library**: ShadCN UI for consistent design
- **Typography**: Clean, readable fonts optimized for data entry
- **Color Scheme**: High contrast for gym environment visibility
- **Responsive**: Mobile-first design for on-the-go usage

### 4.2 Key Interfaces

#### Dashboard

- **Quick Start**: Recently used templates with one-tap start
- **Progress Summary**: Recent PRs, volume trends, upcoming workouts
- **Navigation**: Clear access to plan, track, progress sections

#### Workout Builder

- **Day Selection**: Tab-based interface for Day 1-7
- **Exercise Search**: Autocomplete with muscle group filtering
- **Set Configuration**: Intuitive set/rep/RPE input with validation
- **Preview Mode**: Summary view of complete workout plan

#### Live Session

- **Timer Integration**: Visible workout duration and rest timers
- **Progress Indicators**: Set completion status and session progress
- **Previous Values**: Clear display of last session data
- **Quick Entry**: Optimized number input for weight/reps

#### Progress Analytics

- **Charts**: Volume progression, 1RM trends, session frequency
- **Personal Records**: Highlighted achievements with dates
- **Strength Standards**: Visual comparison with population norms
- **Body Weight**: Weight tracking with BMI calculations

### 4.3 User Experience Principles

- **Minimal Friction**: Auto-populate data, smart defaults, one-handed operation
- **Progress Visibility**: Clear feedback on improvements and achievements
- **Flexible Planning**: Easy template modification and duplication
- **Reliable Tracking**: Offline capability and automatic session saving

## 5. Development Phases

### Phase 1: Foundation (Days 1-2)

- Project setup with Next.js 14, TypeScript, ShadCN
- Supabase configuration and NextAuth integration
- Environment validation with Zod
- Basic authentication flow

### Phase 2: Exercise System (Days 3-4)

- Exercise database with core exercises (50-80 exercises)
- Custom exercise creation
- Exercise search and filtering
- tRPC exercise router implementation

### Phase 3: Workout Planning (Days 5-7)

- Template builder interface
- Multi-day workout creation
- Exercise selection and configuration
- Template management (save/edit/delete)

### Phase 4: Session Execution (Days 8-10)

- Live workout interface
- Previous session value population
- Real-time set logging
- Session timer and completion flow

### Phase 5: Progress Analytics (Days 11-13)

- 1RM calculation implementation
- Volume tracking and progression charts
- Body weight logging
- Strength standards comparison
- Session history interface

### Phase 6: Polish & Optimization (Days 14-15)

- Performance optimization and caching
- Responsive design polish
- Error handling and edge cases
- Progressive Web App features

## 6. Success Metrics

### 6.1 Technical Metrics

- **Page Load Time**: < 2 seconds for all routes
- **API Response Time**: < 500ms for 95% of requests
- **Database Query Performance**: < 100ms for standard operations
- **Error Rate**: < 1% of user interactions

### 6.2 User Experience Metrics

- **Session Completion Rate**: > 90% of started workouts completed
- **Template Creation**: Users create average 2+ workout templates
- **Progress Engagement**: 70% of users check progress weekly
- **Return Usage**: 80% weekly active user retention

### 6.3 Data Integrity

- **Validation Coverage**: 100% of API inputs validated with Zod
- **Type Safety**: Zero runtime type errors in production
- **Data Consistency**: RLS policies prevent unauthorized access
- **Backup & Recovery**: Automated daily database backups

## 7. Future Enhancements (Post-MVP)

### 7.1 Advanced Features

- **Exercise Media**: Video demonstrations and form tips
- **Social Features**: Workout sharing and community challenges
- **Advanced Analytics**: Muscle group balance, periodization tracking
- **Equipment Management**: Home gym equipment tracking

### 7.2 Platform Expansion

- **Mobile Apps**: Native iOS/Android applications
- **Wearable Integration**: Apple Watch, Garmin sync
- **Third-party APIs**: MyFitnessPal, Strava integration
- **Coach Dashboard**: Personal trainer management interface

### 7.3 AI/ML Features

- **Smart Recommendations**: Exercise and weight suggestions
- **Form Analysis**: Video form checking (future)
- **Periodization**: Automated program progression
- **Injury Prevention**: Load management warnings

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Approved By**: [Stakeholder Approval]  
**Development Timeline**: 15 days for MVP completion
