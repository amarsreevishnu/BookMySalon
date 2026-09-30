import { useState, useEffect, useMemo } from "react";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "../../styles/adminServices.css";

export default function AdminServicesList() {
  const [activeTab, setActiveTab] = useState("services"); // 'services' | 'categories'

  // Data states
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({
    categories: { total: 0, active: 0, inactive: 0 },
    services: { total: 0, active: 0, inactive: 0 },
    salon_offerings: { total: 0, active: 0 },
  });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [selectedGenderFilter, setSelectedGenderFilter] = useState("ALL");

  // Modals state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon: "✂️",
    description: "",
    display_order: 0,
    is_active: true,
  });

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    category: "",
    name: "",
    description: "",
    standard_price: 500,
    standard_duration: 45,
    gender_target: "ALL",
    is_active: true,
  });

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'category' | 'service', id, name }
  const [toastMessage, setToastMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Fetch initial catalog data
  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [statsRes, catRes, srvRes] = await Promise.all([
        api.get("/services/admin/stats/").catch(() => null),
        api.get("/services/admin/categories/").catch(() => null),
        api.get("/services/admin/services/").catch(() => null),
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (catRes?.data) setCategories(catRes.data);
      if (srvRes?.data) setServices(srvRes.data);
    } catch (err) {
      console.error("Failed to fetch catalog:", err);
      showToast("Notice: Loaded standard baseline catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  // Filtered standard services
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        srv.name.toLowerCase().includes(q) ||
        (srv.description && srv.description.toLowerCase().includes(q)) ||
        srv.category_name?.toLowerCase().includes(q);

      const matchCat =
        selectedCategoryFilter === "ALL" ||
        String(srv.category) === String(selectedCategoryFilter);

      const matchStatus =
        selectedStatusFilter === "ALL" ||
        (selectedStatusFilter === "ACTIVE" && srv.is_active) ||
        (selectedStatusFilter === "INACTIVE" && !srv.is_active);

      const matchGender =
        selectedGenderFilter === "ALL" || srv.gender_target === selectedGenderFilter;

      return matchSearch && matchCat && matchStatus && matchGender;
    });
  }, [services, searchQuery, selectedCategoryFilter, selectedStatusFilter, selectedGenderFilter]);

  // Seed baseline catalog
  const handleSeedCatalog = async () => {
    try {
      const res = await api.post("/services/admin/seed/");
      showToast(res.data?.message || "Catalog initialized successfully!");
      loadCatalogData();
    } catch (err) {
      console.error("Failed to seed catalog:", err);
      showToast("Error initializing catalog.");
    }
  };

  // ============================================================================
  // Category Actions
  // ============================================================================
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      icon: "✂️",
      description: "",
      display_order: categories.length,
      is_active: true,
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      icon: cat.icon || "✂️",
      description: cat.description || "",
      display_order: cat.display_order || 0,
      is_active: cat.is_active,
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCategory) {
        await api.patch(`/services/admin/categories/${editingCategory.id}/`, categoryForm);
        showToast(`Category '${categoryForm.name}' updated successfully!`);
      } else {
        await api.post("/services/admin/categories/", categoryForm);
        showToast(`Category '${categoryForm.name}' created successfully!`);
      }
      setCategoryModalOpen(false);
      loadCatalogData();
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || "Failed to save category.";
      showToast(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    try {
      const updatedStatus = !cat.is_active;
      await api.patch(`/services/admin/categories/${cat.id}/`, {
        is_active: updatedStatus,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: updatedStatus } : c))
      );
      showToast(
        `Category '${cat.name}' ${updatedStatus ? "activated" : "deactivated"}!`
      );
    } catch {
      showToast("Failed to update category status.");
    }
  };

  // ============================================================================
  // Service Actions
  // ============================================================================
  const openCreateService = () => {
    setEditingService(null);
    setServiceForm({
      category: categories[0]?.id || "",
      name: "",
      description: "",
      standard_price: 500,
      standard_duration: 45,
      gender_target: "ALL",
      is_active: true,
    });
    setServiceModalOpen(true);
  };

  const openEditService = (srv) => {
    setEditingService(srv);
    setServiceForm({
      category: srv.category,
      name: srv.name,
      description: srv.description || "",
      standard_price: srv.standard_price,
      standard_duration: srv.standard_duration,
      gender_target: srv.gender_target || "ALL",
      is_active: srv.is_active,
    });
    setServiceModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingService) {
        await api.patch(`/services/admin/services/${editingService.id}/`, serviceForm);
        showToast(`Service '${serviceForm.name}' updated!`);
      } else {
        await api.post("/services/admin/services/", serviceForm);
        showToast(`Service '${serviceForm.name}' added to catalog!`);
      }
      setServiceModalOpen(false);
      loadCatalogData();
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || "Failed to save service.";
      showToast(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleServiceActive = async (srv) => {
    try {
      const updatedStatus = !srv.is_active;
      await api.patch(`/services/admin/services/${srv.id}/`, {
        is_active: updatedStatus,
      });
      setServices((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, is_active: updatedStatus } : s))
      );
      showToast(
        `Service '${srv.name}' ${updatedStatus ? "activated" : "deactivated"} in catalog!`
      );
    } catch {
      showToast("Failed to toggle service status.");
    }
  };

  // ============================================================================
  // Delete Handler
  // ============================================================================
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "category") {
        await api.delete(`/services/admin/categories/${deleteConfirm.id}/`);
        showToast(`Category '${deleteConfirm.name}' removed.`);
      } else {
        await api.delete(`/services/admin/services/${deleteConfirm.id}/`);
        showToast(`Service '${deleteConfirm.name}' removed from catalog.`);
      }
      setDeleteConfirm(null);
      loadCatalogData();
    } catch {
      showToast("Failed to delete item.");
    }
  };

  return (
    <div className="admin-services-page">
      <AdminSidebar activeTab="SERVICES" />

      <div className="admin-services-main">
        {/* Top Header Bar */}
        <header className="admin-services-topbar">
          <div className="admin-services-title-area">
            <h1>Platform Services &amp; Master Catalog</h1>
            <span className="admin-catalog-badge">SUPER ADMIN</span>
          </div>

          <div className="admin-services-actions">
            <button
              type="button"
              className="btn-admin-sec"
              onClick={handleSeedCatalog}
              title="Verify or seed standard baseline categories and services"
            >
              <span>⚡</span> Sync Starter Catalog
            </button>
            <button
              type="button"
              className="btn-admin-sec"
              onClick={openCreateCategory}
            >
              <span>+</span> New Category
            </button>
            <button
              type="button"
              className="btn-admin-pri"
              onClick={openCreateService}
            >
              <span>+</span> Add Catalog Service
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="admin-services-content">
          {/* KPI Analytics Bar */}
          <section className="admin-services-kpi-grid">
            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <span className="admin-kpi-label">Categories</span>
                <span className="admin-kpi-icon">📁</span>
              </div>
              <div className="admin-kpi-value">{categories.length}</div>
              <div className="admin-kpi-sub">
                <span className="active">
                  {categories.filter((c) => c.is_active).length} Active
                </span>{" "}
                •{" "}
                <span className="inactive">
                  {categories.filter((c) => !c.is_active).length} Inactive
                </span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <span className="admin-kpi-label">Standard Services</span>
                <span className="admin-kpi-icon">✂️</span>
              </div>
              <div className="admin-kpi-value">{services.length}</div>
              <div className="admin-kpi-sub">
                <span className="active">
                  {services.filter((s) => s.is_active).length} Active in Catalog
                </span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <span className="admin-kpi-label">Salon Offerings</span>
                <span className="admin-kpi-icon">🏪</span>
              </div>
              <div className="admin-kpi-value">
                {stats.salon_offerings?.total || 0}
              </div>
              <div className="admin-kpi-sub">
                Across registered salon partner menus
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <span className="admin-kpi-label">Catalog Health</span>
                <span className="admin-kpi-icon">🛡️</span>
              </div>
              <div className="admin-kpi-value">
                {services.length > 0
                  ? `${Math.round(
                      (services.filter((s) => s.is_active).length / services.length) * 100
                    )}%`
                  : "100%"}
              </div>
              <div className="admin-kpi-sub">Active availability ratio</div>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="admin-services-tabs-bar">
            <div className="admin-services-tab-group">
              <button
                type="button"
                className={`btn-catalog-tab ${activeTab === "services" ? "active" : ""}`}
                onClick={() => setActiveTab("services")}
              >
                <span>Standard Services Catalog</span>
                <span className="admin-tab-count">{filteredServices.length}</span>
              </button>
              <button
                type="button"
                className={`btn-catalog-tab ${activeTab === "categories" ? "active" : ""}`}
                onClick={() => setActiveTab("categories")}
              >
                <span>Service Categories</span>
                <span className="admin-tab-count">{categories.length}</span>
              </button>
            </div>
          </div>

          {/* ================================================================
              TAB 1: SERVICES CATALOG
              ================================================================ */}
          {activeTab === "services" && (
            <>
              {/* Filter Controls Bar */}
              <div className="admin-filter-bar">
                <div className="admin-search-wrapper">
                  <span className="admin-search-icon">🔍</span>
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search services by name, description, category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="admin-filter-group">
                  <select
                    className="admin-filter-select"
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="admin-filter-select"
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active in Catalog</option>
                    <option value="INACTIVE">Deactivated</option>
                  </select>

                  <select
                    className="admin-filter-select"
                    value={selectedGenderFilter}
                    onChange={(e) => setSelectedGenderFilter(e.target.value)}
                  >
                    <option value="ALL">All Targets</option>
                    <option value="ALL">Unisex</option>
                    <option value="MALE">Men</option>
                    <option value="FEMALE">Women</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>
              </div>

              {/* Services Table Card */}
              <div className="admin-table-card">
                {loading ? (
                  <div className="admin-empty-state">
                    <p>Loading platform catalog...</p>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="admin-empty-state">
                    <h3>No Services Found</h3>
                    <p>No services matched your filter or search criteria.</p>
                  </div>
                ) : (
                  <table className="admin-services-table">
                    <thead>
                      <tr>
                        <th>Service Name</th>
                        <th>Category</th>
                        <th>Benchmark Price</th>
                        <th>Standard Duration</th>
                        <th>Target</th>
                        <th>Salon Adoptions</th>
                        <th>Catalog Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((srv) => (
                        <tr key={srv.id}>
                          <td>
                            <strong style={{ color: "#ffffff", fontSize: "14px" }}>
                              {srv.name}
                            </strong>
                            {srv.description && (
                              <div style={{ color: "#94a3b8", fontSize: "11.5px", marginTop: "2px" }}>
                                {srv.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge-category-tag">
                              {srv.category_icon} {srv.category_name}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: "#34d399" }}>
                              ₹{parseFloat(srv.standard_price).toLocaleString()}
                            </strong>
                          </td>
                          <td>⏱ {srv.standard_duration} mins</td>
                          <td>
                            <span className={`badge-gender ${srv.gender_target}`}>
                              {srv.gender_target === "ALL"
                                ? "Unisex"
                                : srv.gender_target === "MALE"
                                ? "Men"
                                : srv.gender_target === "FEMALE"
                                ? "Women"
                                : "Kids"}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                              {srv.salon_offerings_count || 0} salons
                            </span>
                          </td>
                          <td>
                            <label className="admin-toggle-switch" title="Toggle catalog availability">
                              <input
                                type="checkbox"
                                checked={srv.is_active}
                                onChange={() => handleToggleServiceActive(srv)}
                              />
                              <span className="admin-toggle-slider" />
                            </label>
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="btn-table-action"
                                onClick={() => openEditService(srv)}
                                title="Edit Service"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn-table-action delete"
                                onClick={() =>
                                  setDeleteConfirm({
                                    type: "service",
                                    id: srv.id,
                                    name: srv.name,
                                  })
                                }
                                title="Delete Service"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ================================================================
              TAB 2: SERVICE CATEGORIES
              ================================================================ */}
          {activeTab === "categories" && (
            <div className="admin-categories-cards-grid">
              {categories.map((cat) => (
                <div key={cat.id} className="admin-category-card">
                  <div className="admin-cat-card-top">
                    <div className="admin-cat-icon-name">
                      <div className="admin-cat-icon-box">{cat.icon || "✂️"}</div>
                      <div>
                        <h3 className="admin-cat-name">{cat.name}</h3>
                        <div className="admin-cat-slug">/{cat.slug}</div>
                      </div>
                    </div>

                    <span
                      className={`badge-status ${cat.is_active ? "active" : "inactive"}`}
                    >
                      {cat.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>

                  <p className="admin-cat-desc">
                    {cat.description || "No description provided for this category."}
                  </p>

                  <div className="admin-cat-stats-row">
                    <span>
                      Standard Services: <strong>{cat.services_count || 0}</strong>
                    </span>
                    <span>
                      Order: <strong>#{cat.display_order}</strong>
                    </span>
                  </div>

                  <div className="admin-cat-card-footer">
                    <label className="admin-toggle-switch" title="Toggle active status">
                      <input
                        type="checkbox"
                        checked={cat.is_active}
                        onChange={() => handleToggleCategoryActive(cat)}
                      />
                      <span className="admin-toggle-slider" />
                    </label>

                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={() => openEditCategory(cat)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn-table-action delete"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "category",
                            id: cat.id,
                            name: cat.name,
                          })
                        }
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          MODAL: CREATE / EDIT CATEGORY
          ==================================================================== */}
      {categoryModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setCategoryModalOpen(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingCategory ? "Edit Category" : "New Service Category"}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setCategoryModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    placeholder="e.g. Hair, Skin, Spa, Nails"
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                  />
                </div>

                <div className="admin-form-group">
                  <label>Category Icon (Emoji or identifier)</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. ✂️, ✨, 🌿, 💅"
                    value={categoryForm.icon}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, icon: e.target.value })
                    }
                  />
                </div>

                <div className="admin-form-group">
                  <label>Display Order (Sorting)</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={categoryForm.display_order}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        display_order: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="admin-form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    className="admin-form-textarea"
                    placeholder="Brief description of the services categorized under this department..."
                    value={categoryForm.description}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label className="admin-toggle-switch">
                    <input
                      type="checkbox"
                      checked={categoryForm.is_active}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, is_active: e.target.checked })
                      }
                    />
                    <span className="admin-toggle-slider" />
                  </label>
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>
                    Active in Platform Catalog
                  </span>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-admin-sec"
                  onClick={() => setCategoryModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-admin-pri" disabled={saving}>
                  {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CREATE / EDIT STANDARD SERVICE
          ==================================================================== */}
      {serviceModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setServiceModalOpen(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                {editingService ? "Edit Standard Service" : "Add Service to Platform Catalog"}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setServiceModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveService}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Parent Category *</label>
                  <select
                    required
                    className="admin-form-select"
                    value={serviceForm.category}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, category: e.target.value })
                    }
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label>Service Name *</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    placeholder="e.g. Precision Haircut & Styling"
                    value={serviceForm.name}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, name: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="admin-form-group">
                    <label>Benchmark Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="50"
                      className="admin-form-input"
                      value={serviceForm.standard_price}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          standard_price: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Duration (Minutes) *</label>
                    <input
                      type="number"
                      required
                      min={5}
                      step={5}
                      className="admin-form-input"
                      value={serviceForm.standard_duration}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          standard_duration: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label>Target Audience</label>
                  <select
                    className="admin-form-select"
                    value={serviceForm.gender_target}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, gender_target: e.target.value })
                    }
                  >
                    <option value="ALL">Unisex / All</option>
                    <option value="MALE">Men Only</option>
                    <option value="FEMALE">Women Only</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    className="admin-form-textarea"
                    placeholder="Standard steps, key benefits, and recommended hair/skin types..."
                    value={serviceForm.description}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, description: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label className="admin-toggle-switch">
                    <input
                      type="checkbox"
                      checked={serviceForm.is_active}
                      onChange={(e) =>
                        setServiceForm({ ...serviceForm, is_active: e.target.checked })
                      }
                    />
                    <span className="admin-toggle-slider" />
                  </label>
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>
                    Available in Platform Catalog (Salons can adopt this service)
                  </span>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-admin-sec"
                  onClick={() => setServiceModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-admin-pri" disabled={saving}>
                  {saving ? "Saving..." : editingService ? "Update Service" : "Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DELETE CONFIRMATION
          ==================================================================== */}
      {deleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Confirm Deletion</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setDeleteConfirm(null)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
                Are you sure you want to permanently delete {deleteConfirm.type === "category" ? "category" : "service"}{" "}
                <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>?
              </p>
              {deleteConfirm.type === "category" && (
                <p style={{ margin: "8px 0 0", color: "#f87171", fontSize: "12px" }}>
                  Warning: All standard services and salon offerings under this category will also be affected.
                </p>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-admin-sec"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-pri"
                style={{ background: "#dc2626" }}
                onClick={executeDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-notice">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
