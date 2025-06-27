export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Workout Tracker
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Plan your workouts, track your progress, achieve your goals
          </p>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Plan Workouts
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Create custom workout templates organized by days (1-7) with
                exercises, sets, reps, and RPE targets.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Track Sessions
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Log your actual workouts with auto-populated previous values,
                weight tracking, and session timing.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Monitor Progress
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Analyze your 1RM calculations, volume progression, strength
                standards, and body weight trends.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Phase 1 Foundation Complete ✅
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 text-left max-w-2xl mx-auto">
                <li>• Next.js 14 + TypeScript + Tailwind CSS setup</li>
                <li>• Comprehensive Zod validation schemas</li>
                <li>
                  • tRPC API with exercise, template, session, and progress
                  routers
                </li>
                <li>• NextAuth configuration with Google OAuth</li>
                <li>
                  • Supabase client configuration with typed database schema
                </li>
                <li>• ShadCN UI component library integration</li>
                <li>• Environment validation with runtime checks</li>
                <li>• Type-safe API routes and authentication context</li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              To complete setup: Configure environment variables and create
              Supabase database tables.
              <br />
              Next: Phase 2 - Exercise System Implementation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
