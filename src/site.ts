/** Everything that is 'about Jakub' rather than 'about the design' lives here. */

/** Owner/repo on GitHub. The marketplace install command is built from this, so it can
 *  never drift from where the plugins actually live. */
export const REPO = 'JakubCha/charyton.dev';

export const SITE = {
  name: 'Jakub Charyton',
  domain: 'charyton.dev',
  url: 'https://charyton.dev',
  email: 'jakub@charyton.dev',
  repo: REPO,
  marketplaceCommand: `/plugin marketplace add ${REPO}`,
  tagline: 'I build remote sensing and GIS systems that survive contact with production.',
  disciplines: ['LIDAR', 'Remote sensing', 'GIS', 'Machine learning'],
  location: { city: 'Warszawa', country: 'PL', lat: 52.2297, lon: 21.0122, crs: 'EPSG:2180' },
  links: [
    { label: 'GitHub', href: `https://github.com/${REPO.split('/')[0]}` },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jakubcharyton/' },
    { label: 'Email', href: 'mailto:jakub@charyton.dev' },
    { label: 'RSS', href: '/rss.xml' },
  ],
};
