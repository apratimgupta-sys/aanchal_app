const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function portalPath(path: string): string {
  return `${basePath}${path}`;
}

export function portalRoute(pathname: string): string {
  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}
