/**
 * Starter library of on-brand Community Hero Images.
 *
 * These are curated, warm/editorial banners (generated via fal.ai — see
 * scripts/genHeroTemplates.mjs) served as static files from client/public.
 * A community can pick one instead of uploading their own; selecting a template
 * simply sets `tenant.heroImageUrl` to its public path, and the existing
 * focus-point picker + landing-page renderer handle the rest.
 */
export interface HeroTemplate {
  id: string;
  label: string;
  description: string;
  /** Public, app-served path — assignable directly to tenant.heroImageUrl */
  url: string;
}

export const HERO_TEMPLATES: HeroTemplate[] = [
  {
    id: "golden-street",
    label: "Tree-Lined Street",
    description: "A classic neighborhood street at golden hour",
    url: "/hero-templates/golden-street.jpg",
  },
  {
    id: "front-porches",
    label: "Welcoming Porches",
    description: "Craftsman cottages with inviting front porches",
    url: "/hero-templates/front-porches.jpg",
  },
  {
    id: "community-green",
    label: "Community Green",
    description: "An open park green with a shade tree and path",
    url: "/hero-templates/community-green.jpg",
  },
  {
    id: "lakeside",
    label: "Lakeside",
    description: "A calm waterfront community at dusk",
    url: "/hero-templates/lakeside.jpg",
  },
  {
    id: "mountain-wooded",
    label: "Wooded Hills",
    description: "Homes among the pines with morning mist",
    url: "/hero-templates/mountain-wooded.jpg",
  },
  {
    id: "coastal-palms",
    label: "Coastal",
    description: "A sunny coastal neighborhood with palms",
    url: "/hero-templates/coastal-palms.jpg",
  },
];

/** True when a hero image URL points at one of our starter templates. */
export function isHeroTemplateUrl(url?: string | null): boolean {
  return !!url && HERO_TEMPLATES.some((t) => t.url === url);
}
