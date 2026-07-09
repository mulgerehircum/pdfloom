// Vercel's zero-config Node.js runtime auto-detects files under api/ as serverless functions
// and bundles their whole reachable dependency graph — this re-exports the already-compiled
// (by `npm run build`, which runs during the Build step, before Vercel bundles this function)
// Express/Nest handler from dist/, rather than duplicating app bootstrap logic here. All
// traffic reaches this single function via the vercel.json rewrite of "/(.*)" -> "/api/index".
export { default } from '../dist/vercel';
