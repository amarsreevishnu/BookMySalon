import { useState, useEffect } from "react";
import api from "../../api/axios";
import "../../styles/workerDashboard.css";

export default function WorkerSalonBanner({ salonInfo }) {
  const [internalSalon, setInternalSalon] = useState(salonInfo || null);

  useEffect(() => {
    if (salonInfo) {
      setInternalSalon(salonInfo);
    }
  }, [salonInfo]);

  useEffect(() => {
    if (!salonInfo) {
      let isMounted = true;
      api
        .get("/salons/worker/dashboard/")
        .then((res) => {
          if (!isMounted || !res.data?.salon) return;
          const s = res.data.salon;
          setInternalSalon({
            name: s.name || "Luxe Botanical Salon & Spa",
            city: s.city || "Kochi, Kerala",
            address: s.address || "MG Road, Marine Drive",
            category: s.category || s.category_name || "Unisex Luxury Salon",
            phone: s.phone || "",
            status: s.is_active ? "Active" : "Active",
          });
        })
        .catch((err) => {
          console.warn("Could not load worker salon info for banner:", err?.message);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [salonInfo]);

  const activeSalon = salonInfo || internalSalon || {
    name: "Luxe Botanical Salon & Spa",
    city: "Kochi, Kerala",
    address: "MG Road, Marine Drive",
    category: "Unisex Luxury Salon",
    phone: "",
  };

  return (
    <div className="wd-salon-affiliation-banner">
      <div className="wd-salon-affil-left">
        <div className="wd-salon-affil-icon">🏛️</div>
        <div>
          <div className="wd-salon-affil-title">{activeSalon.name}</div>
          <div className="wd-salon-affil-meta">
            {activeSalon.category && <span>{activeSalon.category}</span>}
            {activeSalon.category && <span>•</span>}
            <span>
              📍 {activeSalon.address}
              {activeSalon.city ? `, ${activeSalon.city}` : ""}
            </span>
            {activeSalon.phone && <span>•</span>}
            {activeSalon.phone && <span>📞 {activeSalon.phone}</span>}
          </div>
        </div>
      </div>
      <span className="wd-salon-badge-verified">✓ Active Salon Specialist</span>
    </div>
  );
}
