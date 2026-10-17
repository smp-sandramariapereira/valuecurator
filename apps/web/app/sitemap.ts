import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/institutional";

const paths = ["", "/about", "/technology", "/solutions", "/journey", "/team", "/roadmap", "/partners", "/pitchdeck", "/interview", "/subscribe"];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.6,
  }));
}
