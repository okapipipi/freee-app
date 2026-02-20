"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "管理者",
  employee: "社員",
  executive: "経営陣",
};

export function Header({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  return (
    <header className="fixed top-0 left-56 right-0 z-20 flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">{userName}</span>
          <Badge variant="secondary" className="text-xs">
            {roleLabels[role] ?? role}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
          className="text-gray-500 hover:text-gray-700"
        >
          <LogOut className="mr-1 h-4 w-4" />
          ログアウト
        </Button>
      </div>
    </header>
  );
}
