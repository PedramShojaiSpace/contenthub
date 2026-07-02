import { useEffect, useState, useRef } from "react";

// Custom type definitions for tracking scripts loaded in index.html
declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, any>) => void;
    fbq?: (command: string, eventName: string, params?: Record<string, any>) => void;
  }
}

export default function UpstreamRegister() {
  const [countdown, setCountdown] = useState({ days: "00", hours: "00", minutes: "00", seconds: "00" });
  const [isLive, setIsLive] = useState(false);
  const revealsRef = useRef<HTMLDivElement[]>([]);

  // 1. ViewContent tracking on load
  useEffect(() => {
    if (window.fbq) {
      window.fbq("track", "ViewContent", { content_name: "Webinar Registration Page" });
    }
  }, []);

  // 2. Countdown logic
  useEffect(() => {
    const target = new Date("2026-06-25T23:00:00Z"); // 5 PM CT (Thursday)
    
    function updateCountdown() {
      const now = Date.now();
      const diff = Math.max(0, target.getTime() - now);
      
      if (diff === 0) {
        setIsLive(true);
        return;
      }
      
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      setCountdown({
        days: String(d).padStart(2, "0"),
        hours: String(h).padStart(2, "0"),
        minutes: String(m).padStart(2, "0"),
        seconds: String(s).padStart(2, "0")
      });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Scroll reveal logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    revealsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const addToRef = (el: HTMLDivElement | null) => {
    if (el && !revealsRef.current.includes(el)) {
      revealsRef.current.push(el);
    }
  };

  // 4. Tracking on click
  const trackRegister = () => {
    if (window.fbq) {
      window.fbq("track", "Lead", { content_name: "Webinar Registration" });
    }
    if (window.gtag) {
      window.gtag("event", "generate_lead", { event_category: "webinar", event_label: "register_button" });
    }
  };

  return (
    <div className="min-h-screen bg-[#000a23] text-white font-sans selection:bg-[#007bff]/20 selection:text-[#007bff] overflow-x-hidden">
      {/* Custom Global CSS styles injected for layout-specific overrides */}
      <style>{`
        .reveal { opacity: 0; transform: translateY(2rem); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
      `}</style>

      {/* ─── HERO ─── */}
      <section 
        className="relative py-12 md:py-24 bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 8, 35, 0.85), rgba(0, 8, 35, 0.85)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
            
            {/* Copy */}
            <div ref={addToRef} className="reveal flex-1 text-center lg:text-left">
              <p className="text-xs md:text-sm font-bold tracking-[0.12em] uppercase text-[#7dd3fc] mb-4">
                Free Live Masterclass &middot; Dr. Pedram Shojai
              </p>
              <h1 className="font-serif text-3xl md:text-5xl lg:text-[3.5rem] leading-[1.15] mb-6">
                You're Not Crazy.<br />
                You're Just Missing the<br />
                <span className="text-[#7dd3fc]">Root Cause.</span>
              </h1>
              <p className="text-[#c0dcf8] text-base md:text-lg max-w-lg mx-auto lg:mx-0 mb-6 leading-relaxed font-light">
                Reclaim Your Energy, Focus & Vitality by Fixing What Your Doctor Missed. We need to look <strong>UPSTREAM</strong> to find the source.
              </p>
              
              <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2 bg-[#007bff]/15 border border-[#007bff]/40 rounded-xl px-4 py-3 mb-8 text-sm">
                <strong className="text-white">📅 Thursday, June 25, 2026</strong>
                <span className="text-white/30 hidden sm:inline">&middot;</span>
                <span className="text-white/75">5:00 PM CT &middot; 6:00 PM ET &middot; 3:00 PM PT</span>
                <span className="text-white/30 hidden sm:inline">&middot;</span>
                <span className="text-white/75">Zoom &middot; Free</span>
              </div>

              <div>
                <a 
                  href="https://us02web.zoom.us/webinar/register/WN_bYuWmC-mSZG6d7lI577QuA" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={trackRegister}
                  className="inline-block bg-[#007bff] text-white text-lg font-bold px-10 py-4 rounded-xl shadow-[0_6px_32px_rgba(0,123,255,0.45)] hover:opacity-90 hover:scale-[1.03] transition-all duration-200"
                >
                  Reserve My Free Spot &rarr;
                </a>
                <p className="text-xs text-[#7dd3fc] mt-3">Free to attend &middot; Live Q&amp;A included &middot; Replay for registered attendees only</p>
              </div>
            </div>

            {/* Photo */}
            <div ref={addToRef} className="reveal flex-shrink-0 flex flex-col items-center" style={{ transitionDelay: "150ms" }}>
              <img 
                src="/manus-storage/2020-06-05-Urban-Monk-1675(2)_fcad35ce.webp" 
                alt="Dr. Pedram Shojai" 
                className="w-[210px] h-[300px] object-cover object-center rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
              />
              <div className="mt-3 bg-[#007bff]/20 border border-[#007bff]/40 rounded-xl px-4 py-2.5 text-center max-w-[210px]">
                <strong className="block text-xs md:text-sm text-white font-bold">Dr. Pedram Shojai</strong>
                <span className="text-[11px] text-[#7dd3fc]">NYT Bestselling Author<br />8 Books &middot; 12 Doc Series</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── COUNTDOWN ─── */}
      <section 
        className="relative py-10 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 25, 0.93), rgba(0, 5, 25, 0.93)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-2xl mx-auto px-6 text-center relative z-10">
          <p className="text-xs font-bold tracking-[0.1em] uppercase text-[#7dd3fc] mb-6">
            {isLive ? "The webinar is live — join now" : "Spots are filling up. Webinar begins in:"}
          </p>
          
          {!isLive && (
            <div className="flex justify-center gap-4 mb-8">
              {[
                { val: countdown.days, label: "Days" },
                { val: countdown.hours, label: "Hours" },
                { val: countdown.minutes, label: "Minutes" },
                { val: countdown.seconds, label: "Seconds" }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="font-serif text-2xl md:text-4xl text-white bg-[#007bff]/30 border border-[#007bff]/55 rounded-xl w-[68px] md:w-[90px] h-[68px] md:h-[90px] flex items-center justify-center font-mono">
                    {item.val}
                  </div>
                  <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#7dd3fc] mt-2">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          <a 
            href="https://us02web.zoom.us/webinar/register/WN_bYuWmC-mSZG6d7lI577QuA" 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={trackRegister}
            className="inline-block bg-[#007bff] text-white text-base md:text-lg font-bold px-8 py-3.5 rounded-xl shadow-[0_6px_32px_rgba(0,123,255,0.45)] hover:opacity-90 hover:scale-[1.03] transition-all duration-200"
          >
            Register Now — It's Free &rarr;
          </a>
        </div>
      </section>

      {/* ─── PAIN POINTS (SOUND FAMILIAR?) ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 8, 35, 0.88), rgba(0, 8, 35, 0.88)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal text-center">
            <h2 className="font-serif text-2xl md:text-4xl mb-3">Sound Familiar?</h2>
            <p className="text-[#c0dcf8] text-base mb-10">
              You eat well. You exercise. You meditate. You might even see a functional medicine doctor. Yet despite all your efforts, you're still battling chronic fatigue, brain fog, stubborn gut issues, or that nagging feeling that you're just not yourself anymore.
            </p>
            
            <div className="flex flex-col gap-4 text-left mb-8">
              {[
                "You've been told \"it's just stress\" or \"your labs are normal\" — but that doesn't explain why you can't show up for your family, your work, or yourself the way you used to.",
                "You've tried elimination diets, probiotics, and gut supplements — and you're still not better.",
                "Most conventional medicine, and even some functional medicine, is still treating symptoms downstream.",
                "You suspect your gut is connected to everything else that's wrong, but you don't know where to start."
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-4 md:p-5">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-[#007bff]/35 border border-[#007bff]/50 text-[#7dd3fc] flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                  <p className="text-[#c0dcf8] text-sm md:text-base leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#007bff]/10 border border-[#007bff]/30 rounded-2xl p-6 text-center max-w-2xl mx-auto">
              <p className="font-serif text-lg md:text-xl text-white">
                "You're not alone, and you're not imagining it. The problem isn't you — it's the approach."
              </p>
              <p className="text-[#7dd3fc] text-sm mt-2 font-medium">What if we could go upstream — to the source — and finally fix what's truly holding you back?</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHAT YOU'LL DISCOVER (UPSTREAM HEALTH FRAMEWORK) ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 25, 0.92), rgba(0, 5, 25, 0.92)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal">
            <h2 className="font-serif text-2xl md:text-4xl text-center mb-3">Upstream Health: How to Find and Fix Your Root Cause</h2>
            <p className="text-[#c0dcf8] text-base text-center mb-10">Dr. Shojai will cover the functional medicine science that most doctors simply aren't taught.</p>
            
            <div className="flex flex-col gap-5">
              {[
                {
                  num: 1,
                  title: "The 3 Hidden Root Causes",
                  desc: "Discover the 3 major underlying drivers of chronic fatigue, brain fog, and gut issues that most doctors completely overlook — even when you've \"tried everything.\""
                },
                {
                  num: 2,
                  title: "Why Your Labs Are \"Normal\" (But You Feel Awful)",
                  desc: "Understand the critical functional markers conventional tests miss, and learn how to interpret your own lab work for true, actionable insights into your cellular health."
                },
                {
                  num: 3,
                  title: "The Gut-Brain Connection Decoded",
                  desc: "Learn how intestinal permeability (leaky gut) is silently leaking LPS endotoxins into your bloodstream, sabotaging your daily energy, mood, and cognitive function."
                },
                {
                  num: 4,
                  title: "My Proven \"Upstream\" Framework",
                  desc: "Get a clear, step-by-step approach (Remove, Replace, Reinoculate, Repair, Rebalance, Retain) to identify your unique root causes and build a personalized plan for lasting vitality."
                },
                {
                  num: 5,
                  title: "Stop Guessing. Start Healing.",
                  desc: "Discover the precise, targeted testing that cuts through the marketing noise and reveals exactly what your body needs to heal at the source."
                }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-white/5 border border-[#007bff]/25 rounded-xl p-5">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#007bff] text-white flex items-center justify-center text-sm font-bold">
                    {item.num}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-[#c0dcf8] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHO THIS IS FOR ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 8, 35, 0.90), rgba(0, 8, 35, 0.90)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-4xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal text-center">
            <h2 className="font-serif text-2xl md:text-4xl mb-3">Who This Is For</h2>
            <p className="text-[#c0dcf8] text-base mb-10 max-w-xl mx-auto">
              This webinar is designed for driven, high-performing professionals who are ready to stop managing symptoms and start solving the problem at its source.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {[
                {
                  title: "Executives & Entrepreneurs",
                  desc: "High-performers who can't afford to operate at less than their best — and know their health is the absolute foundation of everything they build."
                },
                {
                  title: "Analytical Thinkers",
                  desc: "Detail-oriented professionals who want real scientific answers, not platitudes. You've done the research — now you need the right actionable framework."
                },
                {
                  title: "The Chronically Frustrated",
                  desc: "You've tried everything. Seen every specialist. Still feel awful. You're ready for a genuinely different, clinical approach that actually works."
                },
                {
                  title: "Peak Performance Seekers",
                  desc: "Committed to reclaiming your energy, focus, and long-term vitality — and willing to go upstream to find and resolve the real root cause."
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-[#c0dcf8] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 25, 0.94), rgba(0, 5, 25, 0.94)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-4xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal text-center">
            <h2 className="font-serif text-2xl md:text-4xl mb-10">What Attendees Are Saying</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                {
                  quote: "I've spent thousands on doctors, and Pedram finally explained why I was still sick when everyone said I was fine. It was an eye-opener.",
                  author: "Sarah K.",
                  role: "CEO"
                },
                {
                  quote: "The best hour I've spent on my health all year. No fluff, just actionable insights I can use right away.",
                  author: "Mark T.",
                  role: "Software Engineer"
                },
                {
                  quote: "I was skeptical, having tried so many things. But Dr. Shojai's approach is genuinely different. He validated everything I felt.",
                  author: "Jessica L.",
                  role: "Attorney"
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-[#007bff]/5 border border-[#007bff]/20 rounded-2xl p-6 flex flex-col justify-between">
                  <p className="text-[#c0dcf8] text-sm italic leading-relaxed mb-6">"{item.quote}"</p>
                  <div>
                    <strong className="block text-sm text-white">{item.author}</strong>
                    <span className="text-xs text-[#7dd3fc]">{item.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── BIO ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 8, 35, 0.90), rgba(0, 8, 35, 0.90)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="shrink-0 flex flex-col items-center">
                <img 
                  src="/manus-storage/2020-06-05-Urban-Monk-1675(2)_fcad35ce.webp" 
                  alt="Dr. Pedram Shojai" 
                  className="w-[170px] h-[240px] object-cover object-center rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                />
                <div className="mt-3 bg-[#007bff]/20 border border-[#007bff]/40 rounded-xl px-4 py-2.5 text-center max-w-[170px]">
                  <strong className="block text-xs text-white font-bold">NYT Bestselling Author</strong>
                  <span className="text-[10px] text-[#7dd3fc]">8 Books &middot; 12 Doc Series</span>
                </div>
              </div>
              <div className="flex-grow">
                <p className="text-xs font-bold tracking-[0.1em] uppercase text-[#7dd3fc] mb-2">Your Host</p>
                <h2 className="font-serif text-2xl md:text-3xl text-left mb-4">Dr. Pedram Shojai</h2>
                <p className="text-[#c0dcf8] text-sm md:text-base leading-relaxed mb-3">
                  I spent years studying Eastern medicine, Taoist philosophy, and Western functional approaches to health. My journey — chronicled in <em>The Urban Monk</em> and <em>The Art of Stopping Time</em>, and on <em>The Urban Monk Podcast</em> — has been dedicated to helping high-performers navigate the complexities of modern life without sacrificing their health.
                </p>
                <p className="text-[#c0dcf8] text-sm md:text-base leading-relaxed mb-4">
                  I ran multi-specialty integrative medicine clinics for over a decade and built one of the first functional medicine practices in the country. I've seen firsthand how a truly holistic, root-cause approach can transform lives. I'm here to share that wisdom with you.
                </p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                    📚 <strong>Bestselling Author</strong>: The Urban Monk, Focus, Lights On & The Art of Stopping Time
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                    🎬 <strong>Award-Winning Filmmaker</strong>: Documentaries on health & consciousness
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ATTENDEE BONUS OFFER ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 25, 0.95), rgba(0, 5, 25, 0.95)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal bg-[#007bff]/10 border border-[#007bff]/45 rounded-3xl p-6 md:p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#007bff] text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
              Attendee Special
            </div>
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-[#7dd3fc] mb-3">🎁 Special Offer for Attendees</p>
            <h3 className="font-serif text-xl md:text-3xl text-white mb-4">Get the Upstream Bundle for just $499</h3>
            <p className="text-[#c0dcf8] text-sm md:text-base max-w-xl mx-auto mb-8">
              As a thank you for attending, we'll be offering an exclusive live-only opportunity to secure our complete Upstream Bundle program at a highly discounted rate.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mb-8">
              {[
                { title: "Clinical Test Kit", desc: "The exact functional test kit Dr. Shojai uses with private clients." },
                { title: "Upstream Course", desc: "Full access to the foundational Upstream Health curriculum & masterclass." },
                { title: "Personalized Roadmap", desc: "A customized plan to stop guessing and start healing at the source." }
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-white mb-1">✓ {item.title}</h4>
                  <p className="text-xs text-[#c0dcf8] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <a 
              href="https://us02web.zoom.us/webinar/register/WN_bYuWmC-mSZG6d7lI577QuA" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={trackRegister}
              className="inline-block bg-[#007bff] text-white text-base font-bold px-8 py-3.5 rounded-xl shadow-[0_6px_32px_rgba(0,123,255,0.45)] hover:opacity-90 hover:scale-[1.03] transition-all duration-200"
            >
              Secure My Spot & Bonus Access &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section 
        className="relative py-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 8, 35, 0.92), rgba(0, 8, 35, 0.92)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal">
            <h2 className="font-serif text-2xl md:text-4xl text-center mb-10">Frequently Asked Questions</h2>
            
            <div className="flex flex-col gap-6">
              {[
                {
                  q: "Is this really free?",
                  a: "Yes, this live webinar is completely free. Dr. Shojai's mission is to empower you with the clinical functional medicine knowledge you need to take absolute control of your health."
                },
                {
                  q: "Will there be a replay?",
                  a: "A limited-time replay will be available for those who register but cannot attend live. However, attending live is highly recommended so you can ask Dr. Shojai questions and engage in real-time."
                },
                {
                  q: "What do I need to prepare?",
                  a: "Just bring yourself, a notepad, and an open mind. Be ready to challenge conventional medical thinking and discover a true, scientific path to vibrant health."
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-base font-bold text-white mb-2">❓ {item.q}</h3>
                  <p className="text-sm text-[#c0dcf8] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section 
        className="relative py-20 bg-cover bg-center text-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 25, 0.93), rgba(0, 5, 25, 0.93)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10">
          <div ref={addToRef} className="reveal">
            <h2 className="font-serif text-2xl md:text-4xl mb-4">Reserve Your Free Seat Today</h2>
            <p className="text-[#c0dcf8] text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              The path to reclaiming your energy, focus, and vitality starts here. Don't let another year pass feeling less than your best. Secure your spot now before it's too late.
            </p>
            <a 
              href="https://us02web.zoom.us/webinar/register/WN_bYuWmC-mSZG6d7lI577QuA" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={trackRegister}
              className="inline-block bg-[#007bff] text-white text-base md:text-lg font-bold px-10 py-4 rounded-xl shadow-[0_6px_32px_rgba(0,123,255,0.45)] hover:opacity-90 hover:scale-[1.03] transition-all duration-200"
            >
              Yes — Reserve My Free Spot &rarr;
            </a>
            <p className="text-xs text-[#7dd3fc] mt-4">Thursday, June 25 &middot; 5:00 PM CT &middot; Zoom Webinar &middot; Free to Attend</p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer 
        className="relative py-10 bg-cover bg-center text-center text-white/40"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 5, 20, 0.96), rgba(0, 5, 20, 0.96)), url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg')`
        }}
      >
        <div className="container max-w-3xl mx-auto px-6 relative z-10 text-xs">
          <p className="mb-1">&copy; 2026 The Urban Monk &middot; Upstream Health Program</p>
          <p className="mb-4">Questions? <a href="mailto:support@theurbanmonk.com" className="text-white/60 underline hover:text-white">support@theurbanmonk.com</a></p>
          <p className="text-[10px] text-white/25 leading-relaxed max-w-xl mx-auto">
            This webinar is for educational purposes only. Individual results vary. Consult a qualified healthcare provider before making changes to your health regimen.
          </p>
        </div>
      </footer>
    </div>
  );
}
