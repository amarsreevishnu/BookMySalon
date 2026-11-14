/**
 * Super Admin Navigation Configuration
 * Centralized definition of all admin sidebar menu items, routes, icons, and badge keys.
 * Modifying or adding items here automatically updates the sidebar across all Super Admin views.
 */

export const ADMIN_NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "📊",
    path: "/admin/dashboard",
    matchPaths: ["/admin/dashboard", "/admin"],
    exact: true,
  },
  {
    key: "salons",
    label: "Salons Directory",
    icon: "🏪",
    path: "/admin/salons",
    badgeKey: "salonsCount",
    matchPaths: ["/admin/salons"],
  },
  {
    key: "approvals",
    label: "Salon Approvals",
    icon: "⚡",
    path: "/admin/salons?tab=pending",
    badgeKey: "pendingCount",
    isUrgent: true,
    badgeSuffix: "Urgent",
  },
  {
    key: "users",
    label: "Users",
    icon: "👥",
    path: "/admin/users",
    badgeKey: "usersCount",
    matchPaths: ["/admin/users"],
  },
  {
    key: "bookings",
    label: "Bookings",
    icon: "📅",
    path: "/admin/bookings",
    badgeKey: "bookingsCount",
    matchPaths: ["/admin/bookings"],
  },
  {
    key: "services",
    label: "Services Catalog",
    icon: "✂️",
    path: "/admin/services",
    badgeKey: "servicesCount",
    matchPaths: ["/admin/services"],
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    icon: "💳",
    path: "/admin/subscriptions",
    matchPaths: ["/admin/subscriptions"],
    badgeFormatter: (stats) => {
      const balance = Number(stats?.subs_wallet_balance || 0);
      if (balance > 0) {
        return `₹${balance.toLocaleString("en-IN")}`;
      }
      const trials = Number(stats?.active_trials || 0);
      if (trials > 0) {
        return `${trials} Trials`;
      }
      return null;
    },
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: "📈",
    path: "/admin/analytics",
    matchPaths: ["/admin/analytics", "/admin/dashboard#analytics"],
  },
  {
    key: "reviews",
    label: "Reviews",
    icon: "⭐",
    path: "/admin/reviews",
    badgeKey: "reviewsCount",
    matchPaths: ["/admin/reviews"],
  },
  {
    key: "offers",
    label: "Offers",
    icon: "🏷️",
    path: "/admin/offers",
    badgeKey: "offersCount",
    matchPaths: ["/admin/offers"],
  },
  {
    key: "support",
    label: "Support Tickets",
    icon: "🎫",
    path: "/admin/support",
    badgeKey: "supportCount",
    isUrgent: true,
    matchPaths: ["/admin/support", "/admin/tickets"],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "⚙️",
    path: "/admin/profile",
    matchPaths: ["/admin/profile"],
  },
  {
    key: "security",
    label: "Security",
    icon: "🛡️",
    path: "/admin/profile?tab=security",
  },
];

export default ADMIN_NAV_ITEMS;
