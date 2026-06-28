/**
 * IntentIdeasPanel
 * ────────────────
 * Displays AI-generated content ideas from Reddit + YouTube intent signals.
 * Allows one-click push to the Content Pipeline.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type GeneratedIdea = {
  title: string;
  hook: string;
  contentType: "blog" | "video" | "social" | "email";
  category: string;
  sourceSignals: string[];
  platform: string;
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  blog: "bg-blue-100 text-blue-700",
  video: "bg-red-100 text-red-700",
  social: "bg-purple-100 text-purple-700",
  email: "bg-green-100 text-green-700",
};

export default function IntentIdeasPanel() {
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [ideasMeta, setIdeasMeta] = useState<{
    signalCount: number;
    message: string;
  } | null>(null);
  const [pushedIndexes, setPushedIndexes] = useState<Set<number>>(new Set());

  const generateIdeasMutation = trpc.intentIdeas.generateIntentIdeas.useMutation({
    onSuccess: (data) => {
      setIdeas(data.ideas as GeneratedIdea[]);
      setIdeasMeta({ signalCount: data.signalCount, message: data.message });
      if (data.ideas.length === 0) {
        toast.info("No signals found yet — run the Reddit or YouTube scans first.");
      } else {
        toast.success(
          `Generated ${data.ideas.length} content ideas from ${data.signalCount} intent signals`
        );
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const pushIdeaMutation = trpc.intentIdeas.pushIdeaToPipeline.useMutation({
    onError: (err) => toast.error(err.message),
  });

  function handlePush(idea: GeneratedIdea, idx: number) {
    pushIdeaMutation.mutate(
      {
        title: idea.title,
        hook: idea.hook,
        contentType: idea.contentType,
        category: idea.category,
        platform: idea.platform,
        sourceSignals: idea.sourceSignals,
      },
      {
        onSuccess: (data) => {
          setPushedIndexes((prev) => new Set(prev).add(idx));
          toast.success(`"${data.title}" added to Content Pipeline!`);
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Intent Signal → Content Ideas</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => generateIdeasMutation.mutate({ forceRefresh: true })}
            disabled={generateIdeasMutation.isPending}
            className="gap-2"
          >
            {generateIdeasMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Analyzing signals...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Ideas from Signals
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Claude analyzes the last 14 days of Reddit discussions and YouTube intent comments to
          generate specific content ideas in Pedram's voice. Click any idea to add it directly to
          the Content Pipeline.
        </p>
        {ideasMeta && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {ideasMeta.message}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Empty state */}
        {ideas.length === 0 && !generateIdeasMutation.isPending && (
          <div className="text-center py-10 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No ideas generated yet.</p>
            <p className="text-xs mt-1">
              Click "Generate Ideas from Signals" to analyze your Reddit and YouTube intent data.
            </p>
          </div>
        )}

        {/* Loading state */}
        {generateIdeasMutation.isPending && (
          <div className="text-center py-10 text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
            <p className="text-sm">Analyzing intent signals and generating ideas...</p>
            <p className="text-xs mt-1">This takes about 10–15 seconds</p>
          </div>
        )}

        {/* Ideas list */}
        {ideas.length > 0 && (
          <div className="grid gap-3">
            {ideas.map((idea, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                  pushedIndexes.has(idx)
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        CONTENT_TYPE_COLORS[idea.contentType] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {idea.contentType.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {idea.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      → {idea.platform}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="font-semibold text-sm leading-snug">{idea.title}</p>

                  {/* Hook */}
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    "{idea.hook}"
                  </p>

                  {/* Source signals */}
                  {idea.sourceSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {idea.sourceSignals.map((sig, si) => (
                        <span
                          key={si}
                          className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {pushedIndexes.has(idx) ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Added
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      disabled={pushIdeaMutation.isPending}
                      onClick={() => handlePush(idea, idx)}
                    >
                      <PlusCircle className="w-3 h-3" />
                      Add to Pipeline
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Link to pipeline */}
            <div className="pt-2 flex justify-end">
              <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                <a href="/">
                  <ArrowRight className="w-3 h-3" />
                  View Content Pipeline
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
