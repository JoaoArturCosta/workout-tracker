# Workout Tracker App

A comprehensive workout tracking application built with Next.js 14, tRPC, NextAuth, and Supabase.

## ✅ Phase 1 Complete: Foundation Setup

### Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: tRPC, NextAuth (Google OAuth), Supabase
- **Validation**: Zod (runtime validation, environment variables)
- **UI Components**: ShadCN UI
- **State Management**: tRPC + React Query

### What's Built ✅

#### 1. Project Foundation

- [x] Next.js 14 with TypeScript and App Router
- [x] Tailwind CSS + ShadCN UI integration
- [x] Comprehensive environment validation with Zod
- [x] Production-ready project structure

#### 2. Authentication System

- [x] NextAuth configuration with Google OAuth provider
- [x] Supabase adapter integration
- [x] Protected route middleware
- [x] Session management with JWT strategy

#### 3. Database Architecture

- [x] Complete Supabase TypeScript type definitions
- [x] 8 core database tables designed:
  - `exercises` - Exercise database with muscle groups
  - `workout_templates` - User workout plans (Day 1-7)
  - `template_exercises` - Planned exercises with sets/reps/RPE
  - `workout_sessions` - Actual workout executions
  - `session_exercises` - Session exercise tracking
  - `session_sets` - Individual set logging with weight/reps
  - `body_weight_logs` - Body weight tracking over time
  - Users table (managed by NextAuth)

#### 4. Type-Safe API Layer

- [x] Complete tRPC setup with error handling
- [x] Comprehensive Zod validation schemas
- [x] 4 main API routers:
  - **Exercise Router**: CRUD operations, search, muscle group filtering
  - **Template Router**: Workout planning, day management, duplication
  - **Session Router**: Live workout tracking, completion, history
  - **Progress Router**: 1RM calculations, volume tracking, strength standards

#### 5. Validation & Type Safety

- [x] Environment variable validation at runtime
- [x] Complete Zod schemas for all data models
- [x] Type-safe tRPC procedures with input/output validation
- [x] Runtime type checking across the application

### Key Features Implemented

#### Exercise Management

- Curated exercise database by muscle groups
- Custom exercise creation for users
- Advanced search and filtering capabilities
- Equipment tracking and categorization

#### Workout Planning

- 7-day workout template system
- Exercise selection with set/rep/RPE planning
- Template duplication and modification
- Order management for exercise sequences

#### Session Tracking

- Live workout execution with timers
- Previous session value auto-population
- Real-time set logging with completion tracking
- Session duration calculation and storage

#### Progress Analytics

- 1RM calculations using Epley formula
- Volume progression tracking over time
- Strength standards comparison system
- Personal record detection and highlighting

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Google OAuth credentials

### Environment Setup

Create a `.env.local` file with:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Node Environment
NODE_ENV="development"
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Database Setup

Create the following tables in your Supabase database:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create exercises table
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN ('chest', 'back', 'shoulders', 'arms', 'legs', 'core')),
  equipment TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workout_templates table
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create template_exercises table
CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL CHECK (sets >= 1 AND sets <= 20),
  reps_min INTEGER NOT NULL CHECK (reps_min >= 1 AND reps_min <= 100),
  reps_max INTEGER NOT NULL CHECK (reps_max >= 1 AND reps_max <= 100),
  rpe_target INTEGER CHECK (rpe_target >= 6 AND rpe_target <= 10)
);

-- Create workout_sessions table
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE
);

-- Create session_exercises table
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL
);

-- Create session_sets table
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 1000),
  reps INTEGER NOT NULL CHECK (reps >= 1 AND reps <= 100),
  rpe INTEGER CHECK (rpe >= 6 AND rpe <= 10),
  completed BOOLEAN DEFAULT FALSE
);

-- Create body_weight_logs table
CREATE TABLE body_weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 1000),
  unit TEXT DEFAULT 'kg' CHECK (unit IN ('kg', 'lbs')),
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
CREATE POLICY "Users can view all exercises" ON exercises FOR SELECT USING (true);
CREATE POLICY "Users can create custom exercises" ON exercises FOR INSERT WITH CHECK (auth.uid() = user_id AND is_custom = true);
CREATE POLICY "Users can update their custom exercises" ON exercises FOR UPDATE USING (auth.uid() = user_id AND is_custom = true);
CREATE POLICY "Users can delete their custom exercises" ON exercises FOR DELETE USING (auth.uid() = user_id AND is_custom = true);

CREATE POLICY "Users can manage their templates" ON workout_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their template exercises" ON template_exercises FOR ALL USING (auth.uid() IN (SELECT user_id FROM workout_templates WHERE id = template_id));
CREATE POLICY "Users can manage their sessions" ON workout_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their session exercises" ON session_exercises FOR ALL USING (auth.uid() IN (SELECT user_id FROM workout_sessions WHERE id = session_id));
CREATE POLICY "Users can manage their session sets" ON session_sets FOR ALL USING (auth.uid() IN (SELECT ws.user_id FROM workout_sessions ws JOIN session_exercises se ON ws.id = se.session_id WHERE se.id = session_exercise_id));
CREATE POLICY "Users can manage their body weight logs" ON body_weight_logs FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX idx_workout_templates_day_number ON workout_templates(day_number);
CREATE INDEX idx_template_exercises_template_id ON template_exercises(template_id);
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX idx_session_sets_session_exercise_id ON session_sets(session_exercise_id);
CREATE INDEX idx_body_weight_logs_user_id ON body_weight_logs(user_id);
```

## 📋 Next Steps: Phase 2

### Exercise System Implementation (Days 3-4)

- [ ] Seed database with core exercises (50-80 exercises)
- [ ] Build exercise management UI components
- [ ] Implement search and filtering interface
- [ ] Create custom exercise creation form
- [ ] Add muscle group categorization
- [ ] Build exercise selection components

### Key Components to Build

- `ExerciseList` - Display exercises with filtering
- `ExerciseSearch` - Search and filter interface
- `ExerciseForm` - Create/edit custom exercises
- `ExerciseCard` - Individual exercise display
- `MuscleGroupFilter` - Filter by muscle groups

### Database Seeding

- Chest: Bench Press, Push-ups, Dips, Incline Press, etc.
- Back: Pull-ups, Rows, Deadlifts, Lat Pulldowns, etc.
- Shoulders: Overhead Press, Lateral Raises, Front Raises, etc.
- Arms: Bicep Curls, Tricep Extensions, Hammer Curls, etc.
- Legs: Squats, Lunges, Leg Press, Calf Raises, etc.
- Core: Planks, Crunches, Russian Twists, Dead Bugs, etc.

## 🏗️ Architecture Highlights

### Type Safety & Validation

- **End-to-end type safety** from database to frontend
- **Runtime validation** with Zod at every layer
- **Environment validation** prevents configuration errors
- **API input/output validation** ensures data integrity

### Performance Optimizations

- **Database indexing** for fast queries
- **tRPC batching** for efficient API calls
- **React Query caching** for optimal data fetching
- **Optimistic updates** for responsive UX

### Security Features

- **Row Level Security** in Supabase
- **Protected tRPC procedures** with authentication
- **OAuth integration** with Google
- **Input sanitization** and validation

### Scalability Considerations

- **Modular router architecture** for easy feature addition
- **Flexible database schema** supporting future enhancements
- **Component-based UI** with reusable patterns
- **Type-safe API contracts** preventing breaking changes

## 🤝 Development Workflow

1. **Feature Branches**: Create feature branches for each major component
2. **Type-First Development**: Define Zod schemas before implementation
3. **API-First Approach**: Build tRPC procedures before UI components
4. **Component Testing**: Test components with realistic data
5. **Progressive Enhancement**: Build core functionality first, then optimize

---

**Phase 1 Status**: ✅ Complete - Robust foundation ready for feature development  
**Next Phase**: Exercise System Implementation  
**Estimated Timeline**: 15 days total for full MVP
