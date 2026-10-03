import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";

export default function Menu() {
  const [params] = useSearchParams();
  const table = params.get("table") || "?";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState({});
  const [note, setNote] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [status, setStatus] = useState("idle");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [favs, setFavs] = useState({});
  const [stripPaused, setStripPaused] = useState(false);
  const resumeTimer = useRef(null);

  useEffect(() => {
    async function loadMenu() {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) setLoadError(true);
      else setItems(data || []);
      setLoading(false);
    }
    loadMenu();
  }, []);

  const categories = ["All", "Popular", "Favourite", ...new Set(items.map((i) => i.category))];

  const visible = items.filter((i) => {
    const inCat =
      activeCat === "All" ? true :
      activeCat === "Popular" ? i.popular :
      activeCat === "Favourite" ? favs[i.id] :
      i.category === activeCat;
    const inSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return inCat && inSearch;
  });

  const popularItems = items.filter((i) => i.popular && i.available);

  const change = (id, delta) =>
    setCart((c) => {
      const qty = (c[id] || 0) + delta;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const toggleFav = (id) => setFavs((f) => ({ ...f, [id]: !f[id] }));

  const lines = items
    .filter((i) => cart[i.id])
    .map((i) => ({ ...i, qty: cart[i.id] }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * Number(l.price), 0);

  function pauseStrip() {
    setStripPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }
  function scheduleResume() {
    resumeTimer.current = setTimeout(() => setStripPaused(false), 600);
  }

  async function placeOrder() {
    setStatus("sending");
    const { error } = await supabase.from("orders").insert({
      table_no: table,
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: Number(l.price) })),
      total,
      note,
    });
    if (error) setStatus("error");
    else {
      setCart({});
      setNote("");
      setShowCart(false);
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <div className="success">
        <header className="header">
          <div className="header-logo">cafe</div>
          <div className="header-logo-sub">COFFEE BEANS</div>
        </header>

        <div className="success-body">
          <div className="success-check">✓</div>
          <h2>Order placed!</h2>
          <p>Table {table} — we'll bring it over shortly.</p>
          <button className="btn" onClick={() => setStatus("idle")}>Order more</button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-page">
      <header className="header">
        <div className="header-logo">cafe</div>
        <div className="header-logo-sub">COFFEE BEANS</div>
      </header>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search menu"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {popularItems.length > 0 && (
        <div
          className={`popular-strip${stripPaused ? " strip-paused" : ""}`}
          onPointerDown={pauseStrip}
          onPointerUp={scheduleResume}
          onPointerCancel={scheduleResume}
        >
          <p className="popular-title">Popular picks</p>
          <div className="popular-track">
            {[...popularItems, ...popularItems].map((item, i) => (
              <div key={`${item.id}-${i}`} className="popular-card">
                <div className="popular-card-img">
                  {item.image ? <img src={item.image} alt={item.name} /> : <span>🥤</span>}

                  {cart[item.id] ? (
                    <div className="qty popular-qty">
                      <button onClick={() => change(item.id, -1)}>−</button>
                      <span>{cart[item.id]}</span>
                      <button onClick={() => change(item.id, 1)}>+</button>
                    </div>
                  ) : (
                    <button className="popular-add" onClick={() => change(item.id, 1)}>+</button>
                  )}
                </div>
                <strong>{item.name}</strong>
                <span>₹{item.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="cat-label">Categories</p>
      <div className="cat-tabs">
        {categories.map((c) => (
          <button
            key={c}
            className={`cat-chip${c === activeCat ? " cat-chip-active" : ""}`}
            onClick={() => setActiveCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Loading menu...</p>}
      {loadError && <p className="error">Couldn't load the menu. Refresh to try again.</p>}

      {Object.entries(
        visible.reduce((groups, item) => {
          (groups[item.category] = groups[item.category] || []).push(item);
          return groups;
        }, {})
      ).map(([cat, catItems]) => {
        const sortedItems = [...catItems].sort((a, b) => (b.premium ? 1 : 0) - (a.premium ? 1 : 0));
        return (
          <section key={cat} className="menu-section">
            <h2 className="menu-section-title">{cat}</h2>
            <div className="item-grid">
              {sortedItems.map((item) => (
                <div key={item.id} className={`item-card${item.available ? "" : " item-card-soldout"}`}>
                  <div className="item-card-img">
                    {item.image ? <img src={item.image} alt={item.name} /> : <span>🥤</span>}
                    {item.premium && <span className="premium-badge">Chef's Pick</span>}
                    <button className="fav-btn" onClick={() => toggleFav(item.id)}>
                      {favs[item.id] ? "❤️" : "🤍"}
                    </button>
                  </div>
                  <div className="item-card-info">
                    <strong>{item.name}</strong>
                    {item.description && <p className="item-desc">{item.description}</p>}
                    <span className="item-price">₹{item.price}</span>
                  </div>
                  {!item.available ? (
                    <span className="sold-out">Sold out</span>
                  ) : cart[item.id] ? (
                    <div className="qty qty-card">
                      <button onClick={() => change(item.id, -1)}>−</button>
                      <span>{cart[item.id]}</span>
                      <button onClick={() => change(item.id, 1)}>+</button>
                    </div>
                  ) : (
                    <button className="add-fab" onClick={() => change(item.id, 1)}>+</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {count > 0 && !showCart && (
        <div className="cart-bar" onClick={() => setShowCart(true)}>
          <span>{count} items</span>
          <span>View cart · ₹{total}</span>
        </div>
      )}

      {showCart && (
        <div className="cart-panel">
          <div className="cart-top">
            <button className="cart-back" onClick={() => setShowCart(false)}>←</button>
            <h2>My cart</h2>
          </div>
          {lines.map((l) => (
            <div key={l.id} className="cart-line">
              <div className="cart-line-icon">
                {l.image ? <img src={l.image} alt={l.name} /> : "🥤"}
              </div>
              <div className="cart-line-info">
                <strong>{l.name}</strong>
                <span className="cart-line-price">₹{l.price}</span>
              </div>
              <div className="qty">
                <button onClick={() => change(l.id, 1)}>+</button>
                <span>{l.qty}</span>
                <button onClick={() => change(l.id, -1)}>−</button>
              </div>
            </div>
          ))}
          <textarea
            className="note"
            placeholder="Any note? (e.g. less sugar)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cart-summary">
            <div className="cart-summary-row"><span>Cart</span><span>₹{total}</span></div>
            <div className="cart-summary-row cart-summary-total"><span>Total</span><span>₹{total}</span></div>
          </div>
          {status === "error" && <p className="error">Couldn't send order. Please try again.</p>}
          <button className="checkout-btn" onClick={placeOrder} disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Check Out"}
          </button>
        </div>
      )}
    </div>
  );
}