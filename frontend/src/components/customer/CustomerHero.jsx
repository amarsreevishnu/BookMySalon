function CustomerHero({
  search,
  setSearch,
  selectedFilter,
  setSelectedFilter,
  onSearch,
}) {
  return (
    <section className="customer-hero">
      <div className="customer-hero-top">
        <div>
          <h1>
            Hello, Vishnu <span>👋</span>
          </h1>

          <p>
            Ready for your next self-care session? Here is what is open and
            available right now.
          </p>
        </div>

        <div className="current-location">
          <span>⌖</span>
          <div>
            <small>CURRENT LOCATION</small>
            <strong>Thiruvananthapuram</strong>
          </div>
          <span>⌄</span>
        </div>
      </div>

      <div className="availability-message">
        <span>✦</span>
        14 salons open near you with available slots
      </div>

      <div className="customer-search">
        <span className="search-symbol">⌕</span>

        <input
          type="text"
          placeholder="Search salons, services, or treatments..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
        />

        <button onClick={onSearch}>Find it</button>
      </div>

      <div className="quick-filters">
        <span>QUICK FILTERS:</span>

        <button
          className={selectedFilter === "Open Now" ? "active" : ""}
          onClick={() => setSelectedFilter("Open Now")}
        >
          ● Open Now
        </button>

        <button
          className={selectedFilter === "Near Me" ? "active" : ""}
          onClick={() => setSelectedFilter("Near Me")}
        >
          ⌖ Near Me
        </button>

        <button
          className={selectedFilter === "Top Rated" ? "active" : ""}
          onClick={() => setSelectedFilter("Top Rated")}
        >
          ★ Top Rated
        </button>

        <button
          className={selectedFilter === "Offers" ? "active" : ""}
          onClick={() => setSelectedFilter("Offers")}
        >
          ♧ Offers
        </button>

        <button
          className={selectedFilter === "All" ? "active" : ""}
          onClick={() => setSelectedFilter("All")}
        >
          All
        </button>
      </div>
    </section>
  );
}

export default CustomerHero;