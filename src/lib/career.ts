import type { AppData, ExperimentStatus, ExperimentType } from '../types';

/** The directional path. Targets, not promises. */
export const CAREER_STAGES = [
  { n: 1, title: '₹30k/month stability', note: 'A reliable floor: income that covers essentials.' },
  { n: 2, title: '₹60k/month earning power', note: 'Evidence that you can do work worth twice as much.' },
  { n: 3, title: '₹1L/month capability', note: 'Hybrid design + build skills that teams pay for.' },
  { n: 4, title: '₹2L+ / stronger career options', note: 'More than one good option at any time.' },
  { n: 5, title: 'Financial runway', note: 'Savings that let you take a measured risk.' },
  { n: 6, title: 'Technical capability', note: 'You can build and ship a product end to end.' },
  { n: 7, title: 'Real experiments', note: 'Products in front of real users, with honest numbers.' },
  { n: 8, title: 'Serious product opportunity', note: 'A problem with evidence, pull and a path to revenue.' },
  { n: 9, title: 'Potential company', note: 'Something worth building a company around.' },
] as const;

export const EXPERIMENT_TYPE_LABELS: Record<ExperimentType, string> = {
  application: 'Job application',
  freelance: 'Freelance opportunity',
  networking: 'Networking',
  interview: 'Technical interview',
  client: 'Client work',
  product: 'Product experiment',
};

export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  waiting: 'Waiting',
  won: 'Won / offer',
  lost: 'Didn’t happen',
  closed: 'Closed',
};

/** Career evidence: derived wherever possible so it can't drift from the real records. */
export function careerEvidence(data: AppData) {
  const experiments = data.career.experiments;
  return {
    projects: data.builds.filter(build => build.status === 'completed' || build.status === 'published').length,
    github: data.builds.filter(build => build.githubUrl.includes('github.com')).length,
    portfolio: data.portfolio.filter(slot => slot.status === 'published').length,
    interviews: experiments.filter(item => item.type === 'interview').length,
    freelance: experiments.filter(item => (item.type === 'freelance' || item.type === 'client') && item.status === 'won').length,
    applications: experiments.filter(item => item.type === 'application').length,
    offers: experiments.filter(item => (item.type === 'application' || item.type === 'interview') && item.status === 'won').length,
  };
}
