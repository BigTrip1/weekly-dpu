import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/upload", label: "Upload" },
  { to: "/mappings", label: "Departments" },
  { to: "/rules", label: "Rules" },
  { to: "/audits", label: "Audits" },
];

export function Shell() {
  const location = useLocation();
  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-black/20 bg-header text-header-foreground dark:border-border">
          <div className="header-grid relative">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <img src="/jcb-logo.png" alt="JCB" width={128} height={50} className="h-10 w-auto shrink-0 rounded-[3px]" />
                <div className="leading-none">
                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-70">Build quality</p>
                  <h1 className="mt-1 font-display text-[26px] leading-none font-extrabold tracking-wide uppercase">Executive DPU Review</h1>
                </div>
              </div>
              <div className="ml-auto md:order-3 md:ml-0">
                <ThemeToggle />
              </div>
              <nav className="order-last flex w-full items-center gap-1 overflow-x-auto md:order-2 md:ml-auto md:w-auto" aria-label="Main">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap uppercase transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        isActive
                          ? "bg-[#161616] text-jcb dark:bg-jcb dark:text-[#111]"
                          : "text-header-foreground/80 hover:bg-header-foreground/10 hover:text-header-foreground",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
          <div className="hazard h-[5px]" aria-hidden="true" />
        </header>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
