import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Activity, Heart, Award } from "lucide-react";

export default function UpstreamOral() {
  // Tracking pixel and GA4 events on page load
  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);

    // Track ViewContent event
    if (typeof window.gtag === "function") {
      window.gtag("event", "view_item", {
        event_category: "Engagement",
        event_label: "Natalie Jill Oral Microbiome Landing Page",
        items: [{
          item_name: "Orobiome Oral Microbiome Test Kit",
          price: 399.00,
          currency: "USD"
        }]
      });
    }
    if (typeof window.fbq === "function") {
      window.fbq("track", "ViewContent", {
        content_name: "Orobiome Oral Microbiome Test Kit",
        content_category: "Testing",
        value: 399.00,
        currency: "USD"
      });
    }

    // Scroll listener for InitiateCheckout tracking
    let triggered = false;
    const handleScroll = () => {
      const element = document.getElementById("offer-section");
      if (element && !triggered) {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
          triggered = true;
          if (typeof window.gtag === "function") {
            window.gtag("event", "begin_checkout", {
              event_category: "E-commerce",
              event_label: "Oral Offer Scrolled Into View"
            });
          }
          if (typeof window.fbq === "function") {
            window.fbq("track", "InitiateCheckout", {
              content_name: "Orobiome Oral Microbiome Test Kit",
              value: 399.00,
              currency: "USD"
            });
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track Purchase event on click
  const handlePurchaseClick = () => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "purchase", {
        transaction_id: "natalie_jill_oral_" + Date.now(),
        value: 399.00,
        currency: "USD",
        items: [{
          item_name: "Orobiome Oral Microbiome Test Kit",
          price: 399.00,
          currency: "USD"
        }]
      });
    }
    if (typeof window.fbq === "function") {
      window.fbq("track", "Purchase", {
        value: 399.00,
        currency: "USD",
        content_name: "Orobiome Oral Microbiome Test Kit"
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500 selection:text-white">
      {/* Top Affiliate Header Bar */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white text-center py-2 px-4 text-sm font-medium tracking-wide">
        <span className="opacity-90">Special Welcome to the </span>
        <strong className="font-semibold">Midlife Conversations with Natalie Jill</strong>
        <span className="opacity-90"> Community</span>
      </div>

      {/* Hero Section */}
      <header className="relative py-20 lg:py-28 overflow-hidden border-b border-slate-800">
        {/* Background Image with Dark Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 scale-105 pointer-events-none"
          style={{ 
            backgroundImage: "url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')",
            filter: "hue-rotate(310deg) saturate(1.2)" // Infuse pink/magenta tones to match Natalie Jill's palette
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="container relative z-10 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-sm font-semibold tracking-wide uppercase mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4 text-pink-400" />
            As Featured on Midlife Conversations
          </div>

          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white tracking-tight leading-[1.1] mb-6">
            You Have No Idea What's Going On In Your Health If You Can't <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 font-bold">Test Your Mouth.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10">
            You can't heal a nervous system, balance your hormones, or fix a stubborn gut that's being constantly poisoned from upstream. Stop guessing. Get your case reviewed by our licensed dentists today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              asChild
              onClick={handlePurchaseClick}
              className="w-full sm:w-auto bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-base font-semibold px-8 py-6 rounded-xl shadow-lg shadow-pink-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <a href="https://shop.theurbanmonk.com/products/orobiome-testing-package?bg_ref=109Nl4h0Ds">
                Get Your Oral Biome Test — $399 <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <a 
              href="#why-it-matters" 
              className="text-slate-400 hover:text-white font-medium text-sm transition-colors py-2"
            >
              Learn Why Your Mouth Is the Key ↓
            </a>
          </div>

          {/* Bullet Benefits Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-8 border-t border-slate-800/60 max-w-4xl mx-auto text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-semibold text-sm">Simple At-Home Spit Test</h4>
                <p className="text-xs text-slate-400">Takes 2 minutes, free return shipping</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-semibold text-sm">Licensed Dentist Review</h4>
                <p className="text-xs text-slate-400">Every single report analyzed by doctors</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-semibold text-sm">Hygienist Presentation</h4>
                <p className="text-xs text-slate-400">Live 1-on-1 results walk-through</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-semibold text-sm">Systemic Connection</h4>
                <p className="text-xs text-slate-400">Addresses heart, brain & gut link</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* The Problem Section */}
      <section id="why-it-matters" className="py-20 bg-slate-900/40">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-4">
              Why Meditation, Clean Eating & Supplements Aren't Enough
            </h2>
            <div className="w-12 h-1 bg-pink-500 mx-auto rounded-full mb-6" />
            <p className="text-slate-300 max-w-2xl mx-auto">
              Have you ever done everything "right" — managed your stress, optimized your sleep, taken all the right supplements — and still felt like something was off? 
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-6">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">The "Upstream" Poison Problem</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Your digestive system is one continuous pipe from lips to colon. Every day, you swallow 1 to 2 liters of saliva loaded with whatever is breeding in your mouth. If you have harmful bacteria around your gums, old dental work, or root canals, you are constantly seeding your gut with pathogens. You cannot heal your gut if your mouth is continuously poisoning it.
              </p>
            </div>

            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Silent Endotoxemia</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                When toxic bacteria leak from your gums into your bloodstream, your immune system launches a constant inflammatory response. This chronic state of alert is called endotoxemia. It spikes your cortisol, wrecks your sleep, causes brain fog, and creates hormonal chaos — especially during midlife when estrogen drops and leaves your microbiome even more vulnerable.
              </p>
            </div>
          </div>

          <div className="bg-pink-950/20 border border-pink-500/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Heart className="w-8 h-8 text-pink-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">The Heart-Brain-Hormone Connection</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                Medical research has conclusively proven that specific oral pathogens (like those in the infamous <strong>"Red Complex"</strong>) are directly linked to cardiovascular plaque, arterial inflammation, cognitive decline, and metabolic resistance. If you are not testing your oral biome, you are missing the literal gateway to your systemic health.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dentist & Hygienist Feature Section */}
      <section className="py-20 bg-slate-950 border-t border-slate-900">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6">
                <Award className="w-6 h-6 text-pink-400" />
              </div>
              <h2 className="font-serif text-3xl text-white mb-6">
                Clinical Excellence: Dentists & Hygienists on Your Side
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                This is not just another automated lab report that gets emailed to you with zero context. We believe in clinical-grade, personalized guidance.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Every single saliva sample is processed through our advanced DNA sequencing lab and then <strong>hand-reviewed by our team of licensed biological dentists</strong>. They analyze your specific bacterial complexes, identify hidden root causes, and build your custom clinical roadmap.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/60">
                <h3 className="text-lg font-semibold text-pink-400 mb-2">Step 1: Licensed Dentist Review</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Our doctors examine your DNA report to cross-reference bacterial strains with potential systemic risks, past dental work, and overall health markers.
                </p>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/60">
                <h3 className="text-lg font-semibold text-pink-400 mb-2">Step 2: Hygienist Consultation</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  A certified dental hygienist meets with you 1-on-1 to present the dentist's findings, walk you through the data, and deliver your step-by-step oral-gut protocol.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Orobiome Solution Section */}
      <section className="py-20 border-t border-slate-900">
        <div className="container max-w-5xl">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="text-pink-400 font-semibold text-sm tracking-wider uppercase">The Solution</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white mt-2 mb-6">
                The Orobiome Oral Microbiome Testing Package
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Developed by Dr. Pedram Shojai's functional medicine team, this comprehensive diagnostic kit reveals the exact bacterial landscape inside your mouth so you can target the root cause of chronic inflammation.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <p className="text-slate-300 text-sm">
                    <strong>Licensed Dentist Case Review:</strong> Rest easy knowing your lab results are evaluated by clinical dental professionals, not algorithms.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <p className="text-slate-300 text-sm">
                    <strong>Hygienist Results Presentation:</strong> Meet 1-on-1 for a live, easy-to-understand breakdown of your oral microbiome and custom recommendations.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <p className="text-slate-300 text-sm">
                    <strong>The Systemic Roadmap:</strong> If needed, easily transition into our full "Explore Tier" (including GI Map & KBMO testing) for a complete oral-gut-systemic solution.
                  </p>
                </div>
              </div>
            </div>

            {/* Product Image / Package Box */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl tracking-wider uppercase">
                  Best Value
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Orobiome Test Package</h3>
                <p className="text-slate-400 text-xs mb-6">Complete Oral Systemic Assessment</p>

                <div className="space-y-4 border-b border-slate-800 pb-6 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Orobiome Test Kit</span>
                    <span className="text-slate-400 line-through">$350.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Licensed Dentist Review</span>
                    <span className="text-slate-400 line-through">$200.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Hygienist Presentation Call</span>
                    <span className="text-slate-400 line-through">$150.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-pink-400">
                    <span>Midlife Conversations Discount</span>
                    <span>-$301.00</span>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Your Special Price</div>
                  <div className="text-4xl font-bold text-white">$399.00</div>
                  <div className="text-emerald-400 text-xs font-semibold mt-1">You Save $301.00 (Over 40% Off)</div>
                </div>

                <Button 
                  asChild
                  onClick={handlePurchaseClick}
                  className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold py-6 rounded-xl shadow-lg transition-all duration-200"
                >
                  <a href="https://shop.theurbanmonk.com/products/orobiome-testing-package?bg_ref=109Nl4h0Ds">
                    Claim This Offer Now
                  </a>
                </Button>

                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-pink-400" />
                  Secure 256-Bit Encrypted Checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-slate-900/20 border-t border-slate-900">
        <div className="container max-w-4xl text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold text-lg mb-6 border border-pink-500/20">
                1
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Spit & Send</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Order your kit. It arrives at your door with everything you need. Provide a quick 2-minute saliva sample, pop it in the pre-paid box, and send it back to our lab.
              </p>
            </div>

            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold text-lg mb-6 border border-pink-500/20">
                2
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Licensed Dentist Review</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Our lab sequences your oral microbiome's DNA, and a licensed biological dentist personally reviews your results to analyze complexes, systemic markers, and custom risks.
              </p>
            </div>

            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold text-lg mb-6 border border-pink-500/20">
                3
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Hygienist Presentation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                A certified dental hygienist meets with you 1-on-1 to present the dentist's clinical findings, answer your questions, and deliver your personalized health roadmap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Offer Section for Anchor */}
      <section id="offer-section" className="py-20 bg-gradient-to-b from-slate-950 to-slate-900 border-t border-slate-900">
        <div className="container max-w-3xl text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-4">Stop Guessing About Your Health</h2>
          <p className="text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed">
            Take the first step to true, root-cause health. Join Natalie Jill and Dr. Pedram Shojai in looking upstream to find and fix what's holding you back.
          </p>

          <div className="bg-slate-950 border border-pink-500/20 rounded-3xl p-8 md:p-12 shadow-2xl shadow-pink-500/5">
            <span className="text-xs font-bold tracking-widest text-pink-400 uppercase bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-full">
              Limited-Time Affiliate Pricing
            </span>
            <h3 className="font-serif text-2xl md:text-3xl text-white mt-6 mb-2">Orobiome Testing & Specialist Review</h3>
            <p className="text-slate-400 text-sm mb-8">Includes At-Home Kit, DNA Sequencing Report, Dentist Case Review, and Hygienist Consult</p>

            <div className="flex items-baseline justify-center gap-3 mb-8">
              <span className="text-slate-500 line-through text-2xl">$700</span>
              <span className="text-5xl font-extrabold text-white">$399</span>
              <span className="text-pink-400 font-semibold text-sm">USD</span>
            </div>

            <Button 
              asChild
              onClick={handlePurchaseClick}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-lg font-semibold py-7 rounded-xl shadow-xl transition-all duration-200"
            >
              <a href="https://shop.theurbanmonk.com/products/orobiome-testing-package?bg_ref=109Nl4h0Ds">
                Order Your Kit Now
              </a>
            </Button>

            <p className="text-xs text-slate-500 mt-6 leading-relaxed">
              Shipping is free within the United States. Your data is protected by strict HIPAA privacy standards.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 text-slate-500 text-xs">
        <div className="container max-w-4xl text-center">
          <p className="font-semibold text-slate-400 mb-2">© The Urban Monk · Upstream Health Program</p>
          <p className="mb-6">In partnership with Natalie Jill Fitness & Midlife Conversations</p>
          
          <div className="flex justify-center gap-4 mb-8 text-slate-400">
            <a href="mailto:support@theurbanmonk.com" className="hover:text-pink-400 transition-colors">support@theurbanmonk.com</a>
            <span>•</span>
            <a href="https://shop.theurbanmonk.com/policies/privacy-policy" className="hover:text-pink-400 transition-colors" target="_blank" rel="noreferrer">Privacy Policy</a>
            <span>•</span>
            <a href="https://shop.theurbanmonk.com/policies/terms-of-service" className="hover:text-pink-400 transition-colors" target="_blank" rel="noreferrer">Terms of Service</a>
          </div>

          <p className="leading-relaxed max-w-3xl mx-auto border-t border-slate-900 pt-6">
            <strong>Disclaimer:</strong> The information on this site is for educational purposes only and should not be construed as medical advice. Readers are advised to consult a qualified health professional about any issue regarding their health and well-being. The Orobiome test is designed to provide lifestyle and dietary recommendations to support oral microbiome balance and does not diagnose, treat, cure, or prevent any disease.
          </p>
        </div>
      </footer>
    </div>
  );
}
