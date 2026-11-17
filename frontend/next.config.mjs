// STATIC_EXPORT=1 (npm run build:static) builds the site as plain files in out/ for the
// backend to serve: no Next.js server needed, so it runs on old machines (Node 16).
const staticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-side rendering features; a static export can't use them (and doesn't need them)
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,

  ...(staticExport && {
    output: "export",
    trailingSlash: true, // /dashboard/ -> dashboard/index.html, which any static server can serve
  }),
};

export default nextConfig;
