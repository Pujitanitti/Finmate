import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { PageTransition } from "@/components/layout/page-transition";
import { ToastProvider } from "@/components/layout/toast";

export function Shell({
  userName,
  children,
}: {
  userName?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-muted/30">
          <Sidebar />
          <div className="flex flex-1 flex-col pb-16 md:pb-0">
            <Topbar userName={userName} />
            <main className="flex-1 p-6">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <MobileNav />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
