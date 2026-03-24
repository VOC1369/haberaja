import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { NotificationModal } from "@/components/NotificationModal";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Global safety net: prevent unhandled promise rejections from crashing the app
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Known React HMR issue — suppress to prevent blank screen
      if (event.reason?.message?.includes('Should have a queue')) {
        console.warn('[App] Suppressed React HMR queue error — safe to ignore');
        event.preventDefault();
        return;
      }
      console.error('[App] Unhandled rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        storageKey="voc-theme"
      >
        <TooltipProvider>
          <Toaster />
          <NotificationModal />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
