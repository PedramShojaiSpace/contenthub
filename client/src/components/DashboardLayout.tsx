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
  Activity,
  BarChart2,
  BarChart3,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Compass,
  FileText,
  Film,
  GitFork,
  Globe,
  Hash,
  Image,
  LayoutDashboard,
  Library,
  Link2,
  LogOut,
  Mail,
  MailCheck,
  Megaphone,
  MessageSquare,
  Mic,
  Newspaper,
  PanelLeft,
  PenSquare,
  QrCode,
  RefreshCw,
  Rss,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Youtube,
  Zap,
  CheckSquare,
  Clock,
  FlaskConical,
  Award,
  Cpu,
  Inbox,
  UserSearch,
  Microscope,
  Layout,
  BookMarked,
  ArrowUpCircle,
  Database,
  Wand2,
  Play,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// ─── WORKSPACE DEFINITIONS ────────────────────────────────────────────────────
// Three workspaces: OWNER (funnel-focused), VA (queue-focused), SYSTEM (everything else)

// OWNER workspace — Pedram's Monday view: funnels, ascension, approvals, ads
const ownerItems = [
  { icon: Zap, label: "Interconnected HQ", path: "/interconnected-command" },
  { icon: LayoutDashboard, label: "Funnel Command", path: "/funnels" },
  { icon: Target, label: "Funnel Economics", path: "/funnel-economics" },
  { icon: Zap, label: "Funnel Advisor", path: "/funnel-advisor" },
  { icon: Play, label: "MOF Content Engine", path: "/mof-content" },
  { icon: Brain, label: "Analyze", path: "/analyze" },
  { icon: FileText, label: "Transcript Engine", path: "/transcript-engine" },
  { icon: Database, label: "Corpus Builder", path: "/corpus-builder" },
  { icon: Sparkles, label: "Pattern Extractor", path: "/pattern-extractor" },
  { icon: Wand2, label: "Script Factory", path: "/script-factory" },
  { icon: RefreshCw, label: "Performance Loop", path: "/performance-loop" },
  { icon: ArrowUpCircle, label: "Ascension Pipeline", path: "/ascension" },
  { icon: PenSquare, label: "Creation Studio", path: "/studio" },
  { icon: GitFork, label: "Content Pipeline", path: "/content-pipeline" },
  { icon: Clock, label: "Review Queue", path: "/review-queue" },
  { icon: Rss, label: "Substack Publisher", path: "/substack" },
  { icon: Rss, label: "Substack Sequence", path: "/substack-sequence" },
  { icon: BookOpen, label: "Paid Deep Dives", path: "/deep-dive" },
  { icon: Zap, label: "Tantra Quiz Funnel", path: "/quiz/tantra" },
  { icon: Activity, label: "System Health", path: "/system-health" },
  { icon: FlaskConical, label: "A/B Tests", path: "/ab-tests" },
  { icon: ShieldCheck, label: "Claims Review", path: "/claims-review" },
];

// OWNER — Paid Ads sub-group
const ownerAdsItems = [
  { icon: Megaphone, label: "Ads Manager", path: "/ads" },
  { icon: Newspaper, label: "Advertorial Builder", path: "/advertorial-builder" },
  { icon: Sparkles, label: "Meta Ad Variants", path: "/meta-ads" },
  { icon: Target, label: "Ad Attribution", path: "/ad-attribution" },
  { icon: BarChart3, label: "Campaign Monitor", path: "/campaign-monitor" },
];

// OWNER — SEO sub-group
const ownerSeoItems = [
  { icon: Trophy, label: "Content Scoreboard", path: "/scoreboard" },
  { icon: Search, label: "SEO Dashboard", path: "/seo" },
  { icon: Target, label: "Keyword Strategy", path: "/keyword-strategy" },
  { icon: Link2, label: "Backlink Outreach", path: "/backlink-outreach" },
];

// VA workspace — single merged queue + production tools
const vaQueueItems = [
  { icon: Users, label: "VA Dashboard", path: "/va" },
  { icon: CheckSquare, label: "VA Task Hub", path: "/va-tasks" },
  { icon: Users, label: "Kajabi Live Hub", path: "/kajabi-live" },
];

// VA — Content Production sub-group
const vaProductionItems = [
  { icon: Film, label: "Script Library", path: "/scripts" },
  { icon: Mic, label: "Podcast Production", path: "/podcast-production" },
  { icon: Mail, label: "Email Optimizer", path: "/email-optimizer" },
  { icon: MailCheck, label: "Plain Text Email", path: "/plain-text-email" },
  { icon: FileText, label: "E-Book Generator", path: "/ebook-generator" },
  { icon: Video, label: "Create Webinar", path: "/webinar" },
];

// VA — Short-Form (merged Viral Studio + Video Variants)
const vaShortFormItems = [
  { icon: Zap, label: "Viral Studio", path: "/viral-studio" },
  { icon: Clapperboard, label: "Video Variants", path: "/video-variants" },
];

// VA — Video Production sub-group
const vaVideoItems = [
  { icon: Video, label: "Video Production", path: "/video-production" },
  { icon: Youtube, label: "YouTube Pipeline", path: "/youtube-pipeline" },
  { icon: BarChart2, label: "YouTube Analytics", path: "/yt-analytics" },
  { icon: TrendingUp, label: "GA4 Site Analytics", path: "/ga4-analytics" },
  { icon: Youtube, label: "YouTube → Blog", path: "/video-to-blog" },
  { icon: BookOpen, label: "Blog → YouTube", path: "/blog-to-youtube" },
];

// VA — Reddit (disclosed presence + ROAS only — personas moved to System/Archive)
const vaRedditItems = [
  { icon: Hash, label: "Reddit Intel", path: "/reddit-intelligence" },
  { icon: BarChart3, label: "Reddit ROAS", path: "/reddit-roas" },
];

// SYSTEM workspace — library, intelligence, settings, archive
const systemLibraryItems = [
  { icon: Library, label: "Media Vault", path: "/media-vault" },
  { icon: Image, label: "Asset Library", path: "/assets" },
  { icon: BookOpen, label: "Book Library", path: "/book-library" },
  { icon: MessageSquare, label: "Ask the Urban Monk", path: "/ask-urban-monk" },
];

// SYSTEM — Links (merged UTM + QR)
const systemLinksItems = [
  { icon: Link2, label: "UTM Builder", path: "/utm" },
  { icon: QrCode, label: "QR Generator", path: "/qr-generator" },
];

// SYSTEM — Pages (all landing page tools)
const systemPagesItems = [
  { icon: Globe, label: "Landing Pages", path: "/landing-pages" },
  { icon: Layout, label: "CH Landing Pages", path: "/ch-pages" },
  { icon: Newspaper, label: "LinkedIn Newsfeed", path: "/newsfeed" },
];

// SYSTEM — Intelligence
const systemIntelItems = [
  { icon: TrendingUp, label: "Competitive Intel", path: "/competitive-intelligence" },
  { icon: FlaskConical, label: "Research", path: "/research" },
  { icon: ClipboardList, label: "Typeform", path: "/typeform" },
  { icon: Cpu, label: "Intelligence Hub", path: "/intelligence" },
  { icon: Zap, label: "Webinar Intel", path: "/webinar-intelligence" },
  { icon: Sparkles, label: "Avatar Repository", path: "/avatar-repository" },
  { icon: Users, label: "Avatar", path: "/avatar" },
  { icon: RefreshCw, label: "Historical Posts", path: "/historical-posts" },
  { icon: Settings, label: "WordPress Setup", path: "/wordpress-setup" },
  { icon: Settings, label: "Default Channels", path: "/default-channels" },
  { icon: Inbox, label: "Ingest Inbox", path: "/ingest" },
  { icon: ShieldCheck, label: "Verified Links", path: "/verified-links" },
  { icon: UserSearch, label: "Lead Scrubber", path: "/lead-scrubber" },
  { icon: Target, label: "Presence Assessment", path: "/presence-assessment" },
];

// SYSTEM — Archive (rarely used, kept for reference)
const systemArchiveItems = [
  { icon: Hash, label: "Reddit Personas", path: "/reddit-personas" },
  { icon: Brain, label: "Strategy Brain", path: "/strategy" },
  { icon: Rss, label: "Channel Watchlist", path: "/channels" },
  { icon: BarChart3, label: "LLM Projects", path: "/llm-projects" },
  { icon: MessageSquare, label: "ManyChat Wizard", path: "/manychat-wizard" },
  { icon: Award, label: "Press", path: "/press" },
  { icon: Microscope, label: "Kids Research", path: "/kids-review" },
  { icon: ShoppingBag, label: "Collective Sourcing", path: "/collective-sourcing" },
  { icon: Rss, label: "Soro Intelligence", path: "/soro-intelligence" },
];

// All paths for active-state detection
const allOwnerPaths = new Set([
  ...ownerItems.map(i => i.path),
  "/substack-sequence",
  "/analyze",
  "/transcript-engine",
  "/corpus-builder",
  "/pattern-extractor",
  "/script-factory",
  "/performance-loop",
  ...ownerAdsItems.map(i => i.path),
  ...ownerSeoItems.map(i => i.path),
]);
const allVaPaths = new Set([
  ...vaQueueItems.map(i => i.path),
  ...vaProductionItems.map(i => i.path),
  ...vaShortFormItems.map(i => i.path),
  ...vaVideoItems.map(i => i.path),
  ...vaRedditItems.map(i => i.path),
]);
const allSystemPaths = new Set([
  ...systemLibraryItems.map(i => i.path),
  ...systemLinksItems.map(i => i.path),
  ...systemPagesItems.map(i => i.path),
  ...systemIntelItems.map(i => i.path),
  ...systemArchiveItems.map(i => i.path),
]);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const WORKSPACE_KEY = "sidebar-workspace";

type Workspace = "owner" | "va" | "system";

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
              Content Hub
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Dr. Pedram Shojai's AI-powered content command center. Sign in to access your dashboard.
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

// Helper: collapsible sub-group
function NavGroup({
  icon: Icon,
  label,
  items,
  isCollapsed,
  location,
  setLocation,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  label: string;
  items: { icon: React.ElementType; label: string; path: string }[];
  isCollapsed: boolean;
  location: string;
  setLocation: (path: string) => void;
  defaultOpen?: boolean;
}) {
  const isGroupActive = items.some(i => i.path === location);
  const [open, setOpen] = useState(isGroupActive || defaultOpen);

  useEffect(() => {
    if (isGroupActive) setOpen(true);
  }, [isGroupActive]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isGroupActive}
        onClick={() => {
          if (isCollapsed) {
            setLocation(items[0].path);
          } else {
            setOpen(prev => !prev);
          }
        }}
        tooltip={label}
        className={`h-10 transition-all font-normal ${isGroupActive ? "text-primary" : ""}`}
      >
        <Icon className={`h-4 w-4 ${isGroupActive ? "text-primary" : ""}`} />
        <span className="flex-1">{label}</span>
        {!isCollapsed && (
          open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </SidebarMenuButton>
      {open && !isCollapsed && (
        <div className="ml-3 mt-0.5 mb-1 border-l border-border/40 pl-3 flex flex-col gap-0.5">
          {items.map(sub => {
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
  );
}

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

  // Determine active workspace from current route, with localStorage persistence
  const getWorkspaceForPath = (path: string): Workspace => {
    if (allOwnerPaths.has(path)) return "owner";
    if (allVaPaths.has(path)) return "va";
    if (allSystemPaths.has(path)) return "system";
    return "owner"; // default
  };

  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const saved = localStorage.getItem(WORKSPACE_KEY) as Workspace | null;
    const fromPath = getWorkspaceForPath(location);
    // If current path belongs to a workspace, use that; otherwise use saved or default
    if (allOwnerPaths.has(location) || allVaPaths.has(location) || allSystemPaths.has(location)) {
      return fromPath;
    }
    return saved ?? "owner";
  });

  // Sync workspace when location changes to a known path
  useEffect(() => {
    if (allOwnerPaths.has(location)) setWorkspace("owner");
    else if (allVaPaths.has(location)) setWorkspace("va");
    else if (allSystemPaths.has(location)) setWorkspace("system");
  }, [location]);

  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, workspace);
  }, [workspace]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
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
    const handleMouseUp = () => setIsResizing(false);
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

  // Active label for mobile header
  const allItems = [
    ...ownerItems, ...ownerAdsItems, ...ownerSeoItems,
    ...vaQueueItems, ...vaProductionItems, ...vaShortFormItems, ...vaVideoItems, ...vaRedditItems,
    ...systemLibraryItems, ...systemLinksItems, ...systemPagesItems, ...systemIntelItems, ...systemArchiveItems,
  ];
  const activeLabel = allItems.find(i => i.path === location)?.label ?? "Menu";

  const workspaceTabs: { id: Workspace; label: string }[] = [
    { id: "owner", label: "Owner" },
    { id: "va", label: "VA" },
    { id: "system", label: "System" },
  ];

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
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Fire_0b452e9b.png"
                    alt="The Urban Monk"
                    className="w-7 h-7 shrink-0 object-contain"
                  />
                  <span className="font-semibold tracking-tight truncate text-foreground text-sm">
                    Content Hub
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-0 bg-[#f7f4ef]">
            {/* Workspace tabs */}
            {!isCollapsed && (
              <div className="flex border-b border-border/30 bg-[#f7f4ef]">
                {workspaceTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setWorkspace(tab.id)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                      workspace === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <SidebarMenu className="px-2 py-1">

              {/* ── OWNER WORKSPACE ── */}
              {workspace === "owner" && (
                <>
                  {ownerItems.map(item => {
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
                  <NavGroup
                    icon={Megaphone}
                    label="Paid Ads"
                    items={ownerAdsItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Search}
                    label="SEO"
                    items={ownerSeoItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                </>
              )}

              {/* ── VA WORKSPACE ── */}
              {workspace === "va" && (
                <>
                  {vaQueueItems.map(item => {
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
                  <NavGroup
                    icon={PenSquare}
                    label="Content Production"
                    items={vaProductionItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Zap}
                    label="Short-Form"
                    items={vaShortFormItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Video}
                    label="Video Production"
                    items={vaVideoItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Hash}
                    label="Reddit"
                    items={vaRedditItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                </>
              )}

              {/* ── SYSTEM WORKSPACE ── */}
              {workspace === "system" && (
                <>
                  <NavGroup
                    icon={Library}
                    label="Library"
                    items={systemLibraryItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                    defaultOpen={true}
                  />
                  <NavGroup
                    icon={Link2}
                    label="Links"
                    items={systemLinksItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Globe}
                    label="Pages"
                    items={systemPagesItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={Sparkles}
                    label="Intelligence"
                    items={systemIntelItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                  <NavGroup
                    icon={BookMarked}
                    label="Archive"
                    items={systemArchiveItems}
                    isCollapsed={isCollapsed}
                    location={location}
                    setLocation={setLocation}
                  />
                </>
              )}

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
