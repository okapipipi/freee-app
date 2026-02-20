"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Users,
  Link2,
  BarChart3,
  FilePlus,
  History,
  PenLine,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const adminNav: NavItem[] = [
  { label: "ダッシュボード",   href: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "申請一覧・承認",   href: "/admin/reports",   icon: <FileText className="h-4 w-4" /> },
  { label: "ユーザー管理",     href: "/admin/users",     icon: <Users className="h-4 w-4" /> },
  { label: "freee連携",        href: "/admin/freee",     icon: <Link2 className="h-4 w-4" /> },
  { label: "マスタ管理",       href: "/admin/master",    icon: <Settings className="h-4 w-4" /> },
  { label: "申請作成",         href: "/employee/submit", icon: <PenLine className="h-4 w-4" /> },
  { label: "申請した内容",     href: "/employee/history",icon: <History className="h-4 w-4" /> },
];

const employeeNav: NavItem[] = [
  { label: "経費申請", href: "/employee/submit", icon: <FilePlus className="h-4 w-4" /> },
  { label: "申請履歴", href: "/employee/history", icon: <History className="h-4 w-4" /> },
];

const executiveNav: NavItem[] = [
  { label: "ダッシュボード", href: "/executive/dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "経費申請",       href: "/employee/submit",     icon: <PenLine className="h-4 w-4" /> },
  { label: "申請履歴",       href: "/employee/history",    icon: <History className="h-4 w-4" /> },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "admin":
      return adminNav;
    case "executive":
      return executiveNav;
    case "employee":
      return employeeNav;
    default:
      return [];
  }
}

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-sm font-bold">経費管理システム</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
