import { MessageSquare, BookOpen, History, BarChart2, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Knowledge", path: "/knowledge", icon: BookOpen },
  { label: "History", path: "/history", icon: History },
  { label: "Quality", path: "/quality", icon: BarChart2 },
  { label: "Settings", path: "/settings", icon: Settings },
];
