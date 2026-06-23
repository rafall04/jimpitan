/**
 * Purpose: Slug generation for SEO-friendly public content URLs.
 * Caller: ContentService when creating a post.
 * Deps: None (pure).
 * MainFuncs: Normalizes a title into a URL slug and finds a tenant-unique variant.
 * SideEffects: None.
 */

// Turn an arbitrary title into a lowercase, dash-separated, ASCII-safe slug.
export function slugify(input: string): string {
  const slug = (input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'postingan';
}

// Resolve a tenant-unique slug, appending -2, -3, ... when the base is taken.
export async function ensureUniqueSlug(base: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  if (!(await isTaken(root))) {
    return root;
  }
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  return `${root}-${Date.now().toString(36)}`;
}
