/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // MCP + Data API surfaces are intentionally read-only and meant to be
    // hit from arbitrary origins (Claude Desktop, Cursor, browser-based
    // MCP clients, judge laptops). Wildcard CORS is safe here — every
    // mutation (Move PTBs) requires wallet signing and stays out of this
    // surface entirely.
    const corsHeaders = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Content-Type" },
      { key: "Access-Control-Max-Age", value: "86400" },
    ];
    return [
      { source: "/api/mcp/:path*", headers: corsHeaders },
      { source: "/api/mcp", headers: corsHeaders },
      { source: "/api/tatum-data/:path*", headers: corsHeaders },
      { source: "/api/integration-health", headers: corsHeaders },
    ];
  },
};
export default nextConfig;
