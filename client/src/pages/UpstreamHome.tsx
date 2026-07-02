import { useEffect, useRef } from "react";
import { Check, ArrowRight, ShieldCheck, Star, HelpCircle, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Custom type definitions for tracking scripts loaded in index.html
declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, any>) => void;
    fbq?: (command: string, eventName: string, params?: Record<string, any>) => void;
  }
}

export default function UpstreamHome() {
  const offerSectionRef = useRef<HTMLDivElement>(null);

  // 1. ViewContent tracking on load
  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "view_item", {
        item_list_id: "upstream_offers",
        item_list_name: "Upstream Health Program Offers",
      });
    }
    if (window.fbq) {
      window.fbq("track", "ViewContent", {
        content_name: "Upstream Offer Page",
        content_category: "Webinar Offer",
      });
    }
  }, []);

  // 2. InitiateCheckout tracking when offer section scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Trigger tracking once
            if (window.gtag) {
              window.gtag("event", "begin_checkout", {
                value: 299, // default baseline value
                currency: "USD",
              });
            }
            if (window.fbq) {
              window.fbq("track", "InitiateCheckout");
            }
            // Disconnect observer once triggered
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 } // Trigger when 25% of the offer section is visible
    );

    if (offerSectionRef.current) {
      observer.observe(offerSectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 3. Purchase event tracking on button click
  const handlePurchaseClick = (pathName: string, price: number, checkoutUrl: string) => {
    if (window.gtag) {
      window.gtag("event", "purchase", {
        transaction_id: `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        value: price,
        currency: "USD",
        items: [
          {
            item_name: pathName,
            price: price,
            quantity: 1,
          },
        ],
      });
    }
    if (window.fbq) {
      window.fbq("track", "Purchase", {
        content_name: pathName,
        value: price,
        currency: "USD",
      });
    }

    // Redirect to checkout URL
    window.location.href = checkoutUrl;
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#2c3e50] font-sans selection:bg-[#007bff]/20 selection:text-[#007bff]">
      {/* Hero Section */}
      <header 
        className="relative py-20 md:py-28 text-white overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.92)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        {/* Abstract decorative circles to enhance depth */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#007bff]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container max-w-5xl mx-auto px-4 relative z-10 text-center">
          {/* Logo / Brand Indicator */}
          <div className="mb-8 flex justify-center items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-[#007bff] font-bold bg-[#007bff]/10 px-4 py-1.5 rounded-full border border-[#007bff]/20">
              The Urban Monk · Interconnected Series
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-serif leading-tight tracking-tight max-w-4xl mx-auto mb-6">
            You Watched the Webinar. <br className="hidden md:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-[#007bff] italic">
              Now Choose Your Path Upstream.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-light">
            Three options. All built on the same functional medicine science. Pick the one that matches where you are right now.
          </p>

          <div className="mt-10 flex justify-center">
            <a 
              href="#offers" 
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors duration-200 group"
            >
              Explore the paths below
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5 group-hover:rotate-90" />
            </a>
          </div>
        </div>
      </header>

      {/* Trust Banner */}
      <section className="bg-white border-y border-slate-200 py-6">
        <div className="container max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Secure 256-Bit Encrypted Checkout</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Backed by Functional Medicine Science</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-[#007bff]" />
            <span>Instant Digital & Testing Setup</span>
          </div>
        </div>
      </section>

      {/* Offers Section */}
      <main id="offers" ref={offerSectionRef} className="py-20 md:py-28 container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif mb-4">Select Your Upstream Program Path</h2>
          <div className="w-16 h-1 bg-[#007bff] mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Path 1 (Now Left Column): The Course - $299 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden">
            <div className="h-2.5 bg-slate-200"></div>
            
            <div className="p-8 flex-grow flex flex-col">
              <div className="mb-6">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Path 01</span>
                <h3 className="text-2xl font-serif mt-1 mb-2">The Course</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The complete education blueprint to rebuild your health from the ground up.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-serif font-bold">$299</span>
                  <span className="text-slate-400 text-sm">one-time</span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="border-t border-slate-100 pt-6 mb-8 flex-grow">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4">What's Included:</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Complete Upstream Course</p>
                      <p className="text-xs text-slate-400 mt-0.5">Comprehensive modular curriculum</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">6 Interactive Workbooks</p>
                      <p className="text-xs text-slate-400 mt-0.5">Step-by-step physical & digital guides</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Dr. Jeff Bland Masterclass Modules</p>
                      <p className="text-xs text-slate-400 mt-0.5">Expert guidance from the father of functional medicine</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Full Interconnected Docu-Series</p>
                      <p className="text-xs text-slate-400 mt-0.5">Lifetime access to the complete series</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Note */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 text-xs text-slate-500 mb-6 italic">
                "Already have testing? This is your path."
              </div>

              <Button 
                onClick={() => handlePurchaseClick("Path 1 — The Course", 299, "https://theacademy.theurbanmonk.com/offers/U22Ue56J/checkout")}
                className="w-full bg-[#007bff] hover:bg-[#0069d9] text-white py-6 rounded-xl font-semibold tracking-wide shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Choose The Course Path
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Path 2 (Now Middle Column): The Test - $399 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group">
            {/* Highlight Banner */}
            <div className="bg-[#007bff] text-white text-center py-2.5 px-4 text-xs font-bold tracking-wider uppercase">
              Includes 1-Hour Private Coach Consultation
            </div>
            
            <div className="p-8 flex-grow flex flex-col">
              <div className="mb-6">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Path 02</span>
                <h3 className="text-2xl font-serif mt-1 mb-2">The Test</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Deep-dive biological insight with personalized professional coaching.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-serif font-bold">$399</span>
                  <span className="text-slate-400 text-sm">one-time</span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="border-t border-slate-100 pt-6 mb-8 flex-grow">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4">What's Included:</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-blue-50 text-[#007bff] mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">KBMO FIT22 Food Sensitivity Test & Gut Barrier Permeability Panel</p>
                      <p className="text-xs text-slate-400 mt-0.5">$399 combined value</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-blue-50 text-[#007bff] mt-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#007bff]">Private 1-Hour Health Coach Consultation</p>
                      <p className="text-xs text-slate-400 mt-0.5">$250 value</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Note */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 text-xs text-slate-500 mb-6 italic">
                "Includes a private 1-hour coach call to review your results."
              </div>

              <Button 
                onClick={() => handlePurchaseClick("Path 2 — The Test", 399, "https://theacademy.theurbanmonk.com/offers/Dbu2EDpX")}
                className="w-full bg-[#007bff] hover:bg-[#0069d9] text-white py-6 rounded-xl font-semibold tracking-wide shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Choose The Test Path
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Path 3 (Now Right Column): The Upstream Bundle (Best Value) - $499 */}
          <div className="bg-white rounded-2xl border-2 border-[#007bff] shadow-xl flex flex-col overflow-hidden relative transform lg:-translate-y-4 z-20">
            {/* Best Value Badge */}
            <div className="absolute top-4 right-4 bg-[#007bff] text-white text-[10px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full shadow-sm">
              BEST VALUE
            </div>
            
            <div className="p-8 flex-grow flex flex-col bg-gradient-to-b from-blue-50/20 to-transparent">
              <div className="mb-6">
                <span className="text-xs uppercase tracking-wider text-[#007bff] font-bold">Path 03</span>
                <h3 className="text-2xl font-serif mt-1 mb-2">The Upstream Bundle</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The complete scientific experience. Everything you need to analyze, learn, and transform.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-serif font-bold text-[#007bff]">$499</span>
                  <span className="text-slate-400 line-through text-base">$698</span>
                </div>
              </div>

              {/* Savings Box */}
              <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100/50 text-xs text-slate-700 mb-6">
                <p className="font-bold text-[#007bff] mb-1">Bundle Savings Breakdown:</p>
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>The Test Path</span>
                  <span>$399</span>
                </div>
                <div className="flex justify-between text-slate-500 mb-2 pb-2 border-b border-blue-100/50">
                  <span>The Course Path</span>
                  <span>$299</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-800">Combined Value</span>
                  <span className="line-through">$698</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 mt-1 text-sm">
                  <span>Your Bundled Price</span>
                  <span>$499 (Save $199)</span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="border-t border-slate-100 pt-6 mb-8 flex-grow">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4">Includes Everything in Paths 1 & 2:</p>
                <ul className="space-y-3.5">
                  <li className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold">Complete Food Sensitivity & Barrier Testing</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-[#007bff]">Private 1-Hour Health Coach Consultation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold">Full Upstream Course & 6 Workbooks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold">Dr. Jeff Bland Masterclass Modules</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold">Lifetime Interconnected Docu-Series Access</span>
                  </li>
                </ul>
              </div>

              <Button 
                onClick={() => handlePurchaseClick("Path 3 — The Upstream Bundle", 499, "https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout")}
                className="w-full bg-[#007bff] hover:bg-[#0069d9] text-white py-7 rounded-xl font-bold tracking-wide shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
              >
                Claim Best Value Bundle
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

        </div>
      </main>

      {/* FAQs / Simple Support Section */}
      <section className="bg-white border-t border-slate-200 py-16 md:py-24">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <HelpCircle className="w-10 h-10 text-[#007bff] mx-auto mb-3" />
            <h2 className="text-2xl md:text-3xl font-serif">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-base mb-2">How does the Food Sensitivity Test work?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                After purchasing, your KBMO FIT22 test kit will be shipped directly to your door. It requires a simple, quick finger-prick blood sample which you mail back to the lab. Your results will analyze 22 of the most common inflammatory foods and gut barrier markers.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-6">
              <h3 className="font-semibold text-base mb-2">When and how do I schedule my private health coach consultation?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                If you select Path 2 (The Test) or Path 3 (The Upstream Bundle), you will receive an email immediately after checkout with a link to schedule your private 1-hour consultation. We recommend scheduling this once your lab results are ready so your coach can walk you through your personalized report.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-6">
              <h3 className="font-semibold text-base mb-2">What if I already have recent testing results?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                If you have already completed food sensitivity or gut barrier panels, Path 1 (The Course) is perfect for you. It provides the full educational framework, workbooks, and masterclass modules to help you interpret your current state and design a targeted healing protocol.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a192f] text-slate-400 py-16 border-t border-slate-800">
        <div className="container max-w-5xl mx-auto px-4 text-center">
          <div className="mb-6 flex justify-center items-center gap-2">
            <span className="font-serif text-white text-lg tracking-wider font-bold">THE URBAN MONK</span>
          </div>
          
          <p className="text-sm mb-4">
            &copy; {new Date().getFullYear()} The Urban Monk &middot; Upstream Health Program
          </p>

          <div className="flex justify-center items-center gap-6 text-xs mb-8">
            <a href="mailto:support@theurbanmonk.com" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail className="w-3.5 h-3.5" />
              support@theurbanmonk.com
            </a>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Secure Enrollment
            </span>
          </div>

          <div className="max-w-3xl mx-auto text-[10px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-8">
            <p className="mb-3">
              <strong>Disclaimer:</strong> The statements made on this website have not been evaluated by the Food and Drug Administration. The products and programs offered are not intended to diagnose, treat, cure, or prevent any disease. The content provided is for informational and educational purposes only and should not be construed as medical advice. Please consult with a qualified healthcare practitioner before making changes to your diet, lifestyle, or supplementation regimen.
            </p>
            <p>
              The KBMO FIT22 test and Gut Barrier Permeability Panel are laboratory tests conducted by CLIA-certified facilities. Consultations with health coaches are supportive in nature and do not replace professional medical diagnosis or treatment.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
