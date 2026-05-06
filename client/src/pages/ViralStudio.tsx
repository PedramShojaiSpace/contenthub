import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Zap, FileText, RefreshCw, TrendingUp, MessageSquare, BarChart2, FlaskConical } from "lucide-react";
import HookGenerator from "./viral/HookGenerator";
import ScriptGenerator from "./viral/ScriptGenerator";
import RepurposeEngine from "./viral/RepurposeEngine";
import ViralTopics from "./viral/ViralTopics";
import DMPlaybook from "./viral/DMPlaybook";
import AnalyticsDashboard from "./viral/AnalyticsDashboard";
import ABTestLab from "./viral/ABTestLab";

const TABS = [
  { id: "hooks", label: "Hook Generator", icon: Zap, badge: "Core" },
  { id: "scripts", label: "Script Generator", icon: FileText, badge: "Core" },
  { id: "repurpose", label: "Repurpose Engine", icon: RefreshCw, badge: "Power" },
  { id: "topics", label: "Viral Topics", icon: TrendingUp, badge: "Daily" },
  { id: "dm", label: "DM Playbooks", icon: MessageSquare, badge: "Growth" },
  { id: "analytics", label: "Analytics", icon: BarChart2, badge: "Insights" },
  { id: "abtest", label: "A/B Test Lab", icon: FlaskConical, badge: "Testing" },
];

// Map URL tab param values to tab IDs
const TAB_PARAM_MAP: Record<string, string> = {
  hooks: "hooks",
  hook: "hooks",
  script: "scripts",
  scripts: "scripts",
  repurpose: "repurpose",
  topics: "topics",
  dm: "dm",
  analytics: "analytics",
  abtest: "abtest",
  ab: "abtest",
};

export default function ViralStudio() {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") ?? "";
  const initialTab = TAB_PARAM_MAP[tabParam] ?? "hooks";
  const [activeTab, setActiveTab] = useState(initialTab);

  // When navigated with ?tab=... update the active tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t && TAB_PARAM_MAP[t]) {
      setActiveTab(TAB_PARAM_MAP[t]);
    }
  }, [window.location.search]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-background">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Viral Studio</h1>
            <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 border-violet-200">
              7 Tools
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Your complete viral content engine — hooks, scripts, repurposing, DM automation, and A/B testing in one place.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pt-3 border-b border-border bg-background">
            <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap gap-1">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <TabsContent value="hooks" className="m-0 h-full">
              <HookGenerator />
            </TabsContent>
            <TabsContent value="scripts" className="m-0 h-full">
              <ScriptGenerator />
            </TabsContent>
            <TabsContent value="repurpose" className="m-0 h-full">
              <RepurposeEngine />
            </TabsContent>
            <TabsContent value="topics" className="m-0 h-full">
              <ViralTopics />
            </TabsContent>
            <TabsContent value="dm" className="m-0 h-full">
              <DMPlaybook />
            </TabsContent>
            <TabsContent value="analytics" className="m-0 h-full">
              <AnalyticsDashboard />
            </TabsContent>
            <TabsContent value="abtest" className="m-0 h-full">
              <ABTestLab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
