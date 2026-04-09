/**
 * Seed script: inserts all press hits from both CSV files into the press_hits table.
 * Run with: node server/seedPress.mjs
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

// Parse mysql://user:pass@host:port/db
const url = new URL(DB_URL);
const conn = await createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

// ── Authority tier classification ─────────────────────────────────────────────
function getTier(outlet) {
  const s = outlet.toLowerCase();
  const tierS = [
    "new york times", "nyt", "cnn", "nbc", "good housekeeping", "inc.",
    "inc.com", "cosmopolitan", "huffington post", "huffpost", "new york post",
    "new york magazine", "ny mag", "the cut", "reader's digest", "redbook",
    "family circle", "women's health", "self magazine", "health magazine",
    "the doctors", "dr. oz", "hallmark channel", "medium", "popsugar",
    "bustle", "elite daily", "yahoo", "goodreads", "bicycling", "detroit free press",
    "detroit news", "orange county register",
  ];
  const tierA = [
    "mindbodygreen", "mind body green", "well + good", "well+good", "thrive global",
    "bulletproof", "dave asprey", "dr. hyman", "broken brain", "doctor's farmacy",
    "the doctor's farmacy", "jj virgin", "finding mastery", "gabby reece",
    "the chalkboard", "authority magazine", "rodale", "spirituality & health",
    "the well", "sonima", "mydomaine", "the zoe report", "the every girl",
    "inc. magazine playbook", "women's health online", "live happy",
    "well and good", "hearst",
  ];
  if (tierS.some(t => s.includes(t))) return "S";
  if (tierA.some(t => s.includes(t))) return "A";
  return "B";
}

// ── Topic tag inference ────────────────────────────────────────────────────────
function inferTopics(description = "", outlet = "") {
  const text = (description + " " + outlet).toLowerCase();
  const tags = [];
  if (text.match(/focus|attention|distraction/)) tags.push("focus");
  if (text.match(/meditat|mindful|zen|taoist|monk|stillness|calm/)) tags.push("meditation");
  if (text.match(/time|resolutions|gong|slow down|stopping time/)) tags.push("time management");
  if (text.match(/energy|burnout|adrenal|fatigue|exhausted/)) tags.push("energy");
  if (text.match(/sleep|insomnia|bedtime|rest/)) tags.push("sleep");
  if (text.match(/gut|microbiome|prebiotic|digestive/)) tags.push("gut health");
  if (text.match(/stress|anxiety|overwhelm|cortisol/)) tags.push("stress");
  if (text.match(/habit|routine|productivity|performance/)) tags.push("habits");
  if (text.match(/prosperity|money|wealth|financial/)) tags.push("prosperity");
  if (text.match(/nature|outdoor|environment/)) tags.push("nature");
  if (text.match(/nutrition|food|diet|eating/)) tags.push("nutrition");
  if (text.match(/breathing|breath|qigong/)) tags.push("breathwork");
  if (text.match(/urban monk|pedram shojai/)) tags.push("urban monk");
  if (tags.length === 0) tags.push("wellness");
  return JSON.stringify([...new Set(tags)]);
}

// ── Parse impressions ─────────────────────────────────────────────────────────
function parseImpressions(raw = "") {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

// ── All press hits ────────────────────────────────────────────────────────────
const hits = [
  // ── FOCUS Campaign (2020-2021) ──────────────────────────────────────────────
  { outlet: "mindbodygreen", medium: "online", description: "How To Set Intentions Instead Of Resolutions For 2021", impressions: "1,136,000", date: "1/6/2021", url: "https://www.mindbodygreen.com/articles/set-intentions-instead-of-resolutions-for-2021", book: "FOCUS" },
  { outlet: "KTLA", medium: "online", description: "How to stay calm and focused in 2021 with author Dr. Pedram Shojai", impressions: "992,850", date: "1/5/2021", url: "https://ktla.com/morning-news/how-to-stay-calm-and-focused-in-2021-with-author-dr-pedram-shojai/", book: "FOCUS" },
  { outlet: "KTLA", medium: "broadcast", description: "How to stay calm and focused in 2021 — TV segment", impressions: "", date: "1/5/2021", url: "", book: "FOCUS" },
  { outlet: "Revolution Health Radio (Chris Kresser)", medium: "podcast", description: "Bringing Focus, Attention and Energy Back to Your Life", impressions: "", date: "1/5/2021", url: "https://chriskresser.com/bringing-focus-attention-and-energy-back-to-your-life-with-pedram-shojai/", book: "FOCUS" },
  { outlet: "The Chalkboard", medium: "online", description: "How To Set 100 Day Gongs: A Monk's Meaningful Path To Better New Year's Resolutions", impressions: "220,000", date: "1/4/2021", url: "https://thechalkboardmag.com/100-day-gong#sl=3", book: "FOCUS" },
  { outlet: "Authority Magazine", medium: "online", description: "Getting An Upgrade; How Anyone Can Build Habits For Optimal Wellness, Performance, & Focus", impressions: "62,038,000", date: "12/21/2020", url: "https://medium.com/authority-magazine/author-dr-pedram-shojai-getting-an-upgrade-how-anyone-can-build-habits-for-optimal-wellness-perf-5f5ded9533b4", book: "FOCUS" },
  { outlet: "Ask The Health Expert Podcast (JJ Virgin)", medium: "podcast", description: "Special tips for better time management — Episode 142", impressions: "7,000,000", date: "12/15/2020", url: "https://podcasts.apple.com/us/podcast/do-you-have-any-special-tips-for-better-time-management/id911502027?i=1000502440975", book: "FOCUS" },
  { outlet: "Ask The Health Expert Podcast (JJ Virgin)", medium: "online", description: "Episode promoted on JJ Virgin's website", impressions: "42,930", date: "12/15/2020", url: "https://jjvirgin.com/main-podcast/do-you-have-any-special-tips-for-better-time-management-ep-142/", book: "FOCUS" },
  { outlet: "Medium", medium: "online", description: "New Year, New You: Book Edition — FOCUS included in roundup", impressions: "235,500,000", date: "12/9/2020", url: "https://nickylamarco.medium.com/new-year-new-you-book-edition-8872c99ac781", book: "FOCUS" },
  { outlet: "The Ultimate Health Podcast", medium: "podcast", description: "Dr. Pedram Shojai on FOCUS", impressions: "15,000,000", date: "12/8/2020", url: "https://podcasts.apple.com/us/podcast/the-ultimate-health-podcast/id921854276", book: "FOCUS" },
  { outlet: "The Ultimate Health Podcast", medium: "online", description: "Episode promoted on podcast website", impressions: "10,830", date: "12/8/2020", url: "https://ultimatehealthpodcast.com/dr-pedram-shojai-focus/", book: "FOCUS" },
  { outlet: "Good Housekeeping", medium: "online", description: "55+ Achievable New Year's Resolutions for Healthier and Happier Living", impressions: "51,900,000", date: "12/1/2020", url: "https://www.goodhousekeeping.com/health/wellness/advice/g985/achievable-new-year-resolutions/?slide=36", book: "FOCUS" },
  { outlet: "Redbook", medium: "online", description: "55+ Achievable New Year's Resolutions for Healthier and Happier Living", impressions: "2,015,000", date: "12/1/2020", url: "https://www.redbookmag.com/life/g34784430/achievable-new-year-resolutions/?slide=36", book: "FOCUS" },
  { outlet: "NBC California Live", medium: "online", description: "Tips for Better Time Management — FOCUS and time compression syndrome", impressions: "3,005,000", date: "12/1/2020", url: "https://www.nbclosangeles.com/california-live/tips-for-better-time-management/2473522/", book: "FOCUS" },
  { outlet: "NBC California Live", medium: "broadcast", description: "Segment on FOCUS and time compression syndrome", impressions: "", date: "12/1/2020", url: "", book: "FOCUS" },
  { outlet: "The Genius Life Podcast", medium: "podcast", description: "Episode on FOCUS and peak performance", impressions: "", date: "11/25/2020", url: "https://podcasts.apple.com/us/podcast/the-genius-life/id1379050662", book: "FOCUS" },
  { outlet: "Hay House (Instagram Live)", medium: "social", description: "Instagram Live with Hay House — 340K followers", impressions: "340,000", date: "11/24/2020", url: "https://www.instagram.com/hayhouseinc/", book: "FOCUS" },
  { outlet: "One Life Radio", medium: "radio", description: "Live segment on One Life Radio", impressions: "", date: "11/19/2020", url: "https://oneliferadio.com/tag/dr-pedram-shojai", book: "FOCUS" },
  { outlet: "Hay House (Facebook Live)", medium: "social", description: "Facebook Live with Hay House — 935.5K followers", impressions: "935,500", date: "11/16/2020", url: "https://www.facebook.com/watch/?v=707960099833105", book: "FOCUS" },
  { outlet: "The Doctors", medium: "broadcast", description: "How to Achieve Your Goals Even When Life Is Crazy", impressions: "", date: "11/12/2020", url: "", book: "FOCUS" },
  { outlet: "The Doctors", medium: "online", description: "How to Achieve Your Goals Even When Life Is Crazy — online segment", impressions: "247,350", date: "11/11/2020", url: "https://www.thedoctorstv.com/videos/how-to-achieve-your-goals-even-when-life-is-crazy", book: "FOCUS" },
  { outlet: "Intelligence For Your Life Podcast", medium: "podcast", description: "Episode on focus and performance", impressions: "8,200,000", date: "11/11/2020", url: "https://podcasts.apple.com/us/podcast/intelligence-for-your-life-the-podcast/id1195501291", book: "FOCUS" },
  { outlet: "The Doctor's Farmacy (Dr. Mark Hyman)", medium: "podcast", description: "How to Align Your Attention with Your Intention", impressions: "", date: "11/11/2020", url: "https://podcasts.apple.com/us/podcast/how-to-align-your-attention-your-intention-pedram-shojai/id1382804627?i=1000498135433", book: "FOCUS" },
  { outlet: "The Doctor's Farmacy (Dr. Mark Hyman)", medium: "online", description: "Interview promoted on Dr. Hyman's website", impressions: "199,020", date: "11/11/2020", url: "https://drhyman.com/blog/2020/11/11/podcast-ep144/", book: "FOCUS" },
  { outlet: "Bulletproof Radio (Dave Asprey)", medium: "podcast", description: "Energy Economics: Your Focus Is Your Money Flow", impressions: "", date: "11/10/2020", url: "https://podcasts.apple.com/us/podcast/energy-economics-your-focus-is-your-money-flow-pedram/id451295014?i=1000498021683", book: "FOCUS" },
  { outlet: "Bulletproof Radio (Dave Asprey)", medium: "online", description: "Episode promoted on Dave Asprey's website", impressions: "218,280", date: "11/10/2020", url: "https://daveasprey.com/pedram-shojai-758/", book: "FOCUS" },
  { outlet: "mindbodygreen", medium: "online", description: "5 Questions Everyone Should Ask Themselves About How They Spend Their Time — FOCUS excerpt", impressions: "3,800,000", date: "11/10/2020", url: "https://www.mindbodygreen.com/articles/reflective-questions-to-look-at-how-youre-spending-your-time", book: "FOCUS" },
  { outlet: "Thrive Global", medium: "online", description: "The Problem with the Word Yes — FOCUS excerpt", impressions: "2,025,000", date: "11/10/2020", url: "https://thriveglobal.com/stories/the-problem-with-the-word-yes/", book: "FOCUS" },
  { outlet: "The Well", medium: "online", description: "The Problem with the Word Yes — FOCUS excerpt", impressions: "75,000", date: "11/9/2020", url: "https://www.the-well.com/editorial/the-problem-with-the-word-yes", book: "FOCUS" },
  { outlet: "Growth Minds Podcast", medium: "podcast", description: "Taoist Monk Shares How to Increase Your Focus", impressions: "40,000", date: "11/4/2020", url: "https://podcasts.apple.com/us/podcast/58-taoist-monk-shares-how-to-increase-your-focus-make/id1482999379?i=1000497144848", book: "FOCUS" },
  { outlet: "Gabby Reece (Instagram)", medium: "social", description: "Gabby Reece promoted Pedram's podcast episode — 187K followers", impressions: "187,000", date: "11/4/2020", url: "https://www.instagram.com/p/CHMD_47AXoI/", book: "FOCUS" },
  { outlet: "The Gabby Reece Show", medium: "podcast", description: "Daoist Monk Dr. Pedram Shojai on Centering Yourself and Finally Becoming the Self You'd Admire", impressions: "42,000", date: "11/2/2020", url: "https://thegabbyreeceshow.libsyn.com/daoist-monk-dr-pedram-shojai-on-centering-yourself-and-finally-becoming-the-self-youd-admire", book: "FOCUS" },
  { outlet: "Broken Brain Podcast (Dr. Mark Hyman)", medium: "podcast", description: "Episode 165 — Pedram Shojai on FOCUS", impressions: "", date: "11/2/2020", url: "https://broken-brain.lnk.to/PedramShojai/", book: "FOCUS" },
  { outlet: "Broken Brain Podcast (Dr. Mark Hyman)", medium: "online", description: "Episode promoted on Dr. Hyman's website", impressions: "199,020", date: "11/2/2020", url: "https://drhyman.com/blog/2020/11/02/bb-ep165/", book: "FOCUS" },
  { outlet: "mindbodygreen", medium: "online", description: "3 Guided Meditations To Help Take Your Mind Out Of Election Panic Mode", impressions: "3,700,000", date: "11/2/2020", url: "https://www.mindbodygreen.com/articles/guided-meditations-for-dealing-with-pre-election-anxiety", book: "FOCUS" },
  { outlet: "Serena Poon (Instagram Live)", medium: "social", description: "Instagram Live interview with Serena Poon — 198K followers", impressions: "198,000", date: "10/22/2020", url: "https://www.instagram.com/chefserenapoon/", book: "FOCUS" },
  { outlet: "Finding Mastery Podcast", medium: "podcast", description: "Episode on focus, mastery, and the monk mindset", impressions: "", date: "10/15/2020", url: "https://findingmastery.net/pedram-shojai/", book: "FOCUS" },
  { outlet: "Friends of Six Senses (Facebook Live)", medium: "social", description: "Facebook Live interview — 14.8K followers", impressions: "14,800", date: "10/13/2020", url: "https://www.facebook.com/103518240503/videos/1757197287780153", book: "FOCUS" },
  { outlet: "One Life Radio", medium: "radio", description: "Live interview on One Life Radio", impressions: "", date: "10/1/2020", url: "", book: "FOCUS" },
  { outlet: "The Yoga Show from Yoga Journal", medium: "podcast", description: "Reclaiming Your Energy with Dr. Pedram Shojai", impressions: "", date: "8/10/2020", url: "https://podcasts.apple.com/us/podcast/reclaiming-your-energy-with-dr-pedram-shojai/id1509148076?i=1000487656961", book: "FOCUS" },

  // ── The Art of Stopping Time Campaign (2017-2018) ───────────────────────────
  { outlet: "POPSUGAR", medium: "online", description: "Best Breathing Techniques for Anxiety, According to These Experts", impressions: "19,156,417", date: "8/9/2018", url: "https://www.popsugar.com/fitness/Breathing-Techniques-Anxiety-45057158", book: "The Art of Stopping Time" },
  { outlet: "Women's Health Online", medium: "online", description: "What is micro mindfulness", impressions: "3,043,652", date: "2/11/2018", url: "https://www.womenshealth.com.au/what-is-micro-mindfulness", book: "The Art of Stopping Time" },
  { outlet: "Elite Daily", medium: "online", description: "The Best Ways to Beat Boredom Are Hidden in Your Everyday Routine", impressions: "10,169,862", date: "6/19/2018", url: "https://www.elitedaily.com/p/the-best-ways-to-beat-boredom-are-hidden-in-your-everyday-routine-so-get-creative-9494856", book: "The Art of Stopping Time" },
  { outlet: "Bustle", medium: "online", description: "11 Healthy Daily Habits that are More Effective to do at Night vs. in the Morning", impressions: "11,953,530", date: "3/6/2018", url: "https://www.bustle.com/p/11-healthy-daily-habits-that-are-more-effective-to-do-at-night-vs-in-the-morning-8344805", book: "The Art of Stopping Time" },
  { outlet: "The Chalkboard Mag", medium: "online", description: "The Art of Stopping Time: 5 Un-Resolutions for Busy People — excerpt", impressions: "530,000", date: "12/26/2017", url: "http://thechalkboardmag.com/the-art-of-stopping-time-pedram-shojai-excerpt", book: "The Art of Stopping Time" },
  { outlet: "Sonima", medium: "online", description: "4 Ways to Finish Your Year Strong", impressions: "250,000", date: "12/20/2017", url: "http://www.sonima.com/meditation/mindful-living/end-the-year/", book: "The Art of Stopping Time" },
  { outlet: "LA Yoga", medium: "online", description: "Review of The Art of Stopping Time", impressions: "51,480", date: "12/11/2017", url: "https://layoga.com/entertainment/books-dvds/art-stopping-time-pedram-shojai/", book: "The Art of Stopping Time" },
  { outlet: "MyDomaine", medium: "online", description: "How to Slow Down — The Art of Stopping Time and gongs", impressions: "926,485", date: "11/27/2017", url: "http://www.mydomaine.com/how-to-slow-down/slide2", book: "The Art of Stopping Time" },
  { outlet: "The Every Girl", medium: "online", description: "3 Simple Hacks for Adding Time to Your Day", impressions: "259,560", date: "11/13/2017", url: "http://theeverygirl.com/3-simple-hacks-for-adding-time-to-your-day/", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: "How to Finally Get Rid of the Destructive Habits You've Built — Playbook Series", impressions: "19,140,903", date: "11/9/2017", url: "https://www.inc.com/video/pedram-shojai/how-to-finally-get-rid-of-the-destructive-habits-youve-built.html", book: "The Art of Stopping Time" },
  { outlet: "The Zoe Report", medium: "online", description: "3 Simple Hacks For Adding Time To Your Day From A Former Taoist Monk", impressions: "1,247,896", date: "11/7/2017", url: "http://thezoereport.com/living/wellness/how-to-get-more-out-of-your-day/", book: "The Art of Stopping Time" },
  { outlet: "Yahoo! News", medium: "online", description: "3 Simple Hacks For Adding Time To Your Day — picked up from The Zoe Report", impressions: "2,295,531", date: "11/7/2017", url: "https://www.yahoo.com/news/3-simple-hacks-adding-time-173533597.html", book: "The Art of Stopping Time" },
  { outlet: "Spirituality & Health", medium: "online", description: "3 Ways to Make Friends with Time", impressions: "181,170", date: "11/7/2017", url: "https://spiritualityhealth.com/blogs/the-present-moment/2017/11/07/3-ways-to-make-friends-with-time", book: "The Art of Stopping Time" },
  { outlet: "Hearst.com", medium: "online", description: "Raising the Green Bar: Your Roadmap to Sustainability & Success — Made Safe Summit", impressions: "144,300", date: "11/3/2017", url: "http://www.hearst.com/newsroom/raising-the-green-bar-your-roadmap-to-sustainability-success", book: "The Art of Stopping Time" },
  { outlet: "Well + Good", medium: "online", description: "Eat These Warming Foods for Perfectly Balanced Energy This Fall — qigong advice", impressions: "3,120,951", date: "11/1/2017", url: "https://www.wellandgood.com/good-food/qigong-advice-pedram-shojai-warming-foods-recipes/", book: "The Art of Stopping Time" },
  { outlet: "Women's Health Online", medium: "online", description: "I Tried 10 Mindfulness Habits — Here's What Happened", impressions: "3,043,652", date: "10/25/2017", url: "https://www.womenshealthmag.com/health/mindfulness-techniques", book: "The Art of Stopping Time" },
  { outlet: "Bulletproof Radio (Dave Asprey)", medium: "podcast", description: "Spiritual Hygiene: Upgrade Your Personal Definition of Prosperity", impressions: "718,980", date: "10/25/2017", url: "https://blog.bulletproof.com/spiritual-hygiene-upgrade-personal-definition-prosperity-pedram-shojai-440/", book: "The Art of Stopping Time" },
  { outlet: "Thrive Global", medium: "online", description: "A Former Monk Explains How Spending Time in Nature Can Change How You See the World", impressions: "1,762,560", date: "10/24/2017", url: "https://www.thriveglobal.com/stories/15602-a-former-monk-explains-how-spending-time-in-nature-can-change-how-you-see-the-world", book: "The Art of Stopping Time" },
  { outlet: "Live Happy", medium: "print", description: "Time Keeps on Ticking — The Art of Stopping Time feature", impressions: "350,000", date: "10/24/2017", url: "", book: "The Art of Stopping Time" },
  { outlet: "Rodale Wellness", medium: "online", description: "Why You Should Cut People Who Suck Your Time — excerpt", impressions: "468,000", date: "10/10/2017", url: "https://www.rodalewellness.com/mind-spirit/why-you-should-cut-people-who-suck-your-time", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: "Can't Get Yourself to Meditate? You're Probably Making These Mistakes — Playbook 4", impressions: "19,140,903", date: "10/5/2017", url: "https://www.inc.com/video/pedram-shojai/cant-get-yourself-to-meditate-youre-probably-making-these-mistakes.html", book: "The Art of Stopping Time" },
  { outlet: "Hallmark Channel (Home & Family)", medium: "broadcast", description: "Segment on The Art of Stopping Time and Prosperity", impressions: "230,340", date: "10/4/2017", url: "http://www.hallmarkchannel.com/home-and-family/wednesday-october-4th-2017?o=2", book: "The Art of Stopping Time" },
  { outlet: "The Ultimate Health Podcast", medium: "podcast", description: "Interview on The Ultimate Health Podcast — 30K-70K episode downloads", impressions: "452,000", date: "9/27/2017", url: "http://ultimatehealthpodcast.com/pedram-shojai/", book: "The Art of Stopping Time" },
  { outlet: "Reader's Digest", medium: "online", description: "If You Don't Ask Yourself These 4 Questions, You're Wasting Money Every Time You Shop", impressions: "3,506,108", date: "9/21/2017", url: "https://www.rd.com/advice/saving-money/how-to-save-money-when-you-shop/", book: "The Art of Stopping Time" },
  { outlet: "Rodale Wellness", medium: "online", description: "When's the Last Time You Were Bored — article by Pedram", impressions: "112,000", date: "9/14/2017", url: "https://www.rodalewellness.com/mind-spirit/when-last-time-bored", book: "The Art of Stopping Time" },
  { outlet: "Bicycling", medium: "online", description: "How to Make More Time to Ride — advice from The Urban Monk", impressions: "1,166,673", date: "9/12/2017", url: "https://www.bicycling.com/training/ride/how-to-make-more-time-to-ride-advice-from-the-urban-monk/slide/1", book: "The Art of Stopping Time" },
  { outlet: "Reader's Digest", medium: "online", description: "Bad childhood habits — Pedram featured", impressions: "3,506,108", date: "8/21/2017", url: "http://www.rd.com/advice/parenting/bad-childhood-habits/", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: "Forget About Your Career: How to Build a Sustainable Life — Playbook 2", impressions: "19,140,903", date: "8/9/2017", url: "https://www.inc.com/video/pedram-shojai/forget-about-your-career-how-to-build-a-sustainable-life.html", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: "This Is the Single Most Counterproductive Productivity Tool — Playbook 1", impressions: "19,140,903", date: "7/26/2017", url: "https://www.inc.com/video/pedram-shojai/this-is-the-single-most-counterproductive-productivity-tool.html", book: "The Art of Stopping Time" },
  { outlet: "Cosmopolitan", medium: "print", description: "Om, No Thanks — includes Pedram and The Art of Stopping Time", impressions: "10,509,387", date: "10/1/2017", url: "", book: "The Art of Stopping Time" },
  { outlet: "Good Housekeeping", medium: "print", description: "Your 31-Day Guide to Living Happier and Healthier", impressions: "15,102,591", date: "1/1/2018", url: "", book: "The Art of Stopping Time" },
  { outlet: "Family Circle", medium: "print", description: "2018 goals and resolutions feature", impressions: "14,000,000", date: "1/1/2018", url: "", book: "The Art of Stopping Time" },
  { outlet: "Good Housekeeping", medium: "print", description: "Good Housekeeping Summit recap — The Art of Stopping Time", impressions: "15,102,591", date: "12/1/2017", url: "", book: "The Art of Stopping Time" },

  // ── The Urban Monk Campaign (2015-2016) ─────────────────────────────────────
  { outlet: "The New York Times", medium: "online", description: "Best Sellers list — The Urban Monk", impressions: "42,381,039", date: "2/21/2016", url: "https://www.nytimes.com/books/best-sellers/2016/02/21/advice-how-to-and-miscellaneous/?_r=1", book: "The Urban Monk" },
  { outlet: "CNN.com", medium: "online", description: "21 achievable New Year's resolutions for your health — Pedram featured", impressions: "67,090,860", date: "1/1/2016", url: "http://www.cnn.com/2016/01/01/health/new-years-resolutions-health/", book: "The Urban Monk" },
  { outlet: "Huffington Post", medium: "online", description: "17 Positive Habits that will change your life", impressions: "46,029,910", date: "11/3/2015", url: "http://www.huffingtonpost.com/maria-rodale/17-positive-habits-that-w_b_8454336.html", book: "The Urban Monk" },
  { outlet: "New York Magazine / The Cut", medium: "online", description: "Easy ways to start meditating at home", impressions: "5,770,505", date: "1/4/2016", url: "http://nymag.com/thecut/2016/01/how-to-meditate-meditation-for-beginners.html", book: "The Urban Monk" },
  { outlet: "New York Post", medium: "online", description: "5 Tips for de-stressing from a foul-mouthed monk", impressions: "1,193,285", date: "1/26/2016", url: "http://nypost.com/2016/01/26/5-tips-for-de-stressing-from-a-foul-mouthed-monk/", book: "The Urban Monk" },
  { outlet: "The Dr. Oz Show", medium: "online", description: "Fall asleep instantly with this pre-bedtime technique", impressions: "1,308,786", date: "1/6/2016", url: "http://www.doctoroz.com/episode/power-plan-stop-insomnia-so-you-can-sleep?video_id=4687926965001", book: "The Urban Monk" },
  { outlet: "Women's Health", medium: "online", description: "9 Health, Fitness and Nutrition Tips from a Real-Life Monk", impressions: "2,124,184", date: "1/15/2016", url: "http://www.womenshealthmag.com/health/urban-monk-advice", book: "The Urban Monk" },
  { outlet: "Mind Body Green", medium: "online", description: "A Simple Mindful Eating Practice to Give You Energy + Balance", impressions: "2,225,574", date: "2/2/2016", url: "http://www.mindbodygreen.com/0-23572/a-simple-mindful-eating-practice-to-give-you-energy-balance.html", book: "The Urban Monk" },
  { outlet: "Yahoo! Health", medium: "online", description: "Is Sleep the Key to Monk-Like Wisdom?", impressions: "230,245", date: "2/2/2016", url: "https://www.yahoo.com/beauty/is-sleep-the-key-to-monk-like-wisdom-120055832.html", book: "The Urban Monk" },
  { outlet: "Brit + Co", medium: "online", description: "14 New Books out in Feb that You Need to Read", impressions: "1,878,808", date: "2/2/2016", url: "http://www.brit.co/new-books-out-february/", book: "The Urban Monk" },
  { outlet: "Good Reads", medium: "online", description: "Top Reviews: The Urban Monk", impressions: "13,628,726", date: "2/2/2016", url: "http://www.goodreads.com/review/show/1535359707", book: "The Urban Monk" },
  { outlet: "Bulletproof", medium: "online", description: "Pedram Shojai: The Urban Monk — podcast and article", impressions: "408,505", date: "2/12/2016", url: "https://blog.bulletproof.com/pedram-shojai-the-urban-monk-283/", book: "The Urban Monk" },
  { outlet: "Food Matters", medium: "online", description: "Stressed? Ancient Wisdom You Should Know from a Taoist Monk", impressions: "291,100", date: "2/5/2016", url: "http://www.foodmatters.com/article/stressed-ancient-wisdom-you-should-know-from-a-taoist-monk", book: "The Urban Monk" },
  { outlet: "Well + Good", medium: "online", description: "How to survive the holiday party season like a Buddhist", impressions: "229,922", date: "12/19/2015", url: "https://www.wellandgood.com/good-advice/how-to-survive-holiday-party-season/", book: "The Urban Monk" },
  { outlet: "Mind Body Green", medium: "online", description: "10 tips to actually achieve your dreams next year", impressions: "1,854,427", date: "12/13/2015", url: "http://www.mindbodygreen.com/0-22878/10-tips-to-actually-achieve-your-dreams-next-year.html", book: "The Urban Monk" },
  { outlet: "SELF Magazine", medium: "print", description: "SELF Worth — The Urban Monk feature", impressions: "5,305,580", date: "12/1/2015", url: "", book: "The Urban Monk" },
  { outlet: "Health Magazine", medium: "print", description: "Resolution (and body!) reboot — The Urban Monk", impressions: "4,802,126", date: "1/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "Women's Health", medium: "print", description: "Discuss! Juicy News, Convo Starters — The Urban Monk", impressions: "5,379,990", date: "1/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "Family Circle", medium: "print", description: "Wake-up call — energy boosters", impressions: "14,131,572", date: "1/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "Family Circle", medium: "print", description: "How to declutter your home — Pedram featured", impressions: "14,000,000", date: "9/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "LA Yoga", medium: "print", description: "Media Review — The Urban Monk", impressions: "182,000", date: "1/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "Bicycling", medium: "print", description: "Shred like a monk — meditation tips", impressions: "1,446,921", date: "3/1/2016", url: "", book: "The Urban Monk" },
  { outlet: "Detroit Free Press", medium: "online", description: "The urban monk preaches life of peace and tranquility for everyone", impressions: "4,420,322", date: "3/15/2016", url: "http://www.freep.com/story/life/2016/03/15/urban-monk-preaches-life-peace-and-tranquility-everyone/81658756/", book: "The Urban Monk" },
  { outlet: "Detroit News", medium: "online", description: "Live like an urban monk", impressions: "1,386,933", date: "3/11/2016", url: "http://www.detroitnews.com/story/news/religion/2016/03/11/live-like-urban-monk/81668438/", book: "The Urban Monk" },
  { outlet: "Orange County Register", medium: "online", description: "Live like an urban monk", impressions: "1,032,348", date: "3/6/2016", url: "http://www.ocregister.com/articles/shojai-706789-monk-life.html", book: "The Urban Monk" },
  { outlet: "Columbus Dispatch", medium: "online", description: "Wellness guru Pedram Shojai has built an empire", impressions: "1,352,348", date: "3/20/2016", url: "http://www.dispatch.com/content/stories/life_and_entertainment/2016/03/20/1-wellness-guru-has-built-an-empire.html", book: "The Urban Monk" },
  { outlet: "Rodale's Organic Life", medium: "online", description: "How our paleo past may be the blame for modern materialism", impressions: "566,942", date: "3/10/2016", url: "http://www.rodalesorganiclife.com/wellbeing/how-our-paleo-past-may-be-to-blame-for-modern-materialism", book: "The Urban Monk" },
  { outlet: "Spark People", medium: "online", description: "Good book to get on track — The Urban Monk", impressions: "2,487,300", date: "2/4/2016", url: "http://www.sparkpeople.com/mypage_public_journal_individual.asp?blog_id=6087734", book: "The Urban Monk" },
  { outlet: "Rodale Wellness", medium: "online", description: "10 Prebiotic Foods for Optimum Gut Health — Pedram featured", impressions: "134,013", date: "1/8/2016", url: "http://www.rodalewellness.com/food/10-prebiotic-foods-for-optimum-gut-health", book: "The Urban Monk" },
  { outlet: "Latinos Health", medium: "online", description: "Meditation for beginners: 5 ways to start meditating in 2016", impressions: "153,018", date: "1/7/2016", url: "http://www.latinoshealth.com/articles/15139/20160107/meditation-for-beginners-5-ways-to-start-meditating-in-2016.htm", book: "The Urban Monk" },
  { outlet: "Longevity Warehouse", medium: "online", description: "Living a stress-free life with Pedram Shojai", impressions: "48,858", date: "10/5/2015", url: "http://www.longevitywarehouse.com/blog/living-a-stress-free-life-with-pedram-shojai/", book: "The Urban Monk" },
  { outlet: "Rodale's Organic Life", medium: "online", description: "10 Things You didn't know about meditation", impressions: "549,329", date: "11/26/2015", url: "http://www.rodalesorganiclife.com/wellbeing/10-things-you-didnt-know-about-meditation", book: "The Urban Monk" },
  { outlet: "Natural Health 365", medium: "online", description: "The Urban Monk: Protection against stress in the modern world", impressions: "108,138", date: "2/22/2016", url: "http://www.naturalhealth365.com/stress-lifestyle-1751.html", book: "The Urban Monk" },
  { outlet: "Fat-Burning Man", medium: "online", description: "Pedram Shojai on how to reverse adrenal burnout and pumpkin pie", impressions: "121,091", date: "2/19/2016", url: "http://fatburningman.com/dr-pedram-shojai-the-urban-monk-how-to-reverse-adrenal-burnout-and-pumpkin-pie/", book: "The Urban Monk" },
  { outlet: "The Sacred Science", medium: "online", description: "A Taoist Priest Shares 9 Secrets of his life", impressions: "22,114", date: "1/27/2016", url: "http://www.thesacredscience.com/a-taoist-priest-shares-9-secrets-of-life/", book: "The Urban Monk" },
  { outlet: "JJ Virgin", medium: "online", description: "The Urban Monk, finding stillness amidst the chaos", impressions: "", date: "2/6/2016", url: "http://jjvirgin.com/the-urban-monk-finding-stillness-amidst-the-chaos/", book: "The Urban Monk" },
  { outlet: "Thyroid Pharmacist", medium: "online", description: "Autoimmune Thyroid Disease and Anxiety — Pedram featured", impressions: "54,018", date: "2/11/2016", url: "https://thyroidpharmacist.com/articles/autoimmune-thyroid-disease-and-anxiety/", book: "The Urban Monk" },
  { outlet: "Marin Independent Journal", medium: "print", description: "One man finds balance living like an urban monk", impressions: "67,568", date: "3/22/2016", url: "", book: "The Urban Monk" },
  { outlet: "Columbus Dispatch", medium: "print", description: "Finding Peace in Life", impressions: "345,965", date: "3/20/2016", url: "", book: "The Urban Monk" },
  { outlet: "Detroit Free Press", medium: "print", description: "The urban monk", impressions: "473,238", date: "3/15/2016", url: "", book: "The Urban Monk" },
  { outlet: "Detroit News", medium: "print", description: "Live like an urban monk", impressions: "640,188", date: "3/12/2016", url: "", book: "The Urban Monk" },
  { outlet: "Orange County Register", medium: "print", description: "Live like an urban monk", impressions: "318,993", date: "3/9/2016", url: "", book: "The Urban Monk" },
];

// ── Insert all hits ───────────────────────────────────────────────────────────
let inserted = 0;
for (const h of hits) {
  const tier = getTier(h.outlet);
  const topics = inferTopics(h.description, h.outlet);
  const imp = parseImpressions(h.impressions);
  await conn.execute(
    `INSERT INTO press_hits (outlet, medium, description, impressions, impressionsLabel, coverageDate, url, topicTags, authorityTier, book)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.outlet,
      h.medium,
      h.description || null,
      imp,
      h.impressions || null,
      h.date || null,
      h.url || null,
      topics,
      tier,
      h.book || null,
    ]
  );
  inserted++;
}

console.log(`✅ Seeded ${inserted} press hits into press_hits table.`);
await conn.end();
