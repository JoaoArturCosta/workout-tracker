"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, trpcClient } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { toast } from "sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            retry: (failureCount, error: unknown) => {
              // Don't retry on 4xx errors
              const errorWithData = error as { data?: { httpStatus?: number } };
              const httpStatus = errorWithData?.data?.httpStatus;
              if (
                httpStatus !== undefined &&
                httpStatus >= 400 &&
                httpStatus < 500
              ) {
                return false;
              }
              // Retry up to 3 times for other errors
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: false,
            onError: (error: unknown) => {
              // Global error handling
              const message =
                (error as { message?: string })?.message ||
                "An unexpected error occurred";
              toast.error(message);
            },
          },
        },
      })
  );

  return (
    <SessionProvider>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            expand={true}
            richColors={true}
            closeButton={true}
            toastOptions={{
              duration: 4000,
              className: "text-sm",
            }}
          />
        </QueryClientProvider>
      </api.Provider>
    </SessionProvider>
  );
}
