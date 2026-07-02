import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles, UserCheck, HeartHandshake, ClipboardList, RefreshCw, Star, Play, Users, FileText, Pill, Apple, ShieldAlert, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

export default function UpstreamProgram() {
  const offerSectionRef = useRef<HTMLDivElement>(null);
  const hasTriggeredInitiateCheckout = useRef(false);

  useEffect(() => {
    // 1. GA4 & Meta Pixel ViewContent on load
    if (typeof window !== "undefined") {
      // GA4 ViewContent
      window.gtag?.("event", "view_item", {
        currency: "USD",
        value: 399.00,
        items: [{
          item_id: "upstream-diagnostic-intake",
          item_name: "Upstream Diagnostic Intake & Screening Package",
          price: 399.00,
          quantity: 1
        }]
      });

      // Meta Pixel ViewContent
      window.fbq?.("track", "ViewContent", {
        content_name: "Upstream Gut Restoration Program Intake",
        content_category: "Functional Medicine Programs",
        value: 399.00,
        currency: "USD"
      });
    }

    // 2. Intersection Observer for InitiateCheckout
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggeredInitiateCheckout.current) {
            hasTriggeredInitiateCheckout.current = true;
            if (typeof window !== "undefined") {
              // GA4 InitiateCheckout
              window.gtag?.("event", "begin_checkout", {
                currency: "USD",
                value: 399.00,
                items: [{
                  item_id: "upstream-diagnostic-intake",
                  item_name: "Upstream Diagnostic Intake & Screening Package",
                  price: 399.00,
                  quantity: 1
                }]
              });

              // Meta Pixel InitiateCheckout
              window.fbq?.("track", "InitiateCheckout", {
                content_name: "Upstream Gut Restoration Program Intake",
                value: 399.00,
                currency: "USD"
              });
            }
          }
        });
      },
      { threshold: 0.15 }
    );

    if (offerSectionRef.current) {
      observer.observe(offerSectionRef.current);
    }

    return () => {
      if (offerSectionRef.current) {
        observer.unobserve(offerSectionRef.current);
      }
    };
  }, []);

  const handlePurchaseClick = () => {
    if (typeof window !== "undefined") {
      // GA4 Purchase Event
      window.gtag?.("event", "purchase", {
        transaction_id: `T_${Date.now()}`,
        value: 399.00,
        currency: "USD",
        items: [{
          item_id: "upstream-diagnostic-intake",
          item_name: "Upstream Diagnostic Intake & Screening Package",
          price: 399.00,
          quantity: 1
        }]
      });

      // Meta Pixel Purchase Event
      window.fbq?.("track", "Purchase", {
        value: 399.00,
        currency: "USD",
        content_name: "Upstream Diagnostic Intake & Screening Package"
      });
    }
    // Redirect to the checkout offer
    window.location.href = "https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Hero Section */}
      <header className="relative py-24 md:py-32 overflow-hidden border-b border-slate-900">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950 to-slate-950" />
        
        <div className="container relative z-10 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/50 border border-blue-900/50 text-blue-400 text-sm md:text-base font-semibold mb-8 tracking-wide">
            <Sparkles className="w-4 h-4" /> THE URBAN MONK · CLINICAL ECOSYSTEM
          </div>
          
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight mb-8">
            You Don't Need Another Doctor.<br />
            <span className="text-blue-400 font-medium">You Need an Integrated System.</span>
          </h1>
          
          <p className="text-slate-300 text-lg sm:text-xl md:text-2xl leading-relaxed max-w-3xl mx-auto mb-10">
            If you are tired of being handed pills that mask symptoms while your health slowly slips away, welcome home. We spent two years building a fully integrated functional medicine system that unites advanced diagnostics, custom supplement formulations, and personalized nutrition to target the true root cause of chronic inflammation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={() => offerSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-lg md:text-xl font-bold py-6 px-10 rounded-xl transition-all duration-300 shadow-lg shadow-blue-950/50 active:scale-98"
            >
              Apply for Diagnostic Screening <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Trust & Credentials Banner */}
      <section className="bg-slate-900/60 py-6 border-b border-slate-900">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-slate-300 text-base md:text-lg font-medium">
            <div className="flex items-center justify-center gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
              <span>Coordinated Board of Functional Pioneers</span>
            </div>
            <div className="flex items-center justify-center gap-3 border-y md:border-y-0 md:border-x border-slate-800 py-4 md:py-0">
              <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" />
              <span>Personalized Supplement & Meal Architecture</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <UserCheck className="w-6 h-6 text-blue-400 shrink-0" />
              <span>Guaranteed Actionable Answers & Solutions</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Pain Points Section (Optimized for Older Eyes) */}
      <section className="py-24 bg-slate-950">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">The Exhausting Cycle Stops Here</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              Are You At Your Wits' End?
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              If you feel like you've tried everything and your health is still slipping away, it is because you are caught in a broken system. You cannot go on living this way.
            </p>
          </div>

          <div className="space-y-8">
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all">
              <h3 className="font-serif text-2xl text-white mb-3 flex items-center gap-3">
                <span className="text-blue-500 font-bold">01.</span> Dismissed & Unheard by Your Doctor
              </h3>
              <p className="text-slate-300 text-lg md:text-xl leading-relaxed">
                You sit across from a conventional doctor who spends less than five minutes with you, runs basic labs, and tells you "everything is normal." They suggest it's just "normal aging" or hand you an antidepressant. You leave feeling invisible, dismissed, and completely gaslit by the medical system while your vitality continues to slip away.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all">
              <h3 className="font-serif text-2xl text-white mb-3 flex items-center gap-3">
                <span className="text-blue-500 font-bold">02.</span> Drowned in a Naturopath's "Supplement Graveyard"
              </h3>
              <p className="text-slate-300 text-lg md:text-xl leading-relaxed">
                So you turned to alternative care—only to be put on a restrictive, exhausting diet and handed a shopping list of 30+ different bottles. You've spent thousands of dollars out-of-pocket on random supplements that didn't work. Your kitchen counter is a graveyard of half-empty bottles, and you are still suffering.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all">
              <h3 className="font-serif text-2xl text-white mb-3 flex items-center gap-3">
                <span className="text-blue-500 font-bold">03.</span> The Bone-Weary 2:00 AM Sleep Disruption
              </h3>
              <p className="text-slate-300 text-lg md:text-xl leading-relaxed">
                You fall asleep exhausted, only to wake up wide awake between 2:00 AM and 4:00 AM, staring at the ceiling. Your mind is racing, your body is hot, and your joints ache. This is a classic sign of liver toxicity, gut endotoxemia, and a misfiring nervous system—chronic issues that sleep aids and standard medicines can never fix.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all">
              <h3 className="font-serif text-2xl text-white mb-3 flex items-center gap-3">
                <span className="text-blue-500 font-bold">04.</span> Watching Your Life Slip Away
              </h3>
              <p className="text-slate-300 text-lg md:text-xl leading-relaxed">
                The bloating, joint stiffness, and chronic fatigue are shrinking your world. You find yourself turning down dinner invitations, avoiding travel, and withdrawing from the people you love because you don't know how your gut will react. You are at your wits' end, but you refuse to accept this as your new normal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Core Concept: Integrated Functional System */}
      <section className="py-24 bg-slate-900/30 border-y border-slate-900">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">A Radical Departure From Standard Care</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              Our Fully Integrated Functional Medicine System
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              Medical doctors failed you because they were trained to manage symptoms with pharmaceutical blockers. We spent two years designing a novel, collaborative system where elite practitioners work together to reconstruct your health.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-900 text-center">
              <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-900/50">
                <ClipboardList className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-serif text-xl text-white mb-4">1. Advanced Diagnostic Screening</h3>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed">
                We begin with precise, clinical-grade testing to screen food sensitivities and gut barrier permeability. No guessing, just objective biological data to see exactly where your immune system is triggered.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-900 text-center">
              <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-900/50">
                <Pill className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-serif text-xl text-white mb-4">2. Custom Blister-Pack Supplements</h3>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed">
                No more guessing which pills to buy or taking 20 random bottles. Our medical team custom-formulates and packages your supplements into convenient AM, PM, and evening blister packs, delivered to your door month-over-month.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-900 text-center">
              <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-900/50">
                <Apple className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-serif text-xl text-white mb-4">3. Individualized Meal Architecture</h3>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed">
                Our nutritionists construct highly personalized meal plans designed to calm gut-immune inflammation. We map your nutrition specifically to your food sensitivity and microbiome profile so your body can finally heal.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h3 className="font-serif text-2xl md:text-3xl text-white mb-6">Two Years of Clinical Refinement</h3>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
                We spent the last two years completely redesigning the patient experience. We realized that to solve chronic, complex gut issues, you cannot just hand someone a test kit and wish them luck. 
              </p>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
                You need a highly coordinated, fully integrated functional medicine system that looks at the entire picture—mapping your food triggers, screening the gut barrier, and rebalancing your nervous system.
              </p>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-8">
                This is why, for every individual inside our 6- and 12-month programs, we perform a <strong>deep, comprehensive DNA analysis of both your oral and gut microbiomes</strong>. By mapping your entire systemic microbiome axis, our medical board can pinpoint and target the exact microbial imbalances driving your chronic inflammation.
              </p>
              <div className="inline-flex items-center gap-3 text-blue-400 font-bold text-base">
                <Sparkles className="w-5 h-5" /> This is how we get the life-changing results we do.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80" 
                alt="Functional Medicine Practitioner Team" 
                className="w-full h-[400px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 p-6 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur">
                <p className="text-white font-serif text-lg italic mb-2">"We don't manage symptoms. We orchestrate systemic healing."</p>
                <p className="text-slate-400 text-sm font-semibold">— Dr. Pedram Shojai & The Upstream Clinical Board</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Stepped Pathway: Diagnostic Screening to Program */}
      <section className="py-24 bg-slate-950">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">The Upstream Pathway</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              How We Work Together
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              We do not believe in massive upfront commitments for untested programs. We begin with an affordable, high-value diagnostic screening to find answers first.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mb-16">
            {/* Step 1 Card */}
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 border border-blue-900 text-blue-400 text-xs font-bold mb-6">
                  STEP 01 — GUARANTEED ANSWERS
                </div>
                <h3 className="font-serif text-2xl md:text-3xl text-white mb-4">Diagnostic Intake & Screening</h3>
                <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
                  The first affordable step to screen your food sensitivities and gut barrier health. This diagnostic package includes the **KBMO FIT 22 & Gut Barrier Permeability Panel** shipped directly to your door, plus a private 1-hour consultation with a clinical health coach to review your results.
                </p>
                <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-900/40 mb-6">
                  <p className="text-blue-400 font-semibold text-base mb-1">Our Guaranteed Value Promise:</p>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Whether you qualify for our 6- or 12-month programs or not, <strong>everyone walks away with actionable data and a solution</strong>. Your coach will deliver a personalized Upstream Action Plan detailing your exact food sensitivity triggers and gut barrier status, giving you clear direction to start healing.
                  </p>
                </div>
                <ul className="space-y-3 text-slate-300 text-base md:text-lg mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                    <span>Screens 22 primary inflammatory food triggers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                    <span>Measures Zonulin/Occludin for leaky gut</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                    <span>1-Hour Private Coach consultation included</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                    <span><strong>Guaranteed Solution:</strong> Everyone walks away with custom, actionable advice</span>
                  </li>
                </ul>
              </div>
              <div className="border-t border-slate-800 pt-6">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-slate-400 font-semibold text-sm uppercase">Screening Investment</span>
                  <span className="text-3xl font-serif text-white">$399</span>
                </div>
                <Button 
                  onClick={() => offerSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Get Your Diagnostic Kit
                </Button>
              </div>
            </div>

            {/* Step 2 Card */}
            <div className="p-8 rounded-2xl bg-slate-900/20 border border-slate-900/50 flex flex-col justify-between opacity-90">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold mb-6">
                  STEP 02 — IF YOU QUALIFY
                </div>
                <h3 className="font-serif text-2xl md:text-3xl text-slate-300 mb-4">6- or 12-Month Restoration</h3>
                <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
                  If your screening reveals deep systemic issues and you qualify for our programs, we will invite you to join our 6- or 12-month integrated restoration programs. Under the collaborative care of our medical board, we will execute a complete rebuild of your oral-gut axis.
                </p>
                <ul className="space-y-3 text-slate-300 text-base md:text-lg mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-1" />
                    <span>Coordinated care by MDs and biological dentists</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-1" />
                    <span>Deep oral and gut DNA sequencing (Orobiome & GI Map)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-1" />
                    <span>Custom supplement blister packs (AM/PM) delivered monthly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-1" />
                    <span>Dedicated 1-on-1 coaching + multiple weekly clinical calls</span>
                  </li>
                </ul>
              </div>
              <div className="border-t border-slate-900 pt-6">
                <p className="text-slate-400 text-sm italic">
                  *Program details, customized durations, and custom supplement configurations will be presented to you during your Step 1 consultation if you qualify.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Core Program Details: 6-Month vs 12-Month */}
      <section className="py-24 bg-slate-900/30 border-y border-slate-900">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">The Restorative Programs</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              Our Long-Term Restoration Programs
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              Both of our programs are identical in terms of medical board supervision, personalized supplement engineering, and custom meal planning. They differ only in duration and coaching intensity to match your clinical needs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 6-Month Program Card */}
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-2xl md:text-3xl text-white mb-2">The 6-Month Rebuild</h3>
                <p className="text-blue-400 text-base font-semibold mb-6">Designed for moderate, localized gut barrier dysfunction</p>
                
                <div className="space-y-6 text-slate-300 text-base md:text-lg mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <ShieldAlert className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Prescriptive Authority</h4>
                      <p className="text-slate-400 text-sm">Ability to script pharmaceuticals (antibiotics, etc.) if necessary, coordinating with your primary physician.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">World-Class Peptides</h4>
                      <p className="text-slate-400 text-sm">Access to cutting-edge, clinically indicated peptides for accelerated gut & systemic repair, if applicable.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Coaching Architecture</h4>
                      <p className="text-slate-400 text-sm">3 Months of 1-on-1 Personal Coaching + 6 Months of Group Coaching</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Pill className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Custom Supplement Box</h4>
                      <p className="text-slate-400 text-sm">Custom AM, PM, and evening blister packs designed month-over-month by our medical board</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Apple className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Individualized Meal Planning</h4>
                      <p className="text-slate-400 text-sm">Custom meal architectures mapping directly to your food sensitivities and metabolic profile</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Continuous Access & Support</h4>
                      <p className="text-slate-400 text-sm">Multiple live Q&A calls a week with our clinical team + dedicated learning tools</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-900 pt-6">
                <p className="text-slate-400 text-sm italic">
                  *Identical clinical oversight. Designed for individuals looking to re-establish a healthy baseline and clear moderate inflammatory triggers.
                </p>
              </div>
            </div>

            {/* 12-Month Program Card */}
            <div className="p-8 rounded-2xl bg-slate-950 border-2 border-blue-600/50 flex flex-col justify-between relative">
              <div className="absolute -top-4 right-6 px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                MAXIMUM TRANSFORMATION
              </div>
              <div>
                <h3 className="font-serif text-2xl md:text-3xl text-white mb-2">The 12-Month Restoration</h3>
                <p className="text-blue-400 text-base font-semibold mb-6">Designed for chronic, systemic, or multi-decade autoimmune issues</p>
                
                <div className="space-y-6 text-slate-300 text-base md:text-lg mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <ShieldAlert className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Prescriptive Authority</h4>
                      <p className="text-slate-400 text-sm">Ability to script pharmaceuticals (antibiotics, etc.) if necessary, coordinating with your primary physician.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">World-Class Peptides</h4>
                      <p className="text-slate-400 text-sm">Access to cutting-edge, clinically indicated peptides for accelerated gut & systemic repair, if applicable.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Coaching Architecture</h4>
                      <p className="text-slate-400 text-sm">6 Months of 1-on-1 Personal Coaching + 12 Months of Group Coaching</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Pill className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Custom Supplement Box</h4>
                      <p className="text-slate-400 text-sm">Custom AM, PM, and evening blister packs designed month-over-month by our medical board</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <Apple className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Individualized Meal Planning</h4>
                      <p className="text-slate-400 text-sm">Custom meal architectures mapping directly to your food sensitivities and metabolic profile</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center border border-blue-900 shrink-0 mt-1">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-serif text-lg font-semibold">Continuous Access & Support</h4>
                      <p className="text-slate-400 text-sm">Multiple live Q&A calls a week with our clinical team + dedicated learning tools</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-900 pt-6">
                <p className="text-slate-400 text-sm italic">
                  *Identical clinical oversight. Designed for individuals requiring long-term, step-by-step guidance to completely reverse multi-decade systemic issues.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials (Optimized for Older Eyes) */}
      <section className="py-24 bg-slate-950">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">Clinical Outcomes</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              A Radically Transformed Life
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Real results from patients who felt completely dismissed by conventional medicine, but found healing by swimming upstream.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900">
              <div className="flex items-center gap-1 mb-4 text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>
              <p className="text-white font-serif text-lg italic mb-6 leading-relaxed">
                "For ten years, my doctor told me my bloating and joint pain were just part of aging. This integrated team looked at my gut barrier, found my exact food sensitivities, and custom-formulated my supplements. Within three months, my pain was gone, and I had my energy back."
              </p>
              <div>
                <p className="text-white font-semibold text-base">— Sarah K., Age 64</p>
                <p className="text-slate-400 text-sm">6-Month Rebuild Graduate</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-900">
              <div className="flex items-center gap-1 mb-4 text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>
              <p className="text-white font-serif text-lg italic mb-6 leading-relaxed">
                "I was diagnosed with Hashimoto's and felt like my health was slipping away. The medical board mapped my oral-gut axis, found massive microbial imbalances in my mouth, and put me on a custom supplement plan. I am sleeping through the night for the first time in fifteen years."
              </p>
              <div>
                <p className="text-white font-semibold text-base">— Mark T., Age 61</p>
                <p className="text-slate-400 text-sm">12-Month Restoration Graduate</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Diagnostic Offer Section */}
      <section ref={offerSectionRef} className="py-24 bg-slate-900/40 border-t border-slate-900 relative overflow-hidden">
        <div className="container max-w-4xl relative z-10">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-base uppercase tracking-wider">Step 1 — Start Here</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mt-3 mb-6">
              Get Your Diagnostic Intake Package
            </h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Secure your screening kit today. Everyone walks away with a personalized Upstream Action Plan and custom, actionable advice.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 border-2 border-blue-600 shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12 border-b border-slate-900">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl text-white mb-4">The Screening Kit Includes:</h3>
                  <ul className="space-y-4 text-slate-300 text-base md:text-lg mb-6">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                      <span><strong>KBMO FIT 22 Panel:</strong> Screens 22 primary inflammatory food triggers</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                      <span><strong>Gut Barrier Panel:</strong> Measures Zonulin/Occludin for leaky gut</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                      <span><strong>1-Hour Private Consultation:</strong> Private review with a clinical health coach</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                      <span><strong>Upstream Action Plan:</strong> Custom, actionable advice guaranteed</span>
                    </li>
                  </ul>
                  <div className="p-5 rounded-xl bg-blue-950/40 border border-blue-900/40">
                    <p className="text-blue-400 font-semibold text-base mb-1">Our No-Rejection Guarantee:</p>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      We only accept a limited number of qualified patients into our 6- and 12-month programs month-over-month. However, <strong>regardless of whether you qualify for the long-term program or not, you walk away with actionable data and solutions</strong>. You will receive your complete food sensitivity report, leaky gut markers, and a personalized Upstream Action Plan to guide your next steps.
                    </p>
                  </div>
                </div>
                <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                  <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block mb-2">Total Diagnostic Investment</span>
                  <div className="text-5xl font-serif text-white mb-2">$399</div>
                  <span className="text-slate-400 text-sm block mb-6">Includes clinical-grade lab tests, coach review, and customized action plan</span>
                  <Button 
                    onClick={handlePurchaseClick}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-5 rounded-xl transition-all shadow-lg shadow-blue-950/50 active:scale-98"
                  >
                    Order Your Diagnostic Kit
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-900/40 flex flex-col sm:flex-row gap-6 justify-between items-center text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span>HIPAA-Compliant & Secure Data Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Free 2-Day Priority Lab Shipping Included</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-950 border-t border-slate-900">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-6">Frequently Asked Questions</h2>
            <div className="w-16 h-1 bg-blue-500 mx-auto rounded-full" />
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-slate-900 rounded-xl px-6 bg-slate-900/20">
              <AccordionTrigger className="text-white font-serif text-lg md:text-xl py-5 hover:no-underline">
                What happens during the 1-hour consultation?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300 text-base md:text-lg leading-relaxed pb-5">
                Once the lab processes your KBMO FIT 22 and Gut Barrier Permeability Panel, you will sit down 1-on-1 with a certified clinical health coach. Together, you will review your food sensitivity triggers and leaky gut markers. Your coach will deliver a personalized Upstream Action Plan with custom, actionable dietary and lifestyle adjustments so you walk away with immediate solutions.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-slate-900 rounded-xl px-6 bg-slate-900/20">
              <AccordionTrigger className="text-white font-serif text-lg md:text-xl py-5 hover:no-underline">
                How do I qualify for the 6- or 12-month programs?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300 text-base md:text-lg leading-relaxed pb-5">
                During your Step 1 consultation, your coach will evaluate the severity of your gut barrier dysfunction, food sensitivities, and overall clinical history. If your case requires long-term, coordinated clinical care (such as custom supplement blister-packs and multiple weekly board reviews), and you are committed to the process, we will present the 6-month or 12-month program options to you.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-slate-900 rounded-xl px-6 bg-slate-900/20">
              <AccordionTrigger className="text-white font-serif text-lg md:text-xl py-5 hover:no-underline">
                Are the supplement blister packs included in the program?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300 text-base md:text-lg leading-relaxed pb-5">
                Yes! If you qualify and join our 6- or 12-month programs, your monthly custom supplement box is fully included. Our clinical board custom-formulates and packages your medical-grade supplements into convenient, pre-sorted AM, PM, and evening blister packs delivered directly to your door month-over-month.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-slate-900 rounded-xl px-6 bg-slate-900/20">
              <AccordionTrigger className="text-white font-serif text-lg md:text-xl py-5 hover:no-underline">
                What if I don't qualify for the long-term programs?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300 text-base md:text-lg leading-relaxed pb-5">
                If your screening reveals that you do not require our intensive 6- or 12-month programs, that is great news! You still walk away with full value. Your clinical coach will give you a complete, customized protocol detailing exactly what dietary adjustments, lifestyle shifts, and basic supplementation you need to maintain a healthy gut barrier on your own.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-slate-900 rounded-xl px-6 bg-slate-900/20">
              <AccordionTrigger className="text-white font-serif text-lg md:text-xl py-5 hover:no-underline">
                What is the investment for the programs if I qualify?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300 text-base md:text-lg leading-relaxed pb-5">
                We have pathways designed to meet you where you are. For those looking for a self-guided route, we have a custom-built <strong>Do-It-Yourself (DIY) application that starts at $299</strong>. For individuals who qualify and require our high-touch, fully integrated, collaborative clinical programs (including medical-grade AM/PM blister-packed supplements, custom meal planning, a dedicated coach, and continuous clinical support), the investment for these comprehensive <strong>full-service programs ranges between $5,000 and $10,000</strong>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-16 border-t border-slate-900 text-slate-400 text-sm">
        <div className="container max-w-5xl text-center">
          <p className="font-serif text-lg text-white mb-4">© The Urban Monk · Upstream Health Program</p>
          <p className="mb-8">Questions? Contact our clinical care team at <a href="mailto:support@theurbanmonk.com" className="text-blue-400 hover:underline">support@theurbanmonk.com</a></p>
          
          <div className="max-w-3xl mx-auto p-6 rounded-xl bg-slate-900/30 border border-slate-900 text-xs text-slate-500 leading-relaxed text-left">
            <p className="font-semibold text-slate-400 mb-2 uppercase">Disclaimer:</p>
            The services, programs, and diagnostic screening kits offered by The Urban Monk and Upstream Health Program are designed to support systemic health, gut barrier function, and nutritional optimization. The diagnostic screening kits (KBMO FIT 22 and Gut Barrier Permeability Panel) are screening tools used for educational and nutritional guidance. These programs are functional medicine programs and are not intended to diagnose, treat, cure, or prevent any specific medical disease. Always consult with your primary physician before making significant changes to your healthcare, diet, or supplement regimen.
          </div>
        </div>
      </footer>
    </div>
  );
}
