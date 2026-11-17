// Ideal customer profile: who to look for at a target account, and when a signal becomes a lead.
// Shared by the web app, the collector and the Apollo function. Edit to match how the team sells.

/** Job titles searched in Apollo, most important first. */
export const ICP_TITLES = [
  'Chief Information Officer',
  'Chief Technology Officer',
  'Chief Digital Officer',
  'Head of IT',
  'Head of Retail Technology',
  'Head of E-commerce',
  'VP Engineering',
  'Director of Engineering',
  'Head of Quality Assurance',
  'QA Manager',
];

/** Apollo seniority filters used alongside the titles. */
export const ICP_SENIORITIES = ['c_suite', 'vp', 'head', 'director'];

/** Signals at or above this fit score become pipeline opportunities automatically. */
export const AUTO_PIPELINE_MIN_FIT = 80;

/** Most opportunities created automatically per collector run. */
export const AUTO_PIPELINE_MAX_PER_RUN = 15;
