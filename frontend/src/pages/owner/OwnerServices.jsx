import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerServices.css";

export default function OwnerServices() {
  const [salonInfo, setSalonInfo] = useState({ name: "Salon", city: "" });
  const [servicesList, setServicesList] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState("catalog"); // "catalog" | "custom"
  const [selectedCatalogCatId, setSelectedCatalogCatId] = useState("");
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSelectedCategory, setCatalogSelectedCategory] = useState("all");
  const [addCustomName, setAddCustomName] = useState("");
  const [addCategoryName, setAddCategoryName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addDuration, setAddDuration] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addingSubmitting, setAddingSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState("");


  const [editModalService, setEditModalService] = useState(null);
  const [editCustomName, setEditCustomName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState("");

  
  const [deleteModalService, setDeleteModalService] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const fetchOwnerServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/services/owner/services/");
      if (res.data) {
        if (res.data.salon) {
          setSalonInfo(res.data.salon);
        }
        setServicesList(Array.isArray(res.data.services) ? res.data.services : []);
      }
    } catch (err) {
      console.error("Failed to load salon services:", err);
      showToast("Unable to load services for this salon.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await api.get("/services/owner/catalog/");
      const cats = Array.isArray(res.data) ? res.data : [];
      setCatalogCategories(cats);
      if (cats.length > 0) {
        setSelectedCatalogCatId(cats[0].id);
        const firstCatServices = cats[0].services || [];
        if (firstCatServices.length > 0) {
          setSelectedCatalogServiceId(firstCatServices[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load standard catalog:", err);
    }
  }, []);

  useEffect(() => {
    fetchOwnerServices();
    fetchCatalog();
  }, [fetchOwnerServices, fetchCatalog]);


  const availableCategories = useMemo(() => {
    const set = new Set();
    servicesList.forEach((s) => {
      const cat = s.category_name || s.category || s.service_details?.category_name;
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [servicesList]);


  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return servicesList.filter((s) => {
      const name = (s.effective_name || s.name || s.custom_name || s.service_details?.name || "").toLowerCase();
      const cat = (s.category_name || s.category || s.service_details?.category_name || "").toLowerCase();
      const desc = (s.effective_description || s.description || "").toLowerCase();

      const matchesSearch = !q || name.includes(q) || cat.includes(q) || desc.includes(q);
      const matchesCategory =
        selectedCategory === "all" ||
        (s.category_name || s.category || s.service_details?.category_name || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && s.is_active) ||
        (statusFilter === "inactive" && !s.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [servicesList, searchQuery, selectedCategory, statusFilter]);

  
  const isServiceAlreadyAdded = (standardServiceId) => {
    return servicesList.some(
      (s) =>
        String(s.service) === String(standardServiceId) ||
        String(s.service_details?.id) === String(standardServiceId)
    );
  };

  
  const filteredCatalogServices = useMemo(() => {
    const list = [];
    catalogCategories.forEach((cat) => {
      if (catalogSelectedCategory !== "all" && String(cat.id) !== String(catalogSelectedCategory)) {
        return;
      }
      (cat.services || []).forEach((srv) => {
        const q = catalogSearch.trim().toLowerCase();
        const matchesQ =
          !q ||
          srv.name.toLowerCase().includes(q) ||
          (srv.description && srv.description.toLowerCase().includes(q)) ||
          cat.name.toLowerCase().includes(q);

        if (matchesQ) {
          list.push({
            ...srv,
            category_id: cat.id,
            category_name: cat.name,
            category_icon: cat.icon || "✂️",
          });
        }
      });
    });
    return list;
  }, [catalogCategories, catalogSelectedCategory, catalogSearch]);

  
  const selectedCatalogService = useMemo(() => {
    if (!selectedCatalogServiceId) return null;
    for (const cat of catalogCategories) {
      const found = (cat.services || []).find((s) => String(s.id) === String(selectedCatalogServiceId));
      if (found) {
        return {
          ...found,
          category_id: cat.id,
          category_name: cat.name,
          category_icon: cat.icon || "✂️",
        };
      }
    }
    return null;
  }, [catalogCategories, selectedCatalogServiceId]);

  const handleOpenAddModal = () => {
    setAddFormError("");
    setAddMode("catalog");
    setCatalogSearch("");
    setCatalogSelectedCategory("all");

    
    let firstAvailable = null;
    for (const cat of catalogCategories) {
      for (const srv of cat.services || []) {
        if (!isServiceAlreadyAdded(srv.id)) {
          firstAvailable = srv;
          break;
        }
      }
      if (firstAvailable) break;
    }

    if (firstAvailable) {
      setSelectedCatalogServiceId(firstAvailable.id);
      setSelectedCatalogCatId(firstAvailable.category || "");
      setAddPrice(firstAvailable.standard_price || "500");
      setAddDuration(firstAvailable.standard_duration || "45");
      setAddDescription(firstAvailable.description || "");
    } else {
      setSelectedCatalogServiceId("");
      setAddPrice("");
      setAddDuration("");
      setAddDescription("");
    }

    setAddCustomName("");
    setAddCategoryName(catalogCategories[0]?.name || "Hair");
    setIsAddModalOpen(true);
  };

  const handleSelectCatalogService = (srv) => {
    if (isServiceAlreadyAdded(srv.id)) return;
    setSelectedCatalogServiceId(srv.id);
    setSelectedCatalogCatId(srv.category_id || srv.category || "");
    setAddPrice(srv.standard_price || "500");
    setAddDuration(srv.standard_duration || "45");
    setAddDescription(srv.description || "");
    setAddCustomName("");
    setAddFormError("");
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddFormError("");

    const parsedPrice = parseFloat(addPrice);
    const parsedDuration = parseInt(addDuration, 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setAddFormError("Please enter a valid price in ₹.");
      return;
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setAddFormError("Please enter a valid duration in minutes.");
      return;
    }

    setAddingSubmitting(true);
    try {
      if (addMode === "catalog") {
        if (!selectedCatalogServiceId) {
          setAddFormError("Please select a standard service from the catalog.");
          setAddingSubmitting(false);
          return;
        }

        await api.post("/services/owner/services/", {
          service: selectedCatalogServiceId,
          custom_name: addCustomName.trim(),
          price: parsedPrice,
          duration: parsedDuration,
          description: addDescription.trim(),
        });
      } else {
        if (!addCustomName.trim()) {
          setAddFormError("Please enter a service name.");
          setAddingSubmitting(false);
          return;
        }

        await api.post("/services/owner/services/", {
          name: addCustomName.trim(),
          category: addCategoryName.trim() || "General",
          price: parsedPrice,
          duration: parsedDuration,
          description: addDescription.trim(),
        });
      }

      showToast("Service added to your salon successfully.");
      setIsAddModalOpen(false);
      fetchOwnerServices();
    } catch (err) {
      console.error("Failed to add service:", err);
      const res = err.response?.data;
      if (res?.error) {
        setAddFormError(res.error);
      } else if (res?.detail) {
        setAddFormError(res.detail);
      } else {
        setAddFormError("Could not add service. Please check the values.");
      }
    } finally {
      setAddingSubmitting(false);
    }
  };

  
  const handleOpenEditModal = (service) => {
    setEditModalService(service);
    setEditCustomName(service.custom_name || service.effective_name || "");
    setEditPrice(service.price);
    setEditDuration(service.duration);
    setEditDescription(service.description || service.effective_description || "");
    setEditIsActive(service.is_active);
    setEditFormError("");
  };

  
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalService) return;

    const parsedPrice = parseFloat(editPrice);
    const parsedDuration = parseInt(editDuration, 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setEditFormError("Please enter a valid price in ₹.");
      return;
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setEditFormError("Please enter a valid duration in minutes.");
      return;
    }

    setEditingSubmitting(true);
    try {
      await api.patch(`/services/owner/services/${editModalService.id}/`, {
        custom_name: editCustomName.trim(),
        price: parsedPrice,
        duration: parsedDuration,
        description: editDescription.trim(),
        is_active: editIsActive,
      });

      showToast("Service updated successfully.");
      setEditModalService(null);
      fetchOwnerServices();
    } catch (err) {
      console.error("Failed to update service:", err);
      setEditFormError(err.response?.data?.error || "Could not update service.");
    } finally {
      setEditingSubmitting(false);
    }
  };

  
  const handleToggleStatus = async (service) => {
    const nextStatus = !service.is_active;
    try {
      await api.patch(`/services/owner/services/${service.id}/`, {
        is_active: nextStatus,
      });
      showToast(`${service.effective_name} is now ${nextStatus ? "active" : "inactive"}.`);
      setServicesList((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, is_active: nextStatus } : s))
      );
    } catch (err) {
      console.error("Failed to toggle status:", err);
      showToast("Could not update service status.");
    }
  };

  
  const handleConfirmDelete = async () => {
    if (!deleteModalService) return;
    setDeleting(true);
    try {
      await api.delete(`/services/owner/services/${deleteModalService.id}/`);
      showToast(`Removed "${deleteModalService.effective_name}" from your salon.`);
      setDeleteModalService(null);
      fetchOwnerServices();
    } catch (err) {
      console.error("Failed to delete service:", err);
      showToast("Could not remove service.");
    } finally {
      setDeleting(false);
    }
  };

  
  const getCategoryIcon = (categoryName) => {
    const name = (categoryName || "").toLowerCase();
    if (name.includes("hair")) return "✂️";
    if (name.includes("skin") || name.includes("facial")) return "🧖";
    if (name.includes("spa") || name.includes("massage")) return "💆";
    if (name.includes("nail")) return "💅";
    if (name.includes("beard") || name.includes("shave")) return "🧔";
    return "✨";
  };

  return (
    <div className="os-page-wrapper">
      <OwnerNavbarHeader />
      <OwnerNavbar activeTab="Services" />

      <main className="os-main-container">
       
        <div className="os-breadcrumb">
          <Link to="/owner/dashboard" className="os-breadcrumb-link">
            Owner Dashboard
          </Link>
          <span>/</span>
          <span className="os-breadcrumb-active">Salon Services</span>
        </div>

        
        <div className="os-header-row">
          <div>
            <h1 className="os-header-title">Salon Services</h1>
            <p className="os-header-subtitle">
              Manage service catalog, pricing, and treatment durations specifically for {salonInfo.name}.
            </p>
          </div>

          <button
            type="button"
            className="btn-os-add-service"
            onClick={handleOpenAddModal}
          >
            <span>+ Add Service</span>
          </button>
        </div>

        
        <div className="os-salon-banner">
          <div className="os-salon-banner-left">
            <div className="os-salon-banner-icon">🏛️</div>
            <div>
              <div className="os-salon-banner-name">{salonInfo.name}</div>
              <div className="os-salon-banner-meta">
                <span>📍 {salonInfo.city || "Salon Location"}</span>
                <span>•</span>
                <span>Exclusive Salon Menu</span>
              </div>
            </div>
          </div>
          <span className="os-salon-badge-scope">✓ Online</span>
        </div>

        <div className="os-toolbar-card">
          <div className="os-search-row">
            <div className="os-search-input-wrap">
              <span className="os-search-icon">🔍</span>
              <input
                type="text"
                className="os-search-input"
                placeholder="Search services by name, category, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="os-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          
          <div className="os-category-pills">
            <button
              type="button"
              className={`os-pill-btn ${selectedCategory === "all" ? "active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All Categories ({servicesList.length})
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`os-pill-btn ${selectedCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {getCategoryIcon(cat)} {cat}
              </button>
            ))}
          </div>
        </div>

        
        <div className="os-table-card">
          {loading ? (
            <div className="os-empty-state">
              <div className="os-empty-icon">⏳</div>
              <h3 className="os-empty-title">Loading salon services...</h3>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="os-empty-state">
              <div className="os-empty-icon">✂️</div>
              <h3 className="os-empty-title">No services found</h3>
              <p className="os-empty-desc">
                {servicesList.length === 0
                  ? "Your salon doesn't have any services configured yet. Click '+ Add Service' to start offering treatments."
                  : "No services match your active search or category filters."}
              </p>
              {servicesList.length === 0 && (
                <button
                  type="button"
                  className="btn-os-add-service"
                  onClick={handleOpenAddModal}
                >
                  <span>+ Add First Service</span>
                </button>
              )}
            </div>
          ) : (
            <table className="os-table">
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Service</th>
                  <th style={{ width: "16%" }}>Category</th>
                  <th style={{ width: "14%" }}>Duration</th>
                  <th style={{ width: "14%" }}>Price</th>
                  <th style={{ width: "12%" }}>Status</th>
                  <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((item) => {
                  const catName = item.category_name || item.category || item.service_details?.category_name || "General";
                  const icon = getCategoryIcon(catName);
                  const displayName = item.effective_name || item.name || item.custom_name || "Service";
                  const displayDesc = item.effective_description || item.description || "Signature salon treatment";
                  const cleanPrice = String(item.price || "0").replace(/[^\d.]/g, "");
                  const parsedPrice = parseFloat(cleanPrice) || 0;
                  const cleanDur = typeof item.duration === "number" ? item.duration : (parseInt(String(item.duration || "45").replace(/[^\d]/g, ""), 10) || 45);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="os-service-cell">
                          <div className="os-category-icon-box">{icon}</div>
                          <div>
                            <div className="os-service-title">
                              {displayName}
                              {item.custom_name && item.custom_name !== item.service_details?.name && (
                                <span className="os-custom-badge">Custom</span>
                              )}
                            </div>
                            <div className="os-service-subtitle">
                              {displayDesc}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="os-category-badge">
                          <span>{icon}</span>
                          <span>{catName}</span>
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: "#18281e" }}>
                          ⏱️ {cleanDur} mins
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: "#1e392a", fontSize: "0.95rem" }}>
                          ₹{parsedPrice.toFixed(2)}
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`os-status-pill ${item.is_active ? "active" : "inactive"}`}
                          title="Click to toggle status"
                          onClick={() => handleToggleStatus(item)}
                        >
                          <span>{item.is_active ? "✓ Active" : "✕ Inactive"}</span>
                        </button>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="os-actions-cell">
                          <button
                            type="button"
                            className="btn-os-action"
                            title="Edit Service"
                            onClick={() => handleOpenEditModal(item)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-os-action delete"
                            title="Remove from salon"
                            onClick={() => setDeleteModalService(item)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      
      {isAddModalOpen && (
        <div
          className="os-modal-overlay"
          onClick={() => !addingSubmitting && setIsAddModalOpen(false)}
        >
          <div className="os-modal-container wide" onClick={(e) => e.stopPropagation()}>
            <div className="os-modal-header">
              <h3 className="os-modal-title">Add Service to {salonInfo.name}</h3>
              <button
                type="button"
                className="os-modal-close"
                onClick={() => !addingSubmitting && setIsAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="os-modal-form">
              <div className="os-modal-body">
                

                
                {addFormError && (
                  <div className="os-error-box">
                    ⚠️ {addFormError}
                  </div>
                )}

                
                <div className="os-modal-tabs">
                  <button
                    type="button"
                    className={`os-modal-tab-btn ${addMode === "catalog" ? "active" : ""}`}
                    onClick={() => {
                      setAddMode("catalog");
                      setAddFormError("");
                    }}
                  >
                    Select from Catalog
                  </button>
                  <button
                    type="button"
                    className={`os-modal-tab-btn ${addMode === "custom" ? "active" : ""}`}
                    onClick={() => {
                      setAddMode("custom");
                      setAddFormError("");
                    }}
                  >
                    Create Custom Service
                  </button>
                </div>

                {addMode === "catalog" ? (
                  <div className="os-catalog-browser">
                    
                    <div className="os-catalog-filter-bar">
                      <div className="os-catalog-search-wrapper">
                        <span className="os-catalog-search-icon">🔍</span>
                        <input
                          type="text"
                          className="os-catalog-search-input"
                          placeholder="Search standard services from platform catalog..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                        />
                      </div>

                      <div className="os-catalog-pills-row">
                        <button
                          type="button"
                          className={`os-catalog-pill-btn ${catalogSelectedCategory === "all" ? "active" : ""}`}
                          onClick={() => setCatalogSelectedCategory("all")}
                        >
                          All ({catalogCategories.reduce((acc, c) => acc + (c.services?.length || 0), 0)})
                        </button>
                        {catalogCategories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`os-catalog-pill-btn ${String(catalogSelectedCategory) === String(c.id) ? "active" : ""}`}
                            onClick={() => setCatalogSelectedCategory(c.id)}
                          >
                            {c.icon || "✂️"} {c.name} ({c.services?.length || 0})
                          </button>
                        ))}
                      </div>
                    </div>

                    
                    <div className="os-catalog-grid">
                      {filteredCatalogServices.length === 0 ? (
                        <div className="os-catalog-empty-notice">
                          No standard catalog services found matching your search.
                        </div>
                      ) : (
                        filteredCatalogServices.map((srv) => {
                          const alreadyAdded = isServiceAlreadyAdded(srv.id);
                          const isSelected = selectedCatalogServiceId === srv.id;

                          return (
                            <div
                              key={srv.id}
                              className={`os-catalog-card ${isSelected ? "selected" : ""} ${alreadyAdded ? "already-added" : ""}`}
                              onClick={() => !alreadyAdded && handleSelectCatalogService(srv)}
                              title={alreadyAdded ? "This service is already in your salon menu" : "Click to select and configure"}
                            >
                              <div>
                                <div className="os-catalog-card-header">
                                  <div className="os-catalog-card-title">
                                    <span>{srv.category_icon || "✂️"} {srv.name}</span>
                                  </div>
                                  {alreadyAdded && (
                                    <span className="os-catalog-added-badge">✓ Added</span>
                                  )}
                                  {isSelected && !alreadyAdded && (
                                    <span className="os-catalog-selected-badge">✓ Selected</span>
                                  )}
                                </div>
                                <div className="os-catalog-card-category">
                                  {srv.category_name}
                                </div>
                                <div className="os-catalog-card-desc">
                                  {srv.description || "Platform standard service benchmark."}
                                </div>
                              </div>

                              <div className="os-catalog-card-footer">
                                <span className="os-catalog-card-price">
                                  Benchmark: ₹{parseFloat(srv.standard_price || 0).toFixed(0)}
                                </span>
                                <span className="os-catalog-card-duration">
                                  ⏱️ {srv.standard_duration} mins
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    
                    {selectedCatalogService ? (
                      <div className="os-catalog-selected-config">
                        <div className="os-selected-service-banner">
                          <span className="os-selected-service-icon">
                            {selectedCatalogService.category_icon || "✂️"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div className="os-selected-service-name">
                              {selectedCatalogService.name}
                            </div>
                            <div className="os-selected-service-meta">
                              <span>Category: {selectedCatalogService.category_name}</span>
                              <span>•</span>
                              <span>Benchmark: ₹{parseFloat(selectedCatalogService.standard_price || 0).toFixed(2)}</span>
                              <span>•</span>
                              <span>{selectedCatalogService.standard_duration} mins</span>
                            </div>
                          </div>
                        </div>

                        <div className="os-form-group">
                          <label className="os-form-label">
                            Custom Display Name <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional branding e.g. Signature {selectedCatalogService.name})</span>
                          </label>
                          <input
                            type="text"
                            className="os-form-input"
                            placeholder={`Leave blank to keep "${selectedCatalogService.name}"`}
                            value={addCustomName}
                            onChange={(e) => setAddCustomName(e.target.value)}
                          />
                        </div>

                        
                        <div className="os-form-row-2">
                          <div className="os-form-group">
                            <label className="os-form-label">
                              Your Salon Price (₹) <span style={{ color: "#dc2626" }}>*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="os-form-input"
                              placeholder="e.g. 500"
                              value={addPrice}
                              onChange={(e) => setAddPrice(e.target.value)}
                              required
                            />
                          </div>

                          <div className="os-form-group">
                            <label className="os-form-label">
                              Duration (Mins) <span style={{ color: "#dc2626" }}>*</span>
                            </label>
                            <input
                              type="number"
                              min="5"
                              step="5"
                              className="os-form-input"
                              placeholder="e.g. 45"
                              value={addDuration}
                              onChange={(e) => setAddDuration(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        
                        <div className="os-form-group">
                          <label className="os-form-label">Description / Treatment Notes</label>
                          <textarea
                            className="os-form-input"
                            rows={2}
                            placeholder="Details about steps, products used, or consultation..."
                            value={addDescription}
                            onChange={(e) => setAddDescription(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="os-catalog-no-selection">
                        👆 Click on any standard service from the catalog above to configure pricing and add it to your salon.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    
                    <div className="os-form-group">
                      <label className="os-form-label">
                        Service Name <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="os-form-input"
                        placeholder="e.g. Keratin Protein Treatment"
                        value={addCustomName}
                        onChange={(e) => setAddCustomName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    
                    <div className="os-form-group">
                      <label className="os-form-label">Category</label>
                      <select
                        className="os-form-input"
                        value={addCategoryName}
                        onChange={(e) => setAddCategoryName(e.target.value)}
                      >
                        {catalogCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.icon || "✂️"} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    
                    <div className="os-form-row-2">
                      <div className="os-form-group">
                        <label className="os-form-label">
                          Salon Price (₹) <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="os-form-input"
                          placeholder="e.g. 650"
                          value={addPrice}
                          onChange={(e) => setAddPrice(e.target.value)}
                          required
                        />
                      </div>

                      <div className="os-form-group">
                        <label className="os-form-label">
                          Duration (Mins) <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          className="os-form-input"
                          placeholder="e.g. 45"
                          value={addDuration}
                          onChange={(e) => setAddDuration(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    
                    <div className="os-form-group">
                      <label className="os-form-label">Description / Notes</label>
                      <textarea
                        className="os-form-input"
                        rows={2}
                        placeholder="Details about steps, products used, or consultation..."
                        value={addDescription}
                        onChange={(e) => setAddDescription(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="os-modal-footer">
                <button
                  type="button"
                  className="btn-os-cancel-modal"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-os-submit-modal"
                  disabled={addingSubmitting}
                >
                  {addingSubmitting ? "Adding..." : "Add to Salon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {editModalService && (
        <div
          className="os-modal-overlay"
          onClick={() => !editingSubmitting && setEditModalService(null)}
        >
          <div className="os-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="os-modal-header">
              <h3 className="os-modal-title">Edit Service</h3>
              <button
                type="button"
                className="os-modal-close"
                onClick={() => !editingSubmitting && setEditModalService(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="os-modal-form">
              <div className="os-modal-body">
                {editFormError && (
                  <div className="os-error-box">
                    ⚠️ {editFormError}
                  </div>
                )}

                <div className="os-form-group">
                  <label className="os-form-label">Display Name</label>
                  <input
                    type="text"
                    className="os-form-input"
                    value={editCustomName}
                    onChange={(e) => setEditCustomName(e.target.value)}
                    required
                  />
                </div>

                <div className="os-form-row-2">
                  <div className="os-form-group">
                    <label className="os-form-label">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="os-form-input"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      required
                    />
                  </div>

                  <div className="os-form-group">
                    <label className="os-form-label">Duration (Mins)</label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      className="os-form-input"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="os-form-group">
                  <label className="os-form-label">Description</label>
                  <textarea
                    className="os-form-input"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="os-form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                  <input
                    type="checkbox"
                    id="editActiveCheck"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#1e392a" }}
                  />
                  <label htmlFor="editActiveCheck" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#18281e", cursor: "pointer" }}>
                    Service is active and available for customer bookings
                  </label>
                </div>
              </div>

              <div className="os-modal-footer">
                <button
                  type="button"
                  className="btn-os-cancel-modal"
                  onClick={() => setEditModalService(null)}
                  disabled={editingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-os-submit-modal"
                  disabled={editingSubmitting}
                >
                  {editingSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {deleteModalService && (
        <div
          className="os-modal-overlay"
          onClick={() => !deleting && setDeleteModalService(null)}
        >
          <div className="os-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="os-modal-header">
              <h3 className="os-modal-title" style={{ color: "#dc2626" }}>
                Remove Service
              </h3>
              <button
                type="button"
                className="os-modal-close"
                onClick={() => !deleting && setDeleteModalService(null)}
              >
                ✕
              </button>
            </div>

            <div className="os-modal-body">
              <p style={{ fontSize: "0.92rem", color: "#334155", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>{deleteModalService.effective_name}</strong> from <strong>{salonInfo.name}</strong>?
              </p>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", color: "#b91c1c" }}>
                ⚠️ Clients will no longer be able to book this service at this salon. This will not affect other salons.
              </div>
            </div>

            <div className="os-modal-footer">
              <button
                type="button"
                className="btn-os-cancel-modal"
                onClick={() => setDeleteModalService(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-os-submit-modal"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

     
      {toastMessage && <div className="os-toast">{toastMessage}</div>}

      {/* Sticky Salon Details Footer Label */}
      <OwnerStickyFooter salonInfo={salonInfo} />
    </div>
  );
}
