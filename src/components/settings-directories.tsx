"use client";

import { useState } from "react";
import { Hotel, Store, Users } from "lucide-react";
import type { Locale } from "@/lib/messages";
import { CustomersClient } from "@/components/customers-client";
import { SuppliersClient } from "@/components/suppliers-client";
import { HotelDirectoryClient } from "@/components/hotel-directory-client";

type DirectoryTab = "hotels" | "suppliers" | "clients";

export function SettingsDirectories({
  locale,
  canViewHotels,
  canViewSuppliers,
  canViewClients,
  canManageHotels,
  canManageSuppliers,
  canManageClients,
  canArchiveClients,
}: {
  locale: Locale;
  canViewHotels: boolean;
  canViewSuppliers: boolean;
  canViewClients: boolean;
  canManageHotels: boolean;
  canManageSuppliers: boolean;
  canManageClients: boolean;
  canArchiveClients: boolean;
}) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<DirectoryTab>(canViewHotels ? "hotels" : canViewSuppliers ? "suppliers" : "clients");
  const tabs = [
    ...(canViewHotels ? [{ id: "hotels" as const, label: ar ? "الفنادق" : "Hotels", description: ar ? "أسماء أماكن الإقامة" : "Hotel properties", icon: Hotel }] : []),
    ...(canViewSuppliers ? [{ id: "suppliers" as const, label: ar ? "شركات الموردين" : "Supplier companies", description: ar ? "الشركات التي تشتري منها" : "Companies you buy from", icon: Store }] : []),
    ...(canViewClients ? [{ id: "clients" as const, label: ar ? "شركات العملاء" : "Client companies", description: ar ? "الشركات التي تبيع لها" : "Companies you sell to", icon: Users }] : []),
  ];
  return <div className="settings-directory-layout">
    <section className="settings-directory-intro">
      <div className="settings-directory-intro-icon"><Store size={21} /></div>
      <div>
        <strong>{ar ? "دليل الشركات والفنادق" : "Hotels & business directory"}</strong>
        <p>{ar ? "أضف بيانات التعاملات مرة واحدة، وستظهر تلقائيًا في قوائم اختيار الحجز. الفندق منفصل عن شركة المورد." : "Add your business records once. They will appear automatically in booking selectors. Hotels are separate from supplier companies."}</p>
      </div>
    </section>
    <div className="settings-directory-tabs" role="tablist" aria-label={ar ? "قوائم الإعدادات" : "Directory settings"}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return <button key={tab.id} type="button" role="tab" aria-selected={active} className={`settings-directory-tab ${active ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
          <span className="settings-directory-tab-icon"><Icon size={18} /></span>
          <span className="settings-directory-tab-copy"><strong>{tab.label}</strong><small>{tab.description}</small></span>
          <span className="settings-directory-tab-arrow">›</span>
        </button>;
      })}
    </div>
    <div className="settings-directory-content">
      {activeTab === "hotels" && canViewHotels && <HotelDirectoryClient locale={locale} canWrite={canManageHotels} />}
      {activeTab === "suppliers" && canViewSuppliers && <SuppliersClient locale={locale} canWrite={canManageSuppliers} />}
      {activeTab === "clients" && canViewClients && <CustomersClient locale={locale} canWrite={canManageClients} canArchive={canArchiveClients} corporateOnly />}
    </div>
  </div>;
}
