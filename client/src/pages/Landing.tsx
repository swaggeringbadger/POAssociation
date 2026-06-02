import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation, Link } from "wouter";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  Home,
  LayoutDashboard,
  Shield,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import heroImage from "@assets/generated_images/hero-porch-golden-hour.jpg";
import doorImage from "@assets/generated_images/section-architectural-door.jpg";
import kitchenImage from "@assets/generated_images/section-kitchen-plans.jpg";
import boardImage from "@assets/generated_images/section-board-table.jpg";
import walkImage from "@assets/generated_images/section-evening-walk.jpg";
import ctaImage from "@assets/generated_images/cta-stringlights-band.jpg";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";
import { ContactModal } from "@/components/ContactModal";
import { CommunitySearch } from "@/components/CommunitySearch";

/* ------------------------------------------------------------------ */
/*  Scroll-reveal helper                                              */
/* ------------------------------------------------------------------ */
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
  },
};

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Navbar — transparent over hero, warms to solid on scroll          */
/* ------------------------------------------------------------------ */
function Navbar({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-stone-50/85 backdrop-blur-md border-b border-stone-200/70 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-9 w-9 rounded-lg ring-1 ring-black/5" />
          <span
            className={`text-xl font-bold font-display tracking-tight transition-colors ${
              scrolled ? "text-stone-900" : "text-white drop-shadow"
            }`}
          >
            POAssociation
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[
            { href: "#story", label: "Why us" },
            { href: "#features", label: "Features" },
            { href: "#solutions", label: "Solutions" },
            { href: "#pricing", label: "Pricing" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                scrolled
                  ? "text-stone-600 hover:text-amber-700"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/demo")}
            className={`hidden sm:inline-flex ${
              scrolled ? "text-stone-700 hover:text-amber-700" : "text-white hover:bg-white/10 hover:text-white"
            }`}
          >
            Demo code
          </Button>
          <Button
            onClick={() => (window.location.href = "/login")}
            data-testid="button-login"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
          >
            Sign in <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero — full-bleed cinematic, parallax, editorial headline         */
/* ------------------------------------------------------------------ */
function HeroSection({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [1, 1.35]);

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] overflow-hidden">
      {/* Image layer with parallax */}
      <motion.div style={{ y, scale }} className="absolute inset-0 will-change-transform">
        <img
          src={heroImage}
          alt="Neighbors sharing a warm moment on a front porch at golden hour"
          className="h-full w-full object-cover object-center"
        />
      </motion.div>

      {/* Warm cinematic scrims */}
      <motion.div
        style={{ opacity: overlayOpacity }}
        className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/35 to-stone-950/40"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-transparent to-transparent" />
      {/* Warm color wash to unify any cool tones */}
      <div className="absolute inset-0 bg-amber-900/10 mix-blend-multiply" />

      {/* Content */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-20 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-sm font-medium text-amber-50 ring-1 ring-white/20 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Now with AI-powered architectural review
          </span>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold text-white leading-[1.04] tracking-tight">
            Every home has a story.
            <br />
            <span className="italic text-amber-200 font-light">
              Help your community write a better one.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-stone-100/90 max-w-2xl leading-relaxed">
            The all-in-one platform for HOAs, POAs, and management companies —
            architectural reviews, compliance, and resident life, handled with care.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              className="text-base px-8 h-13 py-6 bg-amber-600 hover:bg-amber-700 text-white shadow-xl shadow-amber-900/30"
              onClick={() => (window.location.href = "/login")}
              data-testid="button-get-started"
            >
              Get started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 h-13 py-6 bg-white/5 backdrop-blur border-white/30 text-white hover:bg-white/15 hover:text-white"
              onClick={onScheduleDemo}
            >
              Take a guided tour
            </Button>
          </div>

          <p className="mt-6 text-sm text-stone-200/80">
            …or{" "}
            <Link href="/demo" className="underline underline-offset-4 hover:text-amber-200">
              explore the sandbox with a demo code
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2"
      >
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="h-9 w-5 rounded-full border border-white/40 flex items-start justify-center p-1"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Manifesto / emotional reframe                                     */
/* ------------------------------------------------------------------ */
function ManifestoSection() {
  return (
    <section id="story" className="bg-stone-50 py-24 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 mb-6">
            Community management, with a soul
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="font-display text-3xl sm:text-5xl font-medium text-stone-900 leading-[1.12]">
            A neighborhood isn&apos;t paperwork. It&apos;s a{" "}
            <span className="italic text-amber-700">porch light left on</span>, a fence mended,
            a hundred small decisions made with care.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 text-lg sm:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto">
            Most HOA software treats your community like a database. We built POAssociation to
            treat it like a place people love — keeping the rigor of great software, but giving
            back the warmth of a great neighbor.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-stone-200 pt-12">
            {[
              { value: "9", label: "Roles, one platform" },
              { value: "AI", label: "Reviews & forms" },
              { value: "Multi", label: "Community ready" },
              { value: "Real-time", label: "Workflow tracking" },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl sm:text-4xl font-semibold text-stone-900">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-stone-500">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Story rows — alternating cinematic image + product narrative      */
/* ------------------------------------------------------------------ */
type Story = {
  image: string;
  alt: string;
  flip?: boolean;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  tone: string; // accent gradient classes
};

const stories: Story[] = [
  {
    image: doorImage,
    alt: "A homeowner holding paint swatches against their house siding",
    eyebrow: "Architectural review",
    title: (
      <>
        Guidance, <span className="italic text-amber-700">not gatekeeping</span>.
      </>
    ),
    body:
      "Generate beautiful application forms straight from your bylaws, with the relevant covenant quoted right beside every question. Homeowners get it right the first time — and feel helped, not policed.",
    points: [
      "AI-generated forms from your governing documents",
      "Inline bylaw guidance on every field",
      "Fewer back-and-forths, faster approvals",
    ],
    tone: "from-amber-500/20 to-orange-500/10",
  },
  {
    image: kitchenImage,
    alt: "A couple reviewing a deck plan at a sunlit kitchen table",
    flip: true,
    eyebrow: "For homeowners",
    title: (
      <>
        Submit from the <span className="italic text-amber-700">kitchen table</span>.
      </>
    ),
    body:
      "No printing, no confusing PDFs. Residents start a request on any device, snap photos straight from their phone via QR code, and track every step — all without leaving the couch.",
    points: [
      "Mobile-first submissions with photo upload",
      "Real-time status, start to approval",
      "A self-service portal residents actually enjoy",
    ],
    tone: "from-rose-400/20 to-amber-400/10",
  },
  {
    image: boardImage,
    alt: "Neighbors reviewing house plans together by warm lamplight",
    eyebrow: "For boards & committees",
    title: (
      <>
        Decide together, <span className="italic text-amber-700">decide fairly</span>.
      </>
    ),
    body:
      "AI analysis surfaces what matters, custom workflows route the right reviews to the right people, and a secure board portal keeps votes, agendas, and minutes in one calm place.",
    points: [
      "AI-powered analysis of every request",
      "Custom multi-step approval workflows",
      "Meeting agendas, minutes & roll call built in",
    ],
    tone: "from-emerald-400/20 to-amber-400/10",
  },
  {
    image: walkImage,
    alt: "A parent and child walking a dog down a golden-hour neighborhood street",
    flip: true,
    eyebrow: "Compliance & community",
    title: (
      <>
        Protect the place <span className="italic text-amber-700">you love</span>.
      </>
    ),
    body:
      "Never miss a filing deadline, insurance renewal, or annual meeting. Stay ahead of state requirements and keep every resident in the loop — so the neighborhood stays the one everyone wanted to move into.",
    points: [
      "Deadline, renewal & state-requirement tracking",
      "Calendar, events & resident communications",
      "Document storage with the right access controls",
    ],
    tone: "from-amber-400/20 to-yellow-400/10",
  },
];

function StoryRow({ story, index }: { story: Story; index: number }) {
  return (
    <div
      className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
        story.flip ? "lg:[direction:rtl]" : ""
      }`}
    >
      {/* Image */}
      <Reveal className={`${story.flip ? "lg:[direction:ltr]" : ""}`}>
        <div className="relative group">
          <div
            className={`absolute -inset-3 sm:-inset-5 rounded-[2rem] bg-gradient-to-br ${story.tone} blur-2xl opacity-70 transition-opacity group-hover:opacity-100`}
          />
          <div className="relative overflow-hidden rounded-2xl sm:rounded-[1.75rem] ring-1 ring-stone-900/10 shadow-2xl shadow-stone-900/20">
            <img
              src={story.image}
              alt={story.alt}
              className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/10 to-transparent" />
          </div>
        </div>
      </Reveal>

      {/* Copy */}
      <Reveal delay={0.08} className={`${story.flip ? "lg:[direction:ltr]" : ""}`}>
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display text-sm font-semibold text-amber-700">
              0{index + 1}
            </span>
            <span className="h-px w-10 bg-amber-300" />
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">
              {story.eyebrow}
            </span>
          </div>
          <h3 className="font-display text-3xl sm:text-4xl font-medium text-stone-900 leading-tight">
            {story.title}
          </h3>
          <p className="mt-5 text-lg text-stone-600 leading-relaxed">{story.body}</p>
          <ul className="mt-7 space-y-3">
            {story.points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-stone-700">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

function StorySections() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28 sm:space-y-36">
        {stories.map((story, i) => (
          <StoryRow key={i} story={story} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Capabilities grid                                                 */
/* ------------------------------------------------------------------ */
function FeaturesSection() {
  const features = [
    { icon: Brain, title: "AI-Powered Forms", description: "Generate application forms from your bylaws and covenants automatically." },
    { icon: GitBranch, title: "Smart Workflows", description: "Multi-step routing, parallel reviews, and automated notifications." },
    { icon: LayoutDashboard, title: "Board Portal", description: "A secure space to review, vote, and track decisions." },
    { icon: Shield, title: "Compliance Tracking", description: "Deadlines, renewals, meetings, and state requirements in one place." },
    { icon: FileText, title: "Document Management", description: "Secure cloud storage with organized uploads and access controls." },
    { icon: Calendar, title: "Calendar & Events", description: "Schedule meetings, send invites, and manage agendas." },
    { icon: Smartphone, title: "Mobile-First", description: "Upload photos via QR, submit and review from any device." },
    { icon: Building2, title: "Multi-Community", description: "Run many HOAs or POAs from one role-aware dashboard." },
  ];

  return (
    <section id="features" className="bg-stone-50 py-24 sm:py-32 border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Reveal>
            <Badge variant="outline" className="mb-4 border-amber-300 text-amber-700 bg-amber-50">
              Everything in one place
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display text-3xl sm:text-5xl font-medium text-stone-900">
              Everything you need to run a community
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg text-stone-600">
              Powerful, role-aware tools — without the cold, corporate feel.
            </p>
          </Reveal>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 4) * 0.05}>
              <div className="group h-full rounded-2xl bg-white p-6 ring-1 ring-stone-200 hover:ring-amber-300 hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-stone-600">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Solutions                                                         */
/* ------------------------------------------------------------------ */
function SolutionsSection() {
  const solutions = [
    {
      icon: Building2,
      title: "For Management Companies",
      description: "Streamline operations across your entire portfolio",
      features: [
        "Manage multiple communities from one dashboard",
        "Assign property reps to specific communities",
        "Credit-based billing with invoice management",
        "Customizable community landing pages",
        "Team management with role-based access",
        "Centralized document storage",
      ],
    },
    {
      icon: Home,
      title: "For HOA/POA Boards",
      description: "Modernize your community governance",
      features: [
        "Simple application submission for homeowners",
        "AI-powered analysis of architectural requests",
        "Automated compliance reminders",
        "Meeting management with agendas & minutes",
        "Transparent communication with residents",
        "Self-service resident portal",
      ],
    },
  ];

  return (
    <section id="solutions" className="bg-white py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Reveal>
            <Badge variant="outline" className="mb-4 border-amber-300 text-amber-700 bg-amber-50">
              Solutions
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display text-3xl sm:text-5xl font-medium text-stone-900">
              Built for your side of the fence
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg text-stone-600">
              Whether you manage one community or a hundred, we have you covered.
            </p>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {solutions.map((solution, i) => (
            <Reveal key={solution.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl bg-stone-50 p-8 ring-1 ring-stone-200 hover:ring-amber-300 transition-all">
                <div className="flex items-start gap-4 mb-6">
                  <div className="h-14 w-14 rounded-xl bg-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-900/20">
                    <solution.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-stone-900 mb-1">
                      {solution.title}
                    </h3>
                    <p className="text-stone-600">{solution.description}</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-stone-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                           */
/* ------------------------------------------------------------------ */
function PricingSection({ onContact }: { onContact: () => void }) {
  const tiers = [
    { name: "Small", doors: "1-50", price: "$29", period: "/month", description: "Perfect for small communities", credits: "10 credits/month", overageCost: "$2.00/credit", popular: false },
    { name: "Medium", doors: "51-150", price: "$79", period: "/month", description: "For growing communities", credits: "25 credits/month", overageCost: "$1.75/credit", popular: true },
    { name: "Large", doors: "151-500", price: "$149", period: "/month", description: "For established communities", credits: "50 credits/month", overageCost: "$1.50/credit", popular: false },
    { name: "Extra Large", doors: "501+", price: "$299", period: "/month", description: "For large communities", credits: "100 credits/month", overageCost: "$1.25/credit", popular: false },
  ];
  const sharedFeatures = ["All features included", "Custom workflows", "AI analysis & forms", "Compliance tracking"];

  return (
    <section id="pricing" className="bg-stone-50 py-24 sm:py-32 border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Reveal>
            <Badge variant="outline" className="mb-4 border-amber-300 text-amber-700 bg-amber-50">
              Pricing
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display text-3xl sm:text-5xl font-medium text-stone-900">
              Simple, door-based pricing
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg text-stone-600">
              Choose your plan by community size. Every plan includes every feature.
            </p>
          </Reveal>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={(i % 4) * 0.05}>
              <div
                className={`relative flex flex-col h-full rounded-2xl bg-white p-6 transition-all ${
                  tier.popular
                    ? "ring-2 ring-amber-500 shadow-xl shadow-amber-900/10 lg:scale-[1.03]"
                    : "ring-1 ring-stone-200 hover:ring-amber-300"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow">
                    Most Popular
                  </span>
                )}
                <div className="pb-4">
                  <h3 className="font-display text-lg font-semibold text-stone-900">{tier.name}</h3>
                  <p className="text-sm text-stone-500">{tier.doors} doors</p>
                  <div className="pt-4">
                    <span className="font-display text-4xl font-semibold text-stone-900">{tier.price}</span>
                    <span className="text-stone-500">{tier.period}</span>
                  </div>
                  <p className="text-sm text-stone-500 pt-2">{tier.description}</p>
                </div>
                <div className="flex-1">
                  <div className="mb-4 flex flex-col gap-1">
                    <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      <Zap className="h-3 w-3 mr-1" />
                      {tier.credits}
                    </span>
                    <span className="text-xs text-stone-500">Overage: {tier.overageCost}</span>
                  </div>
                  <ul className="space-y-3">
                    {sharedFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-stone-700">
                        <Check className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-6 mt-auto">
                  <Button
                    className={`w-full ${
                      tier.popular
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-stone-900 hover:bg-stone-800 text-white"
                    }`}
                    onClick={() => (window.location.href = "/login")}
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="text-center text-sm text-stone-500 mt-10">
          Need a custom plan?{" "}
          <button onClick={onContact} className="text-amber-700 hover:underline font-medium">
            Contact us
          </button>{" "}
          for enterprise pricing.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA band — string lights                                          */
/* ------------------------------------------------------------------ */
function CTASection({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <img src={ctaImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-stone-950/75" />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-stone-950/80" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 text-center">
        <Reveal>
          <h2 className="font-display text-3xl sm:text-5xl font-medium text-white leading-tight">
            Ready to leave the porch light on?
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 text-lg text-stone-200/90 max-w-2xl mx-auto">
            See how POAssociation brings warmth and rigor to your architectural reviews,
            compliance, and community — in one place.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-base px-8 py-6 bg-amber-600 hover:bg-amber-700 text-white shadow-xl shadow-amber-900/40"
              onClick={onScheduleDemo}
            >
              Schedule a demo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 bg-white/5 backdrop-blur border-white/30 text-white hover:bg-white/15 hover:text-white"
              onClick={() => (window.location.href = "/login")}
            >
              Sign in
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                            */
/* ------------------------------------------------------------------ */
function Footer({ onContact, onScheduleDemo }: { onContact: () => void; onScheduleDemo: () => void }) {
  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logoImage} alt="Logo" className="h-9 w-9 rounded-lg ring-1 ring-white/10" />
              <span className="font-display font-bold text-white">POAssociation</span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              Community management with the warmth of a great neighbor.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#features" className="text-stone-400 hover:text-amber-300 transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-stone-400 hover:text-amber-300 transition-colors">Pricing</a></li>
              <li><button onClick={onScheduleDemo} className="text-stone-400 hover:text-amber-300 transition-colors">Demo</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Solutions</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#solutions" className="text-stone-400 hover:text-amber-300 transition-colors">Management Companies</a></li>
              <li><a href="#solutions" className="text-stone-400 hover:text-amber-300 transition-colors">HOA Boards</a></li>
              <li><a href="#solutions" className="text-stone-400 hover:text-amber-300 transition-colors">POA Boards</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/security" className="text-stone-400 hover:text-amber-300 transition-colors">Security</Link></li>
              <li><Link href="/legal" className="text-stone-400 hover:text-amber-300 transition-colors">Legal</Link></li>
              <li><Link href="/about" className="text-stone-400 hover:text-amber-300 transition-colors">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="text-stone-400 hover:text-amber-300 transition-colors">About</Link></li>
              <li><button onClick={onContact} className="text-stone-400 hover:text-amber-300 transition-colors">Contact</button></li>
              <li><Link href="/security" className="text-stone-400 hover:text-amber-300 transition-colors">Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-stone-500">
            &copy; {new Date().getFullYear()} POAssociation. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            <Link href="/legal?tab=privacy" className="text-sm text-stone-500 hover:text-amber-300 transition-colors">Privacy Policy</Link>
            <Link href="/legal?tab=terms" className="text-sm text-stone-500 hover:text-amber-300 transition-colors">Terms of Service</Link>
            <Link href="/legal" className="text-sm text-stone-500 hover:text-amber-300 transition-colors">Legal</Link>
            <Link href="/security" className="text-sm text-stone-500 hover:text-amber-300 transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<"contact" | "demo">("contact");

  const openContactModal = () => {
    setContactMode("contact");
    setContactModalOpen(true);
  };
  const openDemoModal = () => {
    setContactMode("demo");
    setContactModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <Navbar onScheduleDemo={openDemoModal} />
      <HeroSection onScheduleDemo={openDemoModal} />
      <ManifestoSection />
      <StorySections />
      <div className="bg-white">
        <CommunitySearch onSignupClick={openDemoModal} />
      </div>
      <FeaturesSection />
      <SolutionsSection />
      <PricingSection onContact={openContactModal} />
      <CTASection onScheduleDemo={openDemoModal} />
      <Footer onContact={openContactModal} onScheduleDemo={openDemoModal} />

      <ContactModal open={contactModalOpen} onOpenChange={setContactModalOpen} mode={contactMode} />
    </div>
  );
}
