import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, BookOpen, Brain, Zap, Moon } from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Success! Check your inbox for the download link.");
      setEmail("");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary flex flex-col font-sans">
      {/* Header */}
      <header className="w-full py-6 px-6 md:px-12 flex justify-between items-center border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="text-primary font-serif font-bold text-lg">UM</span>
          </div>
          <span className="font-serif font-semibold tracking-wide text-lg text-white/90">The Urban Monk</span>
        </div>
        <div className="text-sm text-white/60 hidden md:block">
          Dr. Pedram Shojai, OMD
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
          {/* Background glow effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none opacity-50"></div>
          
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              
              {/* Left Column: Copy & Form */}
              <div className="flex flex-col space-y-8 z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 w-fit">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Free Executive Guide</span>
                </div>
                
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-[1.1] text-white">
                    The 3 Tests That Reveal the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">True Cause</span> of Executive Burnout
                  </h1>
                  <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-xl font-light">
                    What your doctor never ordered — and why it's costing you your edge. Stop managing symptoms and fix the underlying physiological hardware.
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-sm shadow-2xl shadow-black/50">
                  <h3 className="text-lg font-medium text-white mb-4">Where should we send your free guide?</h3>
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      type="email" 
                      placeholder="Enter your best email..." 
                      className="h-12 bg-black/50 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button 
                      type="submit" 
                      className="h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold tracking-wide transition-all"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Sending..." : "Get Instant Access"}
                      {!isSubmitting && <ArrowRight className="ml-2 w-4 h-4" />}
                    </Button>
                  </form>
                  <p className="text-xs text-white/40 mt-4 text-center sm:text-left">
                    100% secure. We never share your email.
                  </p>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-white/10 flex items-center justify-center overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" className="w-full h-full object-cover opacity-80 grayscale" />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-white/60">
                    Join <span className="text-white font-medium">10,000+</span> executives optimizing their performance.
                  </div>
                </div>
              </div>

              {/* Right Column: Book Cover */}
              <div className="relative flex justify-center lg:justify-end z-10 perspective-1000">
                <div className="relative w-full max-w-[400px] transform transition-transform duration-700 hover:scale-105 hover:-rotate-y-5">
                  {/* Glow behind book */}
                  <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full"></div>
                  
                  <img 
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/lights_on_ebook_cover_25a74861.jpg" 
                    alt="Lights On: The Executive Performance Protocol" 
                    className="relative z-10 w-full h-auto rounded-r-xl rounded-l-sm shadow-2xl shadow-black/80 border-l-4 border-white/10"
                    style={{
                      boxShadow: '-20px 20px 40px rgba(0,0,0,0.8), inset 2px 0 5px rgba(255,255,255,0.2)'
                    }}
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* What You'll Learn Section */}
        <section className="py-20 bg-black/40 border-y border-white/5">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">Inside The Protocol</h2>
              <p className="text-white/60 max-w-2xl mx-auto">Discover the biological levers that dictate your cognitive endurance, decision-making capacity, and stress resilience.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-serif font-semibold text-white mb-3">The Brain Fog Illusion</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Why your inability to focus isn't a character flaw, but a symptom of neuroinflammation starting in your gut.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <Moon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-serif font-semibold text-white mb-3">The 3 AM Wake-Up</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  The hidden metabolic and detoxification bottlenecks that are spiking your cortisol and destroying your sleep architecture.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-serif font-semibold text-white mb-3">The 3 Missing Tests</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  The specific functional medicine panels your primary care doctor isn't running that reveal the true state of your biological hardware.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Author Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="container max-w-4xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 rounded-full overflow-hidden border-4 border-white/10 relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent mix-blend-overlay z-10"></div>
                <img 
                  src="https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=800&auto=format&fit=crop" 
                  alt="Dr. Pedram Shojai" 
                  className="w-full h-full object-cover grayscale contrast-125"
                />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-3xl font-serif font-bold text-white mb-2">Dr. Pedram Shojai, OMD</h2>
                <p className="text-primary font-medium mb-6 tracking-wide">NYT Bestselling Author & Functional Medicine Authority</p>
                <p className="text-white/70 leading-relaxed mb-6">
                  Former Taoist monk turned Doctor of Oriental Medicine, Dr. Shojai helps high-performing executives and entrepreneurs optimize their health and performance through the integration of ancient wisdom and cutting-edge science.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>NYT Bestseller</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Taoist Abbot</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>OMD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 text-center text-white/40 text-sm">
        <div className="container">
          <p>© {new Date().getFullYear()} The Urban Monk Productions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
