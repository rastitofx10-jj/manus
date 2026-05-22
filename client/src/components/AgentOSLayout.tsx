import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Bot,
  Brain,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Code2,
  Files,
  Github,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Shield,
  Terminal,
  User,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Missions", icon: Zap, href: "/missions" },
  { label: "Agents", icon: Bot, href: "/agents" },
  { label: "Terminal", icon: Terminal, href: "/terminal" },
  { label: "Files", icon: Files, href: "/files" },
  { label: "Browser", icon: Globe, href: "/browser" },
  { label: "Memory", icon: Brain, href: "/memory" },
  { label: "Approvals", icon: Shield, href: "/approvals" },
  { label: "Deployments", icon: Rocket, href: "/deployments" },
  { label: "GitHub", icon: Github, href: "/github" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

function NavLink({
  item,
  collapsed,
  pendingApprovals,
}: {
  item: NavItem;
  collapsed: boolean;
  pendingApprovals: number;
}) {
  const [location] = useLocation();
  const isActive =
    item.href === "/"
      ? location === "/"
      : location.startsWith(item.href);
  const badge = item.label === "Approvals" ? pendingApprovals : item.badge;

  const content = (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer group relative",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <item.icon
          className={cn(
            "shrink-0 transition-colors",
            collapsed ? "w-5 h-5" : "w-4 h-4",
            isActive ? "text-primary" : "group-hover:text-foreground"
          )}
        />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
        {badge != null && badge > 0 && (
          <Badge
            variant="destructive"
            className={cn(
              "h-5 min-w-5 text-xs px-1 ml-auto shrink-0",
              collapsed && "absolute -top-1 -right-1 h-4 min-w-4 text-[10px]"
            )}
          >
            {badge > 99 ? "99+" : badge}
          </Badge>
        )}
      </div>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarContent({
  collapsed,
  pendingApprovals,
  onToggle,
}: {
  collapsed: boolean;
  pendingApprovals: number;
  onToggle?: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground">Agent OS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            pendingApprovals={pendingApprovals}
          />
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-2">
        {user ? (
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-2 rounded-lg",
              collapsed ? "justify-center" : ""
            )}
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-foreground">
                  {user.name ?? "User"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email ?? user.openId}
                </p>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => logout()}
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <a href={getLoginUrl()}>
            <Button
              variant="default"
              size="sm"
              className={cn("w-full text-xs", collapsed && "px-2")}
            >
              {collapsed ? <User className="w-3.5 h-3.5" /> : "Sign In"}
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function AgentOSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();

  const { data: pendingApprovals } = trpc.approvals.pending.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const pendingCount = pendingApprovals?.length ?? 0;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          pendingApprovals={pendingCount}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-3 left-3 z-50 w-8 h-8 bg-card border border-border"
            >
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0 bg-sidebar border-sidebar-border">
            <SidebarContent
              collapsed={false}
              pendingApprovals={pendingCount}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
    </div>
  );
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-6 page-enter", className)}>
      {children}
    </div>
  );
}
