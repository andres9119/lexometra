import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Calendar, LogOut, Menu, Search, Bell, Plus, Users, Award, Landmark, CreditCard, FileSignature, BarChart3, Settings2, ClipboardList, Building2, Coins, BookOpen } from "lucide-react";
import IndicadoresIcon from "@/components/IndicadoresIcon";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import NotificationCenter from "@/components/NotificationCenter";

const navItems = [
{ to: "/", icon: IndicadoresIcon, label: "Indicadores" },
{ to: "/processes", icon: Briefcase, label: "Procesos" },
{ to: "/commercial", icon: Users, label: "Comercial" },
{ to: "/referrals", icon: Award, label: "Referidos" },
{ to: "/treasury", icon: Landmark, label: "Contabilidad" },
{ to: "/calendar", icon: Calendar, label: "Calendario" },
{ to: "/contracts", icon: FileSignature, label: "Contratos" },
{ to: "/reportes", icon: ClipboardList, label: "Control & Reportes" },
{ to: "/directorio-entidades", icon: Building2, label: "Directorio Entidades" },
{ to: "/manual", icon: BookOpen, label: "Manual de Funciones" }];


const toolbarItems = [
{ icon: IndicadoresIcon, label: "Indicadores", to: "/" },
{ icon: Briefcase, label: "Procesos", to: "/processes" },
{ icon: Users, label: "Comercial", to: "/commercial" },
{ icon: Award, label: "Referidos", to: "/referrals" },
{ icon: Calendar, label: "Calendario", to: "/calendar" },
{ icon: Plus, label: "Nuevo", to: "/commercial?new=1", highlight: true }];




export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to) => to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const NavLinks = () =>
  <>
      {navItems.map((item) => {
      const active = isActive(item.to);
      return (
        <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ?
        "bg-sidebar-primary text-sidebar-primary-foreground" :
        "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`
        }>
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>);

    })}
    </>;


  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <IndicadoresIcon className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg text-sidebar-foreground tracking-tight">Sinapsis</span>
        </div>
        <nav className="flex flex-col gap-1 px-3 flex-1 py-4">
          <NavLinks />
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent w-full transition-colors">
            
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top action toolbar — desktop */}
        <div className="hidden md:flex items-center justify-between px-4 py-2 bg-card border-b border-border shadow-sm">
          <div className="flex items-center gap-1">
            {toolbarItems.map((item) =>
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors text-xs font-medium min-w-[52px] ${
              item.highlight ?
              "bg-accent text-accent-foreground hover:bg-accent/90" :
              isActive(item.to) ?
              "bg-secondary text-foreground" :
              "text-muted-foreground hover:bg-secondary hover:text-foreground"}`
              }>
              
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <span className="text-xs font-semibold text-foreground">Módulo Integral de Gestión Jurídica</span>
          </div>
        </div>

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <IndicadoresIcon className="h-5 w-5 text-accent" />
            <span className="font-semibold">LegalTrack</span>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0 bg-sidebar">
              <div className="flex items-center gap-2.5 px-5 py-5">
                <IndicadoresIcon className="h-6 w-6 text-sidebar-primary" />
                <span className="font-bold text-lg text-sidebar-foreground">LegalTrack</span>
              </div>
              <nav className="flex flex-col gap-1 px-3">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>);

}