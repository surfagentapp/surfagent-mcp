import type { ToolDefinition } from "../contracts.js";
import { textResult } from "../tool-utils.js";

const SITE_PATTERNS: Array<{
  id: string;
  name: string;
  match: RegExp;
  description: string;
  adapterPackage: string;
}> = [
  {
    id: "tradingview",
    name: "TradingView",
    match: /tradingview\.com/i,
    description: "Chart analysis, Pine Script development, indicators, alerts",
    adapterPackage: "surfagent-tradingview"
  },
  {
    id: "x",
    name: "X (Twitter)",
    match: /(?:twitter\.com|x\.com)/i,
    description: "Post tweets, manage timeline, DMs, follow/unfollow",
    adapterPackage: "surfagent-x"
  },
  {
    id: "github",
    name: "GitHub",
    match: /github\.com/i,
    description: "PR reviews, issue management, repo exploration",
    adapterPackage: "surfagent-github"
  },
  {
    id: "gmail",
    name: "Gmail",
    match: /mail\.google\.com/i,
    description: "Read, send, search, label, archive emails",
    adapterPackage: "surfagent-gmail"
  },
  {
    id: "discord",
    name: "Discord",
    match: /discord\.com/i,
    description: "Read channels, send messages, manage server",
    adapterPackage: "surfagent-discord"
  },
  {
    id: "youtube",
    name: "YouTube",
    match: /youtube\.com/i,
    description: "Video management, analytics, comments",
    adapterPackage: "surfagent-youtube"
  },
  {
    id: "reddit",
    name: "Reddit",
    match: /reddit\.com/i,
    description: "Browse, post, comment, manage subreddits",
    adapterPackage: "surfagent-reddit"
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    match: /linkedin\.com/i,
    description: "Profile, connections, posts, job applications",
    adapterPackage: "surfagent-linkedin"
  },
  {
    id: "notion",
    name: "Notion",
    match: /notion\.so/i,
    description: "Pages, databases, notes management",
    adapterPackage: "surfagent-notion"
  },
  {
    id: "google-docs",
    name: "Google Docs",
    match: /docs\.google\.com/i,
    description: "Document editing, formatting, collaboration",
    adapterPackage: "surfagent-google-docs"
  }
];

export const siteDetectTools: ToolDefinition[] = [
  {
    name: "surf_site_detect",
    description:
      "Detect what site is currently open in the browser and list available SurfAgent adapter packages for enhanced control. Returns site ID, name, and whether an adapter MCP is available.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      const url = await cdp.getURL();
      const title = await cdp.getTitle();

      const matches = SITE_PATTERNS.filter((site) => site.match.test(url));

      const detected = matches.map((site) => ({
        id: site.id,
        name: site.name,
        description: site.description,
        adapterPackage: site.adapterPackage,
        installHint: `npx -y ${site.adapterPackage}`
      }));

      const result = {
        url,
        title,
        detectedSites: detected,
        siteId: detected.length > 0 ? detected[0]!.id : "unknown",
        siteName: detected.length > 0 ? detected[0]!.name : "Unknown",
        hasAdapter: detected.length > 0,
        allKnownAdapters: SITE_PATTERNS.map((s) => ({
          id: s.id,
          name: s.name,
          package: s.adapterPackage
        }))
      };

      return textResult(JSON.stringify(result, null, 2));
    }
  }
];
