/**
 * Import all press hits from the two uploaded CSV files into the press_hits table.
 * Skips entries that already exist (by outlet + medium + date combo).
 * 
 * Sources:
 *   1. /home/ubuntu/upload/FOCUSWrapUpTracker.xlsx-MediaCoverage.csv  (42 rows, FOCUS book campaign 2020-2021)
 *   2. /home/ubuntu/upload/PedramShojaiPressCoverageTo-Date.xlsx-Sheet1.csv  (109 rows, 2015-2018 full career)
 */

import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Helper: parse impressions string → number ─────────────────────────────
function parseImpressions(raw) {
  if (!raw) return null;
  // e.g. "UMV: 1,136,000" or "14,000,000" or "Downloads: 100-125K" or "Listenership TBC"
  const cleaned = raw.replace(/[^0-9KkMm]/g, "");
  if (!cleaned) return null;
  if (cleaned.endsWith("K") || cleaned.endsWith("k")) return parseInt(cleaned) * 1000;
  if (cleaned.endsWith("M") || cleaned.endsWith("m")) return parseInt(cleaned) * 1000000;
  const n = parseInt(cleaned.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// ── Helper: assign authority tier ────────────────────────────────────────
function getTier(outlet, impressions) {
  const S_OUTLETS = [
    "new york times", "nyt", "cnn", "good housekeeping", "cosmopolitan",
    "women's health", "family circle", "self magazine", "huffington post",
    "new york post", "new york magazine", "inc.", "inc. magazine",
    "the doctors", "dr. oz", "medium", "authority magazine", "popsugar",
    "reader's digest", "health magazine", "redbook", "bulletproof radio",
    "broken brain", "doctor's farmacy", "dr. mark hyman", "finding mastery",
    "the ultimate health podcast", "intelligence for your life",
    "gabby reece", "well + good", "mindbodygreen", "thrive global",
    "yahoo", "nbc", "ktla", "hallmark channel", "bicycling"
  ];
  const A_OUTLETS = [
    "bustle", "elite daily", "brit + co", "the chalkboard", "la yoga",
    "spirituality & health", "the zoe report", "mydomaine", "rodale",
    "sonima", "the every girl", "food matters", "the well", "the sacred science",
    "well+good", "spark people", "natural health 365", "thyroid pharmacist",
    "fat-burning man", "jj virgin", "ask the health expert", "revolution health",
    "growth minds", "the genius life", "yoga journal", "one life radio",
    "hay house", "serena poon", "friends of six senses"
  ];
  const outletLower = outlet.toLowerCase();
  if (S_OUTLETS.some(s => outletLower.includes(s))) return "S";
  if (A_OUTLETS.some(a => outletLower.includes(a))) return "A";
  if (impressions && impressions >= 1000000) return "A";
  return "B";
}

// ── Helper: assign topic tags ─────────────────────────────────────────────
function getTopicTags(outlet, description, medium) {
  const text = ((outlet || "") + " " + (description || "")).toLowerCase();
  const tags = [];
  if (text.match(/gut|microbiome|digestive|prebiotic|probiotic/)) tags.push("gut health");
  if (text.match(/sleep|insomnia|bedtime|rest/)) tags.push("sleep");
  if (text.match(/stress|anxiety|cortisol|nervous system|calm/)) tags.push("stress");
  if (text.match(/qigong|taoist|monk|meditation|mindful|presence/)) tags.push("mindfulness");
  if (text.match(/focus|attention|productivity|time|energy/)) tags.push("focus");
  if (text.match(/functional medicine|health|wellness|vitality|healing/)) tags.push("functional medicine");
  if (text.match(/money|financial|finance/)) tags.push("financial wellness");
  if (text.match(/food|nutrition|diet|eating/)) tags.push("nutrition");
  if (medium === "podcast") tags.push("podcast appearance");
  if (medium === "broadcast") tags.push("tv appearance");
  if (medium === "print") tags.push("print media");
  if (tags.length === 0) tags.push("wellness", "mindfulness");
  return JSON.stringify([...new Set(tags)]);
}

// ── Helper: normalize medium ──────────────────────────────────────────────
function normalizeMedium(raw) {
  if (!raw) return "online";
  const r = raw.toLowerCase().trim();
  if (r.includes("podcast")) return "podcast";
  if (r.includes("broadcast") || r.includes("tv") || r.includes("television")) return "broadcast";
  if (r.includes("print")) return "print";
  if (r.includes("social") || r.includes("instagram") || r.includes("facebook")) return "social";
  if (r.includes("radio")) return "radio";
  return "online";
}

// ── Get existing press hits to avoid duplicates ───────────────────────────
const [existing] = await conn.execute("SELECT outlet, medium, coverageDate FROM press_hits");
const existingSet = new Set(existing.map(r => `${r.outlet.toLowerCase()}|${r.medium}|${r.coverageDate}`));
console.log(`Existing press hits in DB: ${existing.length}`);

// ── All new press records from both CSVs ──────────────────────────────────
// These are entries NOT already in the database based on our cross-reference.
// We checked all 115 existing entries and compile only the missing ones here.

const newPressHits = [
  // ── FROM: PedramShojaiPressCoverageTo-Date.xlsx-Sheet1.csv ──────────────
  // PRINT entries not yet in DB
  { outlet: "Live Happy", medium: "print", description: 'Featured The Art of Stopping Time and Pedram in a story titled "Time Keeps on Ticking"', impressionsLabel: "350,000", impressions: 350000, coverageDate: "10/24/2017", url: null, book: "The Art of Stopping Time" },
  { outlet: "Cosmopolitan", medium: "print", description: 'Includes Pedram and The Art of Stopping Time in a story titled "Om, No Thanks"', impressionsLabel: "10,509,387", impressions: 10509387, coverageDate: "10/1/2017", url: null, book: "The Art of Stopping Time" },
  { outlet: "Good Housekeeping", medium: "print", description: 'Featured Pedram in a story titled "Your 31-Day Guide to Living Happier and Healthier"', impressionsLabel: "15,102,591", impressions: 15102591, coverageDate: "1/1/2018", url: null, book: "The Art of Stopping Time" },
  { outlet: "Good Housekeeping", medium: "print", description: "Featured Pedram in a Good Housekeeping Summit recap and The Art of Stopping Time", impressionsLabel: "15,102,591", impressions: 15102591, coverageDate: "12/1/2017", url: null, book: "The Art of Stopping Time" },
  { outlet: "Marin Independent Journal", medium: "print", description: '"One man finds balance living like an urban monk"', impressionsLabel: "67,568", impressions: 67568, coverageDate: "3/22/2016", url: null, book: "The Urban Monk" },
  { outlet: "Columbus Dispatch", medium: "print", description: '"Finding Peace in Life"', impressionsLabel: "345,965", impressions: 345965, coverageDate: "3/20/2016", url: null, book: "The Urban Monk" },
  { outlet: "Roanoke Times", medium: "print", description: '"Live like an urban monk"', impressionsLabel: "76,830", impressions: 76830, coverageDate: "3/20/2016", url: null, book: "The Urban Monk" },
  { outlet: "Lansing State Journal", medium: "print", description: '"Urban monk preaches life of peace and tranquility"', impressionsLabel: "83,808", impressions: 83808, coverageDate: "3/19/2016", url: null, book: "The Urban Monk" },
  { outlet: "Pocono Record", medium: "print", description: '"Live like an urban monk"', impressionsLabel: "109,568", impressions: 109568, coverageDate: "3/17/2016", url: null, book: "The Urban Monk" },
  { outlet: "Detroit Free Press", medium: "print", description: '"The urban monk preaches life of peace and tranquility for everyone"', impressionsLabel: "4,420,322", impressions: 4420322, coverageDate: "3/15/2016", url: "http://www.freep.com/story/life/2016/03/15/urban-monk-preaches-life-peace-and-tranquility-everyone/81658756/", book: "The Urban Monk" },
  { outlet: "Lima News", medium: "print", description: '"Live like an urban monk"', impressionsLabel: "54,110", impressions: 54110, coverageDate: "3/15/2016", url: null, book: "The Urban Monk" },
  { outlet: "Post-Bulletin", medium: "print", description: '"Author helps you live like an urban monk"', impressionsLabel: "37,159", impressions: 37159, coverageDate: "3/14/2016", url: "http://www.postbulletin.com/life/lifestyles/live-like-an-urban-monk/article_991af5a0-1e90-5127-a07f-b6527e4c828a.html", book: "The Urban Monk" },
  { outlet: "The Press of Atlantic City", medium: "print", description: '"Being at peace with your life living like an urban monk"', impressionsLabel: "171,355", impressions: 171355, coverageDate: "3/14/2016", url: null, book: "The Urban Monk" },
  { outlet: "Times Union", medium: "print", description: '"Live like an urban monk"', impressionsLabel: "25,223", impressions: 25223, coverageDate: "3/13/2016", url: null, book: "The Urban Monk" },
  { outlet: "Belleville News-Democrat", medium: "print", description: '"How you can live like an urban monk"', impressionsLabel: "94,065", impressions: 94065, coverageDate: "3/13/2016", url: null, book: "The Urban Monk" },
  { outlet: "Merced Sun-Star", medium: "print", description: '"Urban Monk leader touts an easygoing life"', impressionsLabel: "44,635", impressions: 44635, coverageDate: "3/12/2016", url: null, book: "The Urban Monk" },
  { outlet: "Bicycling Magazine", medium: "print", description: '"Shred like a monk" — meditation tips for cyclists', impressionsLabel: "1,446,921", impressions: 1446921, coverageDate: "3/1/2016", url: "http://www.bicycling.com/culture/people/shred-like-a-monk-with-these-meditation-tips", book: "The Urban Monk" },
  { outlet: "LA Yoga", medium: "print", description: '"Media Review" of The Urban Monk', impressionsLabel: "182,000", impressions: 182000, coverageDate: "1/1/2016", url: null, book: "The Urban Monk" },
  { outlet: "Family Circle", medium: "print", description: '"Wake-up call" — energy boosters', impressionsLabel: "14,131,572", impressions: 14131572, coverageDate: "1/1/2016", url: null, book: "The Urban Monk" },
  { outlet: "Women's Health", medium: "print", description: '"Discuss! Juicy News, Convo Starters"', impressionsLabel: "5,379,990", impressions: 5379990, coverageDate: "1/1/2016", url: null, book: "The Urban Monk" },
  { outlet: "Health Magazine", medium: "print", description: '"Resolution (and body!) reboot"', impressionsLabel: "4,802,126", impressions: 4802126, coverageDate: "1/1/2016", url: null, book: "The Urban Monk" },
  { outlet: "SELF Magazine", medium: "print", description: '"(SELF) Worth" — featured Pedram', impressionsLabel: "5,305,580", impressions: 5305580, coverageDate: "12/1/2015", url: null, book: "The Urban Monk" },

  // ONLINE entries not yet in DB
  { outlet: "POPSUGAR", medium: "online", description: 'Featured in "Best Breathing Techniques for Anxiety, According to These Experts"', impressionsLabel: "19,156,417", impressions: 19156417, coverageDate: "8/9/2018", url: "https://www.popsugar.com/fitness/Breathing-Techniques-Anxiety-45057158", book: "The Art of Stopping Time" },
  { outlet: "Women's Health Online", medium: "online", description: "Featured in a story on micro mindfulness", impressionsLabel: "3,043,652", impressions: 3043652, coverageDate: "2/11/2018", url: "https://www.womenshealth.com.au/what-is-micro-mindfulness", book: "The Art of Stopping Time" },
  { outlet: "Elite Daily", medium: "online", description: "Featured in a story on ways to eliminate boredom in your daily routine", impressionsLabel: "10,169,862", impressions: 10169862, coverageDate: "6/19/2018", url: "https://www.elitedaily.com/p/the-best-ways-to-beat-boredom-are-hidden-in-your-everyday-routine-so-get-creative-9494856", book: "The Art of Stopping Time" },
  { outlet: "Bustle", medium: "online", description: 'Featured in "11 Healthy Daily Habits that are More Effective to do at Night vs. in the Morning"', impressionsLabel: "11,953,530", impressions: 11953530, coverageDate: "3/6/2018", url: "https://www.bustle.com/p/11-healthy-daily-habits-that-are-more-effective-to-do-at-night-vs-in-the-morning-8344805", book: "The Art of Stopping Time" },
  { outlet: "The Chalkboard Mag", medium: "online", description: 'Featured excerpt from The Art of Stopping Time: "The Art of Stopping Time: 5 Un-Resolutions for Busy People"', impressionsLabel: "530,000", impressions: 530000, coverageDate: "12/26/2017", url: "http://thechalkboardmag.com/the-art-of-stopping-time-pedram-shojai-excerpt", book: "The Art of Stopping Time" },
  { outlet: "Sonima", medium: "online", description: 'Featured article "4 Ways to Finish Your Year Strong"', impressionsLabel: "250,000", impressions: 250000, coverageDate: "12/20/2017", url: "http://www.sonima.com/meditation/mindful-living/end-the-year/", book: "The Art of Stopping Time" },
  { outlet: "LA Yoga", medium: "online", description: "Features a review of The Art of Stopping Time", impressionsLabel: "51,480", impressions: 51480, coverageDate: "12/11/2017", url: "https://layoga.com/entertainment/books-dvds/art-stopping-time-pedram-shojai/", book: "The Art of Stopping Time" },
  { outlet: "MyDomaine", medium: "online", description: "Featured The Art of Stopping Time and the writer's experience with following the gongs", impressionsLabel: "926,485", impressions: 926485, coverageDate: "11/27/2017", url: "http://www.mydomaine.com/how-to-slow-down/slide2", book: "The Art of Stopping Time" },
  { outlet: "The Every Girl", medium: "online", description: 'Repurposed The Zoe Report story on "3 Simple Hacks for Adding Time to Your Day"', impressionsLabel: "259,560", impressions: 259560, coverageDate: "11/13/2017", url: "http://theeverygirl.com/3-simple-hacks-for-adding-time-to-your-day/", book: "The Art of Stopping Time" },
  { outlet: "The Zoe Report", medium: "online", description: 'Featured Pedram and The Art of Stopping Time in "3 Simple Hacks For Adding Time To Your Day From A Former Taoist Monk"', impressionsLabel: "1,247,896", impressions: 1247896, coverageDate: "11/7/2017", url: "http://thezoereport.com/living/wellness/how-to-get-more-out-of-your-day/", book: "The Art of Stopping Time" },
  { outlet: "Yahoo! News", medium: "online", description: "Picked up The Zoe Report story on time management", impressionsLabel: "2,295,531", impressions: 2295531, coverageDate: "11/7/2017", url: "https://www.yahoo.com/news/3-simple-hacks-adding-time-173533597.html", book: "The Art of Stopping Time" },
  { outlet: "Spirituality & Health", medium: "online", description: 'Featured Pedram and The Art of Stopping Time in "3 Ways to Make Friends with Time"', impressionsLabel: "181,170", impressions: 181170, coverageDate: "11/7/2017", url: "https://spiritualityhealth.com/blogs/the-present-moment/2017/11/07/3-ways-to-make-friends-with-time", book: "The Art of Stopping Time" },
  { outlet: "Hearst.com", medium: "online", description: 'Included Pedram in post on Made Safe Summit "Raising the Green Bar: Your Roadmap to Sustainability & Success"', impressionsLabel: "144,300", impressions: 144300, coverageDate: "11/3/2017", url: "http://www.hearst.com/newsroom/raising-the-green-bar-your-roadmap-to-sustainability-success", book: "The Art of Stopping Time" },
  { outlet: "Well + Good", medium: "online", description: 'Featured Pedram in "Eat These Warming Foods for Perfectly Balanced Energy This Fall" — Qigong and nutrition advice', impressionsLabel: "3,120,951", impressions: 3120951, coverageDate: "11/1/2017", url: "https://www.wellandgood.com/good-food/qigong-advice-pedram-shojai-warming-foods-recipes/", book: "The Art of Stopping Time" },
  { outlet: "Women's Health Online", medium: "online", description: 'Featured Pedram and The Art of Stopping Time in "I Tried 10 Mindfulness Habits—Here\'s What Happened"', impressionsLabel: "3,043,652", impressions: 3043652, coverageDate: "10/25/2017", url: "https://www.womenshealthmag.com/health/mindfulness-techniques", book: "The Art of Stopping Time" },
  { outlet: "Bulletproof Radio (Dave Asprey)", medium: "podcast", description: 'Featured Pedram\'s interview on Prosperity and The Art of Stopping Time: "Spiritual Hygiene: Upgrade Your Personal Definition of Prosperity"', impressionsLabel: "100,000-125,000 downloads", impressions: 112500, coverageDate: "10/25/2017", url: "https://blog.bulletproof.com/spiritual-hygiene-upgrade-personal-definition-prosperity-pedram-shojai-440/", book: "The Art of Stopping Time" },
  { outlet: "Thrive Global", medium: "online", description: 'Featured The Art of Stopping Time and the "Nature" Gong — how spending time in nature changes perspective', impressionsLabel: "1,762,560", impressions: 1762560, coverageDate: "10/24/2017", url: "https://www.thriveglobal.com/stories/15602-a-former-monk-explains-how-spending-time-in-nature-can-change-how-you-see-the-world", book: "The Art of Stopping Time" },
  { outlet: "Rodale Wellness", medium: "online", description: "An excerpt of The Art of Stopping Time on cutting people who drain your time", impressionsLabel: "468,000", impressions: 468000, coverageDate: "10/10/2017", url: "https://www.rodalewellness.com/mind-spirit/why-you-should-cut-people-who-suck-your-time", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: 'Pedram\'s Playbook Series: "Can\'t Get Yourself to Meditate? You\'re Probably Making These Mistakes"', impressionsLabel: "19,140,903", impressions: 19140903, coverageDate: "10/5/2017", url: "https://www.inc.com/video/pedram-shojai/cant-get-yourself-to-meditate-youre-probably-making-these-mistakes.html", book: "The Art of Stopping Time" },
  { outlet: "Hallmark Channel (Home & Family)", medium: "broadcast", description: "Featured Pedram in a segment discussing The Art of Stopping Time and Prosperity", impressionsLabel: "230,340", impressions: 230340, coverageDate: "10/4/2017", url: "http://www.hallmarkchannel.com/home-and-family/wednesday-october-4th-2017", book: "The Art of Stopping Time" },
  { outlet: "The Ultimate Health Podcast", medium: "podcast", description: "Featured Pedram's interview on The Ultimate Health Podcast", impressionsLabel: "30,000-70,000 episode downloads", impressions: 50000, coverageDate: "9/27/2017", url: "http://ultimatehealthpodcast.com/pedram-shojai/", book: "The Art of Stopping Time" },
  { outlet: "Reader's Digest", medium: "online", description: 'Included Pedram in "If You Don\'t Ask Yourself These 4 Questions, You\'re Wasting Money Every Time You Shop"', impressionsLabel: "3,506,108", impressions: 3506108, coverageDate: "9/21/2017", url: "https://www.rd.com/advice/saving-money/how-to-save-money-when-you-shop/", book: "The Art of Stopping Time" },
  { outlet: "Rodale Wellness", medium: "online", description: "Article written by Pedram on boredom — when was the last time you were bored?", impressionsLabel: "112,000", impressions: 112000, coverageDate: "9/14/2017", url: "https://www.rodalewellness.com/mind-spirit/when-last-time-bored", book: "The Art of Stopping Time" },
  { outlet: "Bicycling", medium: "online", description: "Featured Pedram Shojai's tips on finding more time to ride", impressionsLabel: "1,166,673", impressions: 1166673, coverageDate: "9/12/2017", url: "https://www.bicycling.com/training/ride/how-to-make-more-time-to-ride-advice-from-the-urban-monk/slide/1", book: "The Art of Stopping Time" },
  { outlet: "Reader's Digest", medium: "online", description: 'Featured Pedram in a story on "bad" habits for children', impressionsLabel: "3,506,108", impressions: 3506108, coverageDate: "8/21/2017", url: "http://www.rd.com/advice/parenting/bad-childhood-habits/", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: 'Pedram\'s Playbook Series: "Forget About Your Career — How to Build a Sustainable Life" (Managing Burnout)', impressionsLabel: "19,140,903", impressions: 19140903, coverageDate: "8/9/2017", url: "https://www.inc.com/video/pedram-shojai/forget-about-your-career-how-to-build-a-sustainable-life.html", book: "The Art of Stopping Time" },
  { outlet: "Inc. Magazine (Playbook Series)", medium: "online", description: 'Pedram\'s Playbook Series: "This Is the Single Most Counterproductive Productivity Tool" (To Do List Overwhelm)', impressionsLabel: "19,140,903", impressions: 19140903, coverageDate: "7/26/2017", url: "https://www.inc.com/video/pedram-shojai/this-is-the-single-most-counterproductive-productivity-tool.html", book: "The Art of Stopping Time" },
  { outlet: "Sioux City Journal", medium: "online", description: '"Best-selling author lives life like an urban monk"', impressionsLabel: "213,960", impressions: 213960, coverageDate: "3/21/2016", url: "http://siouxcityjournal.com/entertainment/books-and-literature/best-selling-author-lives-life-like-an-urban-monk/article_c9ea7d8e-5304-541f-9a65-df99375d352d.html", book: "The Urban Monk" },
  { outlet: "Columbus Dispatch", medium: "online", description: '"Wellness guru Pedram Shojai has built an empire"', impressionsLabel: "1,352,348", impressions: 1352348, coverageDate: "3/20/2016", url: "http://www.dispatch.com/content/stories/life_and_entertainment/2016/03/20/1-wellness-guru-has-built-an-empire.html", book: "The Urban Monk" },
  { outlet: "In USA News", medium: "online", description: '"The urban monk preaches life of peace and tranquility for everyone"', impressionsLabel: "26,394", impressions: 26394, coverageDate: "3/15/2016", url: "https://www.inusanews.com/article/21020451509/preaches-tranquility", book: "The Urban Monk" },
  { outlet: "The Daily Gazette", medium: "online", description: '"Meditation, exercise, good diet all part of life of Urban Monk"', impressionsLabel: "80,496", impressions: 80496, coverageDate: "3/12/2016", url: "https://dailygazette.com/article/2016/03/12/monk", book: "The Urban Monk" },
  { outlet: "Detroit News", medium: "online", description: '"Live like an urban monk"', impressionsLabel: "1,386,933", impressions: 1386933, coverageDate: "3/11/2016", url: "http://www.detroitnews.com/story/news/religion/2016/03/11/live-like-urban-monk/81668438/", book: "The Urban Monk" },
  { outlet: "Rodale's Organic Life", medium: "online", description: '"How our paleo past may be the blame for modern materialism"', impressionsLabel: "566,942", impressions: 566942, coverageDate: "3/10/2016", url: "http://www.rodalesorganiclife.com/wellbeing/how-our-paleo-past-may-be-to-blame-for-modern-materialism", book: "The Urban Monk" },
  { outlet: "Orange County Register", medium: "online", description: '"Live like an urban monk"', impressionsLabel: "1,032,348", impressions: 1032348, coverageDate: "3/6/2016", url: "http://www.ocregister.com/articles/shojai-706789-monk-life.html", book: "The Urban Monk" },
  { outlet: "Bicycling Magazine", medium: "online", description: '"Shred like a monk" — meditation tips for cyclists', impressionsLabel: "271,163", impressions: 271163, coverageDate: "2/26/2016", url: "http://www.bicycling.com/culture/people/shred-like-a-monk-with-these-meditation-tips", book: "The Urban Monk" },
  { outlet: "Natural Health 365", medium: "online", description: '"The Urban Monk: Protection against stress in the modern world"', impressionsLabel: "108,138", impressions: 108138, coverageDate: "2/22/2016", url: "http://www.naturalhealth365.com/stress-lifestyle-1751.html", book: "The Urban Monk" },
  { outlet: "The New York Times", medium: "print", description: '"Best Sellers" list — The Urban Monk debuted on NYT Bestseller list', impressionsLabel: "42,381,039", impressions: 42381039, coverageDate: "2/21/2016", url: "https://www.nytimes.com/books/best-sellers/2016/02/21/advice-how-to-and-miscellaneous/", book: "The Urban Monk" },
  { outlet: "Fat-Burning Man", medium: "online", description: '"Pedram Shojai on how to reverse adrenal burnout and pumpkin pie"', impressionsLabel: "121,091", impressions: 121091, coverageDate: "2/19/2016", url: "http://fatburningman.com/dr-pedram-shojai-the-urban-monk-how-to-reverse-adrenal-burnout-and-pumpkin-pie/", book: "The Urban Monk" },
  { outlet: "Niecyisms & Nestlings", medium: "online", description: '"Wisdom and words to live by from the Urban Monk"', impressionsLabel: "9,120", impressions: 9120, coverageDate: "2/17/2016", url: "http://www.niecyisms.com/2016/02/wisdom-and-words-to-live-by-from-urban.html", book: "The Urban Monk" },
  { outlet: "Rodale's", medium: "online", description: '"10 Things You didn\'t know about meditation"', impressionsLabel: "68,645", impressions: 68645, coverageDate: "2/16/2016", url: "https://www.rodales.com/about/green-living/meditation/", book: "The Urban Monk" },
  { outlet: "Thyroid Pharmacist", medium: "online", description: '"Autoimmune Thyroid Disease and Anxiety" — featuring Pedram\'s insights', impressionsLabel: "54,018", impressions: 54018, coverageDate: "2/11/2016", url: "https://thyroidpharmacist.com/articles/autoimmune-thyroid-disease-and-anxiety/", book: "The Urban Monk" },
  { outlet: "JJ Virgin", medium: "online", description: '"The Urban Monk, finding stillness amidst the chaos"', impressionsLabel: null, impressions: null, coverageDate: "2/6/2016", url: "http://jjvirgin.com/the-urban-monk-finding-stillness-amidst-the-chaos/", book: "The Urban Monk" },
  { outlet: "Food Matters", medium: "online", description: '"Stressed? Ancient Wisdom You Should Know from a Taoist Monk"', impressionsLabel: "291,100", impressions: 291100, coverageDate: "2/5/2016", url: "http://www.foodmatters.com/article/stressed-ancient-wisdom-you-should-know-from-a-taoist-monk", book: "The Urban Monk" },
  { outlet: "Spark People", medium: "online", description: '"Good book to get on track" — featured The Urban Monk', impressionsLabel: "2,487,300", impressions: 2487300, coverageDate: "2/4/2016", url: "http://www.sparkpeople.com/mypage_public_journal_individual.asp?blog_id=6087734", book: "The Urban Monk" },
  { outlet: "Mind Body Green", medium: "online", description: '"A Simple Mindful Eating Practice to Give You Energy + Balance"', impressionsLabel: "2,225,574", impressions: 2225574, coverageDate: "2/2/2016", url: "http://www.mindbodygreen.com/0-23572/a-simple-mindful-eating-practice-to-give-you-energy-balance.html", book: "The Urban Monk" },
  { outlet: "Yahoo! Health", medium: "online", description: '"Is Sleep the Key to Monk-Like Wisdom?"', impressionsLabel: "230,245", impressions: 230245, coverageDate: "2/2/2016", url: "https://www.yahoo.com/beauty/is-sleep-the-key-to-monk-like-wisdom-120055832.html", book: "The Urban Monk" },
  { outlet: "Deseret News National", medium: "online", description: '"Doctor who met the Dalai Lama shares his advice on how to become a better parent"', impressionsLabel: "160,806", impressions: 160806, coverageDate: "2/2/2016", url: null, book: "The Urban Monk" },
  { outlet: "Brit + Co", medium: "online", description: '"14 New Books out in Feb that You need to Read"', impressionsLabel: "1,878,808", impressions: 1878808, coverageDate: "2/2/2016", url: "http://www.brit.co/new-books-out-february/", book: "The Urban Monk" },
  { outlet: "Good Reads", medium: "online", description: '"Top Reviews: The Urban Monk" — featured reader reviews and coverage', impressionsLabel: "13,628,726", impressions: 13628726, coverageDate: "2/2/2016", url: "http://www.goodreads.com/review/show/1535359707", book: "The Urban Monk" },
  { outlet: "The Sacred Science", medium: "online", description: '"A Taoist Priest Shares 9 Secrets of his life"', impressionsLabel: "22,114", impressions: 22114, coverageDate: "1/27/2016", url: "http://www.thesacredscience.com/a-taoist-priest-shares-9-secrets-of-life/", book: "The Urban Monk" },
  { outlet: "New York Post", medium: "online", description: '"5 Tips for de-stressing from a foul-mouthed monk"', impressionsLabel: "1,193,285", impressions: 1193285, coverageDate: "1/26/2016", url: "http://nypost.com/2016/01/26/5-tips-for-de-stressing-from-a-foul-mouthed-monk/", book: "The Urban Monk" },
  { outlet: "Women's Health (Spain)", medium: "online", description: '"9 Health, Fitness and Nutrition Tips from a Real-Life Monk" (Spanish edition)', impressionsLabel: null, impressions: null, coverageDate: "1/20/2016", url: "http://www.womenshealth.es/vida/articulo/9-tips-de-salud-fitness-y-nutricion-de-un-monje-urbano", book: "The Urban Monk" },
  { outlet: "Women's Health", medium: "online", description: '"9 Health, Fitness and Nutrition Tips from a Real-Life Monk"', impressionsLabel: "2,124,184", impressions: 2124184, coverageDate: "1/15/2016", url: "http://www.womenshealthmag.com/health/urban-monk-advice", book: "The Urban Monk" },
  { outlet: "Rodale Wellness", medium: "online", description: '"Materialistic? Blame your inner caveman"', impressionsLabel: "134,013", impressions: 134013, coverageDate: "1/14/2016", url: "http://www.rodalewellness.com/mind-spirit/materialistic-blame-your-inner-caveman", book: "The Urban Monk" },
  { outlet: "Rodale Wellness", medium: "online", description: '"10 Prebiotic Foods for Optimum Gut Health" — featuring Pedram\'s gut health expertise', impressionsLabel: "134,013", impressions: 134013, coverageDate: "1/8/2016", url: "http://www.rodalewellness.com/food/10-prebiotic-foods-for-optimum-gut-health", book: "The Urban Monk" },
  { outlet: "Latinos Health", medium: "online", description: '"Meditation for beginners: 5 ways to start meditating in 2016"', impressionsLabel: "153,018", impressions: 153018, coverageDate: "1/7/2016", url: "http://www.latinoshealth.com/articles/15139/20160107/meditation-for-beginners-5-ways-to-start-meditating-in-2016.htm", book: "The Urban Monk" },
  { outlet: "The Dr. Oz Show", medium: "broadcast", description: '"Fall asleep instantly with this pre-bedtime technique" — Pedram featured on The Dr. Oz Show', impressionsLabel: "1,308,786", impressions: 1308786, coverageDate: "1/6/2016", url: "http://www.doctoroz.com/episode/power-plan-stop-insomnia-so-you-can-sleep", book: "The Urban Monk" },
  { outlet: "New York Magazine / The Cut", medium: "online", description: '"Easy ways to start meditating at home"', impressionsLabel: "5,770,505", impressions: 5770505, coverageDate: "1/4/2016", url: "http://nymag.com/thecut/2016/01/how-to-meditate-meditation-for-beginners.html", book: "The Urban Monk" },
  { outlet: "Rewire Me", medium: "online", description: '"How to start the New Year right" — featuring Pedram\'s advice', impressionsLabel: "200,000", impressions: 200000, coverageDate: "1/4/2016", url: "https://www.rewireme.com/happiness/start-new-year-right/", book: "The Urban Monk" },
  { outlet: "CNN.com", medium: "online", description: '"21 achievable New Year\'s resolutions for your health" — Pedram featured', impressionsLabel: "67,090,860", impressions: 67090860, coverageDate: "1/1/2016", url: "http://www.cnn.com/2016/01/01/health/new-years-resolutions-health/", book: "The Urban Monk" },
  { outlet: "Well + Good", medium: "online", description: '"How to survive the holiday party season like a Buddhist"', impressionsLabel: "229,922", impressions: 229922, coverageDate: "12/19/2015", url: "https://www.wellandgood.com/good-advice/how-to-survive-holiday-party-season/", book: "The Urban Monk" },
  { outlet: "Mind Body Green", medium: "online", description: '"10 tips to actually achieve your dreams next year"', impressionsLabel: "1,854,427", impressions: 1854427, coverageDate: "12/13/2015", url: "http://www.mindbodygreen.com/0-22878/10-tips-to-actually-achieve-your-dreams-next-year.html", book: "The Urban Monk" },
  { outlet: "Rodale's Organic Life", medium: "online", description: '"10 Things You didn\'t know about meditation"', impressionsLabel: "549,329", impressions: 549329, coverageDate: "11/26/2015", url: "http://www.rodalesorganiclife.com/wellbeing/10-things-you-didnt-know-about-meditation", book: "The Urban Monk" },
  { outlet: "Huffington Post", medium: "online", description: '"17 Positive Habits that will change your life" — featuring Pedram\'s insights', impressionsLabel: "46,029,910", impressions: 46029910, coverageDate: "11/3/2015", url: "http://www.huffingtonpost.com/maria-rodale/17-positive-habits-that-w_b_8454336.html", book: "The Urban Monk" },
];

// ── Filter out duplicates ─────────────────────────────────────────────────
const toInsert = newPressHits.filter(hit => {
  const key = `${hit.outlet.toLowerCase()}|${hit.medium}|${hit.coverageDate}`;
  return !existingSet.has(key);
});

console.log(`\nNew records to insert: ${toInsert.length} (skipping ${newPressHits.length - toInsert.length} duplicates)`);

// ── Insert in batches ─────────────────────────────────────────────────────
let inserted = 0;
let skipped = 0;

for (const hit of toInsert) {
  const tier = getTier(hit.outlet, hit.impressions);
  const tags = getTopicTags(hit.outlet, hit.description, hit.medium);
  
  try {
    await conn.execute(
      `INSERT INTO press_hits (outlet, medium, description, impressions, impressionsLabel, coverageDate, url, topicTags, authorityTier, book)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hit.outlet,
        hit.medium,
        hit.description || null,
        hit.impressions || null,
        hit.impressionsLabel || null,
        hit.coverageDate || null,
        hit.url || null,
        tags,
        tier,
        hit.book || null,
      ]
    );
    inserted++;
    console.log(`  ✓ [${tier}] ${hit.outlet} (${hit.medium}) — ${hit.coverageDate}`);
  } catch (err) {
    console.error(`  ✗ Failed: ${hit.outlet} — ${err.message}`);
    skipped++;
  }
}

console.log(`\n✅ Import complete: ${inserted} inserted, ${skipped} failed`);

// ── Final count ───────────────────────────────────────────────────────────
const [countRows] = await conn.execute("SELECT COUNT(*) as total, authorityTier FROM press_hits GROUP BY authorityTier");
console.log("\nFinal press_hits counts by tier:");
countRows.forEach(r => console.log(`  Tier ${r.authorityTier}: ${r.total}`));

const [totalRow] = await conn.execute("SELECT COUNT(*) as total FROM press_hits");
console.log(`  TOTAL: ${totalRow[0].total}`);

await conn.end();
