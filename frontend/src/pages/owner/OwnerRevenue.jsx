import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerRevenueTab from "../../components/owner/OwnerRevenueTab";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerDashboard.css";

export default function OwnerRevenue() {
  const navigate = useNavigate();
  const [salonInfo, setSalonInfo] = useState({ id: null, name: "Salon Studio", city: "" });

  useEffect(() => {
    let isMounted = true;
    const fetchSalonInfo = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await api.get("/salons/owner/dashboard/", config);
        if (res.data?.salon_info && isMounted) {
          setSalonInfo(res.data.salon_info);
        }
      } catch (err) {
        console.error("Failed to load salon info for revenue page:", err);
      }
    };
    fetchSalonInfo();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="studio-app-shell">
      <OwnerNavbarHeader salonInfo={salonInfo} />
      <OwnerNavbar activeTab="Revenue" />

      <main className="studio-main-body">
        <OwnerRevenueTab
          salonId={salonInfo?.id}
          onBackToDashboard={() => navigate("/owner/dashboard")}
        />
      </main>

      <OwnerStickyFooter salonInfo={salonInfo} />
    </div>
  );
}
