import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Plus,
  Trash2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Suggested prompts for the empty state ───────────────────────────────────
const SUGGESTED_PROMPTS = [
  "What is the Urban Monk's approach to managing stress and cortisol?",
  "How do I build a morning routine that actually sticks?",
  "What does Pedram say about gut health and energy?",
  "How can I reclaim my time and attention in a distracted world?",
  "What is the concept of 'life energy' and how do I cultivate it?",
  "What are the most important sleep practices from your books?",
];

export default function AskUrbanMonk() {
  const [, setLocation] = useLocation();

  // Active session state
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // tRPC queries
  const sessionsQuery = trpc.bookLibrary.listChatSessions.useQuery();
  const messagesQuery = trpc.bookLibrary.getChatMessages.useQuery(
    { sessionId: activeSessionId! },
    { enabled: activeSessionId !== null }
  );

  // When a session is loaded from DB, populate the messages state
  // We use a ref to track which session we've already loaded to avoid infinite loops
  const lastLoadedRef = useState<number | null>(null);
  if (
    messagesQuery.data &&
    messagesQuery.data.session.id === activeSessionId &&
    lastLoadedRef[0] !== activeSessionId
  ) {
    lastLoadedRef[1](activeSessionId);
    const loaded: Message[] = messagesQuery.data.messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );
    setMessages(loaded);
  }

  // Ask mutation
  const askMutation = trpc.bookLibrary.askUrbanMonk.useMutation({
    onSuccess: (data) => {
      // Append the assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
      // If this was a new session, update the active session ID
      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
      }
      // Refresh the sessions list
      sessionsQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Failed to get a response: ${err.message}`);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = trpc.bookLibrary.deleteChatSession.useMutation({
    onSuccess: () => {
      toast.success("Conversation deleted");
      sessionsQuery.refetch();
      if (activeSessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    onError: () => {
      toast.error("Failed to delete conversation");
    },
  });

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    // Optimistically add the user message to the UI
    setMessages((prev) => [...prev, { role: "user", content }]);

    // Build conversation history for context (exclude the message we just added)
    const history = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    askMutation.mutate({
      question: content,
      sessionId: activeSessionId ?? undefined,
      conversationHistory: history,
    });
  };

  // Start a new conversation
  const handleNewConversation = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  // Load an existing session
  const handleLoadSession = (sessionId: number) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setMessages([]); // will be populated by messagesQuery onSuccess
  };

  const sessions = sessionsQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── Sidebar: conversation history ── */}
        <div
          className={`flex flex-col border-r bg-card transition-all duration-200 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          }`}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Conversations</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewConversation}
                  className="h-8 px-2 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>

              {/* Session list */}
              <ScrollArea className="flex-1">
                <div className="p-2 flex flex-col gap-1">
                  {sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8 px-4">
                      Your conversations will appear here.
                    </p>
                  )}
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
                        activeSessionId === session.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleLoadSession(session.id)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-xs truncate">
                        {session.title}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSessionMutation.mutate({ sessionId: session.id });
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Book count badge */}
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Grounded in Pedram's books</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar toggle ── */}
        <button
          className="flex items-center justify-center w-5 bg-card border-r hover:bg-accent/50 transition-colors z-10"
          onClick={() => setSidebarOpen((prev) => !prev)}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* ── Main chat area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-serif font-bold text-base">UM</span>
              </div>
              <div>
                <h1 className="font-semibold text-base leading-tight">
                  Ask the Urban Monk
                </h1>
                <p className="text-xs text-muted-foreground">
                  Wisdom from Dr. Pedram Shojai's books
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <BookOpen className="h-3 w-3" />
                RAG-powered
              </Badge>
              {activeSessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewConversation}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Chat
                </Button>
              )}
            </div>
          </div>

          {/* Chat box */}
          <div className="flex-1 overflow-hidden p-4">
            <AIChatBox
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={askMutation.isPending || messagesQuery.isLoading}
              placeholder="Ask Dr. Pedram Shojai anything..."
              height="100%"
              emptyStateMessage="Ask Dr. Pedram Shojai anything — stress, energy, gut health, morning routines, life purpose..."
              suggestedPrompts={SUGGESTED_PROMPTS}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
