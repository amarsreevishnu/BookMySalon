import { useAuth } from "../../hooks/useAuth";


function CustomerHero({
  search,
  setSearch,
  selectedFilter,
  setSelectedFilter,
  onSearch,
}) {
  const { user } = useAuth();

  return (
    <section className="customer-hero">
      <div className="customer-hero-top">
        <div>
          <h1>
            Hello, {user?.first_name || "there"} <span>👋</span>
          </h1>

          <p>
            Ready for your next self-care session? Here is what is open and
            available right now.
          </p>
        </div>

        <div className="current-location">
          <span>📍</span>
          <div>
            <small>CURRENT LOCATION</small>
            <strong>Thiruvananthapuram</strong>
          </div>
          <span>⌄</span>
        </div>
      </div>

      <div className="availability-message">
        <span>●</span>
        14 botanical & partner salons open near you with live slots
      </div>

      <div className="customer-search">
        <span className="search-symbol">🔍</span>

        <input
          type="text"
          placeholder="Search salons, services (haircut, spa, facial)..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
        />

        <button type="button" onClick={onSearch}>
          Find Salons →
        </button>
      </div>

      <div className="quick-filters">
        <span>QUICK FILTERS:</span>

        <button
          type="button"
          className={selectedFilter === "Open Now" ? "active" : ""}
          onClick={() => setSelectedFilter("Open Now")}
        >
          ● Open Now
        </button>

        <button
          type="button"
          className={selectedFilter === "Near Me" ? "active" : ""}
          onClick={() => setSelectedFilter("Near Me")}
        >
          📍 Near Me
        </button>

        <button
          type="button"
          className={selectedFilter === "Top Rated" ? "active" : ""}
          onClick={() => setSelectedFilter("Top Rated")}
        >
          ★ Top Rated
        </button>

        <button
          type="button"
          className={selectedFilter === "Offers" ? "active" : ""}
          onClick={() => setSelectedFilter("Offers")}
        >
          🏷 Offers
        </button>

        <button
          type="button"
          className={selectedFilter === "All" ? "active" : ""}
          onClick={() => setSelectedFilter("All")}
        >
          All Salons
        </button>
      </div>
    </section>
  );
}

export default CustomerHero;