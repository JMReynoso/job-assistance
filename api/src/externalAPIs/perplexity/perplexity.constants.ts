/**
 * Tuning constants for PerplexityService — the research angles, the researcher
 * persona, and the default caps. Types live in perplexity.types.ts.
 */
import type { ResearchAngle } from './perplexity.types';

/** The two angles `research()` fans a company out into. */
export const RESEARCH_ANGLES: ResearchAngle[] = [
    {
        label: 'company-product-funding',
        focus: 'what the company does and its mission, its main products, and its funding / financials',
    },
    {
        label: 'eng-culture-stack',
        focus: 'its engineering culture, the software / tech stack it uses, and its engineering blog',
    },
];

export const RESEARCHER_SYSTEM =
    'You are a meticulous company researcher helping a software engineer prepare ' +
    'a job application. State only facts you can cite; if unsure, say so. Prefer ' +
    'primary sources (the company site, engineering blog, reputable news).';

/**
 * Default per-angle source cap. Two angles → at most this many × 2 sources
 * before de-duping, keeping the stored `urls` list bounded.
 */
export const DEFAULT_MAX_SOURCES_PER_ANGLE = 10;

/**
 * Default hard ceiling on each angle's summary length (completion tokens). Each
 * angle returns a 5-bullet summary, so this bounds worst-case output cost while
 * leaving the bullets room to breathe.
 */
export const DEFAULT_MAX_TOKENS = 1500;

/**
 * Joins the two angles' summaries into the single `summary` field: four newlines,
 * a 10-dash rule, four newlines. Used only *between* angles — not before the
 * first or after the last.
 */
export const SUMMARY_ANGLE_SEPARATOR = '\n\n\n\n----------\n\n\n\n';
