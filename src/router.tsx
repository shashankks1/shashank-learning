import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

/*
 * Hash routing: works from any static host and from `vite preview` without
 * server rewrites. Routes look like #/builds/b_123.
 */

export interface Route {
  path: string[];
  raw: string;
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const path = raw.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return { path: path.length ? path : ['dashboard'], raw };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(href: string): void {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

/** Move focus to the main heading after navigation so keyboard and screen-reader users land in context. */
export function useFocusOnRouteChange(route: Route): void {
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0 });
  }, [route.raw]);
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, ...rest }: LinkProps) {
  return <a href={to.startsWith('#') ? to : `#${to}`} {...rest} />;
}
