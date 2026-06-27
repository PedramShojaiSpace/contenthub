import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Researcher {
  id: number;
  name: string;
  accessCode: string;
}

interface Mission {
  id: string;
  title: string;
  emoji: string;
  bookSource: string;
  description: string;
  stepCount: number;
}

interface MissionStep {
  id: string;
  title: string;
  instruction: string;
  prompt: string | null;
  inputLabel: string | null;
}

interface FullMission extends Mission {
  steps: MissionStep[];
}

const STORAGE_KEY = "kids_researcher";

function loadResearcher(): Researcher | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveResearcher(r: Researcher) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

function clearResearcher() {
  localStorage.removeItem(STORAGE_KEY);
}

const MISSION_COLORS = [
  { bg: "bg-amber-50", border: "border-amber-300", badge: "bg-amber-200 text-amber-800" },
  { bg: "bg-sky-50", border: "border-sky-300", badge: "bg-sky-200 text-sky-800" },
  { bg: "bg-emerald-50", border: "border-emerald-300", badge: "bg-emerald-200 text-emerald-800" },
  { bg: "bg-violet-50", border: "border-violet-300", badge: "bg-violet-200 text-violet-800" },
  { bg: "bg-rose-50", border: "border-rose-300", badge: "bg-rose-200 text-rose-800" },
  { bg: "bg-teal-50", border: "border-teal-300", badge: "bg-teal-200 text-teal-800" },
];

function IdentifyScreen({ onLogin }: { onLogin: (r: Researcher) => void }) {
  const [mode, setMode] = useState<"choose" | "new" | "returning">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const registerMutation = trpc.kidsResearch.register.useMutation({
    onSuccess: (data) => {
      const r: Researcher = { id: data.id, name: data.name, accessCode: data.accessCode };
      saveResearcher(r);
      onLogin(r);
      toast.success(`Welcome, ${data.name}! Your code is: ${data.accessCode}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const loginMutation = trpc.kidsResearch.login.useMutation({
    onSuccess: (data) => {
      const r: Researcher = { id: data.id, name: data.name, accessCode: data.accessCode };
      saveResearcher(r);
      onLogin(r);
      toast.success(`Welcome back, ${data.name}!`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-2">🔬</div>
          <h1 className="text-3xl font-bold text-gray-900">Urban Monk Research Lab</h1>
          <p className="text-gray-600 text-lg">
            Welcome, researcher! Help Dad find the best products for The Urban Monk store.
          </p>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setMode("new")}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold rounded-2xl transition-colors shadow-md"
            >
              🌟 I'm new here
            </button>
            <button
              onClick={() => setMode("returning")}
              className="w-full py-4 px-6 bg-white hover:bg-gray-50 text-gray-800 text-lg font-semibold rounded-2xl border-2 border-gray-200 transition-colors"
            >
              🔑 I have a code
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "new") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <button onClick={() => setMode("choose")} className="text-emerald-600 font-medium">← Back</button>
          <div className="text-center">
            <div className="text-5xl mb-3">🌟</div>
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-gray-500 mt-1">Pick a secret code you'll remember</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your first name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bodhi"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Create a secret code (4–16 characters, no spaces)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                placeholder="e.g. ninja2025"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-emerald-400"
              />
              <p className="text-xs text-gray-400 mt-1">Write this down — you'll need it to log back in!</p>
            </div>
            <button
              onClick={() => registerMutation.mutate({ name: name.trim(), accessCode: code.trim() })}
              disabled={!name.trim() || code.trim().length < 4 || registerMutation.isPending}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-lg font-semibold rounded-2xl transition-colors"
            >
              {registerMutation.isPending ? "Creating..." : "Start my missions! 🚀"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <button onClick={() => setMode("choose")} className="text-emerald-600 font-medium">← Back</button>
        <div className="text-center">
          <div className="text-5xl mb-3">🔑</div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
          <p className="text-gray-500 mt-1">Enter your secret code to continue</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your secret code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              placeholder="e.g. ninja2025"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-emerald-400"
            />
          </div>
          <button
            onClick={() => loginMutation.mutate({ accessCode: code.trim() })}
            disabled={!code.trim() || loginMutation.isPending}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-lg font-semibold rounded-2xl transition-colors"
          >
            {loginMutation.isPending ? "Logging in..." : "Continue my missions →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MissionSelector({
  researcher,
  onSelect,
  onLogout,
}: {
  researcher: Researcher;
  onSelect: (id: string) => void;
  onLogout: () => void;
}) {
  const { data: missions, isLoading } = trpc.kidsResearch.getMissions.useQuery();
  const { data: mySubmissions } = trpc.kidsResearch.getMySubmissions.useQuery({
    researcherId: researcher.id,
  });

  const submissionMap: Record<string, string> = {};
  if (mySubmissions) {
    for (const s of mySubmissions) {
      submissionMap[s.missionId] = s.status;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🔬 Research Lab</h1>
          <p className="text-sm text-gray-500">Agent: {researcher.name}</p>
        </div>
        <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600">Log out</button>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose your mission</h2>
          <p className="text-gray-500 mt-1">Each mission helps Dad find great products for The Urban Monk store.</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Loading missions...
          </div>
        )}
        <div className="space-y-3">
          {(missions ?? []).map((mission, idx) => {
            const color = MISSION_COLORS[idx % MISSION_COLORS.length];
            const status = submissionMap[mission.id];
            return (
              <button
                key={mission.id}
                onClick={() => onSelect(mission.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 ${color.bg} ${color.border} hover:shadow-md transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{mission.emoji}</span>
                    <div>
                      <div className="font-bold text-gray-900 text-lg leading-tight">{mission.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">From: {mission.bookSource}</div>
                      <div className="text-sm text-gray-700 mt-2 leading-relaxed">{mission.description}</div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {status === "submitted" && (
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">✓ Done</span>
                    )}
                    {status === "draft" && (
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">In progress</span>
                    )}
                    {!status && (
                      <span className={`inline-block px-2 py-1 ${color.badge} text-xs font-bold rounded-full`}>{mission.stepCount} steps</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MissionFlow({
  researcher,
  missionId,
  onBack,
}: {
  researcher: Researcher;
  missionId: string;
  onBack: () => void;
}) {
  const { data: mission } = trpc.kidsResearch.getMission.useQuery({ missionId });
  const { data: mySubmissions, refetch: refetchSubmissions } = trpc.kidsResearch.getMySubmissions.useQuery({
    researcherId: researcher.id,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [findings, setFindings] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mySubmissions && mission) {
      const existing = mySubmissions.find((s: any) => s.missionId === missionId);
      if (existing) {
        setFindings(existing.findings ?? {});
        if (existing.status === "submitted") setSubmitted(true);
      }
    }
  }, [mySubmissions, mission, missionId]);

  const saveProgressMutation = trpc.kidsResearch.saveProgress.useMutation();
  const submitMissionMutation = trpc.kidsResearch.submitMission.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      refetchSubmissions();
      toast.success("Mission submitted to Dad! Great work! 🎉");
    },
    onError: (err) => toast.error(err.message),
  });

  // Reset copied state whenever the step changes
  useEffect(() => {
    setCopied(false);
  }, [currentStep]);

  const handleCopy = useCallback((text: string) => {
    // Try modern Clipboard API first, fall back to execCommand for older/mobile browsers
    const doFallbackCopy = () => {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silent fail — user can manually select the text
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => doFallbackCopy());
    } else {
      doFallbackCopy();
    }
  }, []);

  const handleSave = useCallback(
    (newFindings: Record<string, string>) => {
      saveProgressMutation.mutate({ researcherId: researcher.id, missionId, findings: newFindings });
    },
    [researcher.id, missionId, saveProgressMutation]
  );

  const handleNext = () => {
    // Navigate immediately — save happens in background (onBlur already fired or fires here)
    // Don't block navigation on the save mutation
    if (mission && currentStep < mission.steps.length - 1) {
      // Fire save without awaiting it
      saveProgressMutation.mutate({ researcherId: researcher.id, missionId, findings });
      setCurrentStep((s) => s + 1);
    }
  };

  const handleSubmit = () => {
    if (!mission) return;
    const lastStep = mission.steps[mission.steps.length - 1];
    const recommendation = findings[lastStep.id] ?? "";
    if (recommendation.trim().length < 10) {
      toast.error("Please write your recommendation before submitting.");
      return;
    }
    submitMissionMutation.mutate({ researcherId: researcher.id, missionId, findings, recommendation });
  };

  if (!mission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-5">
          <div className="text-7xl">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900">Mission Complete!</h2>
          <p className="text-gray-600 text-lg">You submitted <strong>{mission.title}</strong> to Dad. Amazing work!</p>
          <button onClick={onBack} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold rounded-2xl transition-colors">
            ← Back to missions
          </button>
        </div>
      </div>
    );
  }

  const step = mission.steps[currentStep];
  const isLastStep = currentStep === mission.steps.length - 1;
  const stepValue = findings[step.id] ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <button onClick={onBack} className="text-emerald-600 font-medium flex items-center gap-1 mb-2">← All missions</button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{mission.emoji}</span>
          <div>
            <h1 className="font-bold text-gray-900">{mission.title}</h1>
            <p className="text-xs text-gray-400">{mission.bookSource}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {mission.steps.map((_: any, i: number) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${i < currentStep ? "bg-emerald-500" : i === currentStep ? "bg-emerald-300" : "bg-gray-200"}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Step {currentStep + 1} of {mission.steps.length}</p>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div>
          <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full mb-2">
            Step {currentStep + 1}: {step.title}
          </div>
          <p className="text-gray-800 leading-relaxed text-base">{step.instruction}</p>
        </div>
        {step.prompt && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-800">📋 Copy this prompt into Manus:</p>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-mono bg-white rounded-xl p-3 border border-amber-100">{step.prompt}</p>
            <button onClick={() => handleCopy(step.prompt!)} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors">
              {copied ? "✓ Copied!" : "📋 Copy prompt"}
            </button>
          </div>
        )}
        {step.inputLabel && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">{step.inputLabel}</label>
            <textarea
              value={stepValue}
              onChange={(e) => setFindings({ ...findings, [step.id]: e.target.value })}
              onBlur={() => {
              // Only auto-save on blur if not already saving
              if (!saveProgressMutation.isPending) {
                handleSave(findings);
              }
            }}
              rows={8}
              placeholder="Type or paste your answer here..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-emerald-400 resize-none"
            />
            <p className="text-xs text-gray-400">Your work is saved automatically.</p>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          {currentStep > 0 && (
            <button onClick={() => setCurrentStep((s) => s - 1)} className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition-colors">
              ← Previous
            </button>
          )}
          {!isLastStep ? (
            <button onClick={handleNext} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-colors">
              Next step →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!stepValue.trim() || submitMissionMutation.isPending}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-2xl transition-colors"
            >
              {submitMissionMutation.isPending ? "Submitting..." : "Submit to Dad! 🚀"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KidsResearch() {
  const [researcher, setResearcher] = useState<Researcher | null>(loadResearcher);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);

  const handleLogin = (r: Researcher) => setResearcher(r);
  const handleLogout = () => {
    clearResearcher();
    setResearcher(null);
    setSelectedMission(null);
  };

  if (!researcher) return <IdentifyScreen onLogin={handleLogin} />;
  if (selectedMission) {
    return <MissionFlow researcher={researcher} missionId={selectedMission} onBack={() => setSelectedMission(null)} />;
  }
  return <MissionSelector researcher={researcher} onSelect={setSelectedMission} onLogout={handleLogout} />;
}
