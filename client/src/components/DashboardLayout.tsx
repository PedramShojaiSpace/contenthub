import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Brain,
  Film,
  Globe,
  Image,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PenSquare,
  FlaskConical,
  Rss,
  ClipboardList,
  Award,
  Cpu,
  Library,
  Users,
  Video,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Compass,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// Top-level nav items (always visible)
const topNavItems = [
  { icon: LayoutDashboard, label: "Command Center", path: "/" },
  { icon: PenSquare, label: "Creation Studio", path: "/studio" },
  { icon: Film, label: "Script Library", path: "/scripts" },
  { icon: Image, label: "Asset Library", path: "/assets" },
  { icon: Globe, label: "Landing Pages", path: "/landing-pages" },
  { icon: Library, label: "Media Vault", path: "/media-vault" },
  { icon: Video, label: "Create Webinar", path: "/webinar" },
];

// Strategy sub-items (grouped under collapsible parent)
const strategyItems = [
  { icon: Brain, label: "Strategy Brain", path: "/strategy" },
  { icon: Rss, label: "Channel Watchlist", path: "/channels" },
];

const strategyPaths = new Set(strategyItems.map((i) => i.path));

// Intelligence sub-items (grouped under collapsible parent)
const intelligenceItems = [
  { icon: FlaskConical, label: "Research", path: "/research" },
  { icon: ClipboardList, label: "Typeform", path: "/typeform" },
  { icon: Award, label: "Press", path: "/press" },
  { icon: Cpu, label: "Intelligence Hub", path: "/intelligence" },
  { icon: Zap, label: "Webinar Intel", path: "/webinar-intelligence" },
  { icon: Users, label: "Avatar", path: "/avatar" },
  { icon: BarChart3, label: "LLM Projects", path: "/llm-projects" },
];

const intelligencePaths = new Set(intelligenceItems.map((i) => i.path));

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png"
              alt="The Urban Monk"
              className="w-20 h-20 object-contain"
            />
            <h1 className="text-2xl font-serif font-semibold tracking-tight text-center text-foreground">
              UMP Content Hub
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Urban Monk Productions AI-powered content command center. Sign in to access your dashboard.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Auto-expand Intelligence group when an intelligence route is active
  const isIntelligenceActive = intelligencePaths.has(location);
  const [intelligenceOpen, setIntelligenceOpen] = useState(isIntelligenceActive);

  // Keep group open when navigating to an intelligence sub-route
  useEffect(() => {
    if (isIntelligenceActive) setIntelligenceOpen(true);
  }, [isIntelligenceActive]);

  // Auto-expand Strategy group when a strategy route is active
  const isStrategyActive = strategyPaths.has(location);
  const [strategyOpen, setStrategyOpen] = useState(isStrategyActive);

  useEffect(() => {
    if (isStrategyActive) setStrategyOpen(true);
  }, [isStrategyActive]);

  const activeLabel =
    topNavItems.find((i) => i.path === location)?.label ??
    intelligenceItems.find((i) => i.path === location)?.label ??
    strategyItems.find((i) => i.path === location)?.label ??
    "Menu";

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/50 bg-[#f7f4ef]">
          <SidebarHeader className="h-16 justify-center border-b border-border/30 bg-[#f7f4ef]">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-primary/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png"
                    alt="The Urban Monk"
                    className="w-7 h-7 shrink-0 object-contain"
                  />
                  <span className="font-semibold tracking-tight truncate text-foreground text-sm">
                    UMP Content Hub
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2 bg-[#f7f4ef]">
            <SidebarMenu className="px-2 py-1">
              {/* Top-level nav items */}
              {topNavItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal ${isActive ? "text-primary" : ""}`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Strategy Group — collapsible */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isStrategyActive}
                  onClick={() => {
                    if (isCollapsed) {
                      setLocation(strategyItems[0].path);
                    } else {
                      setStrategyOpen((prev) => !prev);
                    }
                  }}
                  tooltip="Strategy"
                  className={`h-10 transition-all font-normal ${isStrategyActive ? "text-primary" : ""}`}
                >
                  <Compass className={`h-4 w-4 ${isStrategyActive ? "text-primary" : ""}`} />
                  <span className="flex-1">Strategy</span>
                  {!isCollapsed && (
                    strategyOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </SidebarMenuButton>

                {strategyOpen && !isCollapsed && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-border/40 pl-3 flex flex-col gap-0.5">
                    {strategyItems.map((sub) => {
                      const isActive = location === sub.path;
                      return (
                        <button
                          key={sub.path}
                          onClick={() => setLocation(sub.path)}
                          className={`flex items-center gap-2.5 h-9 px-2 rounded-md text-sm transition-colors w-full text-left
                            ${isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            }`}
                        >
                          <sub.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SidebarMenuItem>

              {/* Intelligence Group — collapsible */}
              <SidebarMenuItem>
                {/* Group header button */}
                <SidebarMenuButton
                  isActive={isIntelligenceActive}
                  onClick={() => {
                    if (isCollapsed) {
                      // When sidebar is icon-only, clicking navigates to first sub-item
                      setLocation(intelligenceItems[0].path);
                    } else {
                      setIntelligenceOpen((prev) => !prev);
                    }
                  }}
                  tooltip="Intelligence"
                  className={`h-10 transition-all font-normal ${isIntelligenceActive ? "text-primary" : ""}`}
                >
                  <Sparkles className={`h-4 w-4 ${isIntelligenceActive ? "text-primary" : ""}`} />
                  <span className="flex-1">Intelligence</span>
                  {!isCollapsed && (
                    intelligenceOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </SidebarMenuButton>

                {/* Sub-items — only shown when expanded and sidebar is open */}
                {intelligenceOpen && !isCollapsed && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-border/40 pl-3 flex flex-col gap-0.5">
                    {intelligenceItems.map((sub) => {
                      const isActive = location === sub.path;
                      return (
                        <button
                          key={sub.path}
                          onClick={() => setLocation(sub.path)}
                          className={`flex items-center gap-2.5 h-9 px-2 rounded-md text-sm transition-colors w-full text-left
                            ${isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            }`}
                        >
                          <sub.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/30 bg-[#f7f4ef]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/50 h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeLabel}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
