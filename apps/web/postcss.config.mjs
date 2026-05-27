/**
 * Purpose: PostCSS configuration for Tailwind CSS v4.
 * Caller: Next.js CSS build pipeline.
 * Deps: @tailwindcss/postcss.
 * MainFuncs: Registers Tailwind CSS processing.
 * SideEffects: None.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
