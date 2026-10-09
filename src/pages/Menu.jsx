import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";

const rupee = (n) => `₹${n}`;

// Top-level parts, in display order. `id` must match the "section" column.
const SECTION_META = [
  { id: "beverages", label: "Beverages" },
  { id: "food", label: "Food" },
];

// Small notes that aren't dishes. Keys: slug of the category / exact group name.
const CATEGORY_NOTES = {
  coffee: "Add-ons for ₹30: vanilla, caramel, hazelnut, irish, mocha, biscoff, nutella, blueberry, coconut. Tell us in the order note.",
};
const GROUP_NOTES = {
  Tonic: "Choose ginger ale, Red Bull or tonic.",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Rows from menu_items -> section > category > group > items (rows arrive ordered by sort_order).
function buildSections(rows) {
  // Names that appear twice (e.g. "Oreo" shake and cheesecake) get their group added in the order,
  // so the kitchen knows which one was meant.
  const seen = {};
  rows.forEach((r) => {
    const k = r.name.toLowerCase();
    seen[k] = (seen[k] || 0) + 1;
  });

  return SECTION_META.map((meta) => {
    const categories = [];
    rows
      .filter((r) => (r.section || "food") === meta.id)
      .forEach((r) => {
        let cat = categories.find((c) => c.label === r.category);
        if (!cat) {
          cat = { id: slug(r.category), label: r.category, note: CATEGORY_NOTES[slug(r.category)], groups: [] };
          categories.push(cat);
        }
        const groupName = r.grp || null;
        let group = cat.groups.find((g) => g.name === groupName);
        if (!group) {
          group = { name: groupName, note: groupName ? GROUP_NOTES[groupName] : undefined, items: [] };
          cat.groups.push(group);
        }
        group.items.push({
          id: r.id,
          name: r.name,
          orderName: seen[r.name.toLowerCase()] > 1 ? `${r.name} (${groupName || r.category})` : r.name,
          price: Number(r.price),
          desc: r.description || "",
          chef: !!r.premium,
          available: r.available !== false,
          section: meta.id,
        });
      });
    return { ...meta, categories };
  }).filter((s) => s.categories.length);
}

// Popular picks = the dishes from the welcome page. `find` is the dish's name on the menu (lower-case);
// when a dish with that name exists the card shows its price and can be ordered.
const POPULAR = [
  { find: "tiramisu", name: "Tiramisu", img: "/images/tiramisu.png", bg: "#4a2f22", fg: "#fbeee0" },
  { find: "pizz & love", name: "Pizza and Love", img: "/images/pizza.png", bg: "#c8362d", fg: "#fff3e8" },
  { find: "carrot cake", name: "Carrot Cake", img: "/images/carrotCake.png", bg: "#f2c98f", fg: "#3a2210" },
  { find: "matcha latte", name: "Matcha Latte", img: "/images/matchaLatte.png", bg: "#2f4a2a", fg: "#eef5dc" },
  { find: "edamame falafel", name: "Edamame Falafel", img: "/images/cucumberToast.png", bg: "#e3d7a3", fg: "#34290f" },
  { find: "feta & olives", name: "Feta & Olives", img: "/images/fetaOlives.png", bg: "#55602b", fg: "#f7f3d6" },
];

function PopularCard({ card, qty, onAdd, onRemove, hidden }) {
  const { item } = card;
  const tab = hidden ? -1 : undefined;
  return (
    <div className="popular-card" style={{ "--card-bg": card.bg, "--card-fg": card.fg }} aria-hidden={hidden || undefined}>
      <img className="popular-card-img" src={card.img} alt={hidden ? "" : card.name} draggable="false" />
      <strong>{item ? item.name : card.name}</strong>
      <div className="popular-card-row">
        {item && <span className="popular-card-price">{rupee(item.price)}</span>}
        {item && !item.available && <span className="popular-card-sold">Sold out</span>}
        {item &&
          item.available &&
          (qty ? (
            <div className="qty">
              <button type="button" tabIndex={tab} onClick={() => onRemove(item.id)} aria-label={`Remove one ${item.name}`}>−</button>
              <span>{qty}</span>
              <button type="button" tabIndex={tab} onClick={() => onAdd(item.id)} aria-label={`Add one ${item.name}`}>+</button>
            </div>
          ) : (
            <button type="button" tabIndex={tab} className="popular-add" onClick={() => onAdd(item.id)} aria-label={`Add ${item.name}`}>
              +
            </button>
          ))}
      </div>
    </div>
  );
}

// Horizontal carousel: drifts left by itself, pauses while touched / hovered, and can be swiped.
function PopularStrip({ cards, cart, onAdd, onRemove }) {
  const trackRef = useRef(null);
  const paused = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf;
    let last = performance.now();
    let pos = el.scrollLeft;
    const SPEED = 0.03; // pixels per ms (about 30px a second)

    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (paused.current || reduce) {
        pos = el.scrollLeft; // follow the user's own swiping
      } else {
        pos += dt * SPEED;
        const half = el.scrollWidth / 2; // the list is rendered twice for a seamless loop
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer.current);
    };
  }, [cards.length]);

  const hold = () => {
    paused.current = true;
    clearTimeout(timer.current);
  };
  const release = (ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (paused.current = false), ms);
  };

  return (
    <section className="popular-strip">
      <h2 className="popular-title">Popular picks</h2>
      <div
        className="popular-track"
        ref={trackRef}
        onMouseEnter={hold}
        onMouseLeave={() => release(300)}
        onTouchStart={hold}
        onTouchEnd={() => release(1800)}
        onTouchCancel={() => release(1800)}
        onFocus={hold}
        onBlur={() => release(600)}
      >
        {[0, 1].flatMap((copy) =>
          cards.map((card) => (
            <PopularCard
              key={`${card.find}-${copy}`}
              card={card}
              hidden={copy === 1}
              qty={card.item ? cart[card.item.id] : 0}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Dish({ item, qty, onAdd, onRemove, where }) {
  return (
    <li className={`dish ${item.available ? "" : "dish-soldout"}`}>
      <div className="dish-main">
        {item.chef && <p className="dish-pick">★ Chef's Choice</p>}
        <div className="dish-line">
          <span className="dish-name">{item.name}</span>
          <span className="dish-dots" aria-hidden="true" />
          <span className="dish-price">{rupee(item.price)}</span>
        </div>
        {item.desc && <p className="dish-desc">{item.desc}</p>}
        {where && <p className="dish-where">{where}</p>}
      </div>

      <div className="dish-add">
        {!item.available ? (
          <span className="sold-out">Sold out</span>
        ) : qty ? (
          <div className="qty">
            <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove one ${item.name}`}>−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => onAdd(item.id)} aria-label={`Add one ${item.name}`}>+</button>
          </div>
        ) : (
          <button type="button" className="dish-plus" onClick={() => onAdd(item.id)} aria-label={`Add ${item.name}`}>
            +
          </button>
        )}
      </div>
    </li>
  );
}

export default function Menu() {
  const [params] = useSearchParams();
  const table = params.get("table") || "?";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sectionId, setSectionId] = useState(SECTION_META[0].id);
  const [catId, setCatId] = useState("");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState({}); // id -> qty
  const [note, setNote] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | error | done

  // ---- load the menu ----
  useEffect(() => {
    supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        else setRows(data || []);
        setLoading(false);
      });
  }, []);

  const sections = useMemo(() => buildSections(rows), [rows]);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const category = section?.categories.find((c) => c.id === catId) ?? section?.categories[0];

  const pickSection = (s) => {
    setSectionId(s.id);
    setCatId(s.categories[0].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const pickCategory = (c) => {
    setCatId(c.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- search across the whole menu ----
  const everything = useMemo(
    () =>
      sections.flatMap((s) =>
        s.categories.flatMap((c) =>
          c.groups.flatMap((g) => g.items.map((item) => ({ item, where: `${s.label} · ${g.name || c.label}` })))
        )
      ),
    [sections]
  );
  const q = search.trim().toLowerCase();
  const results = q
    ? everything.filter(({ item }) => item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
    : [];

  const popularCards = POPULAR.map((p) => ({
    ...p,
    item: everything.map((e) => e.item).find((i) => i.name.toLowerCase() === p.find) || null,
  }));

  // ---- cart ----
  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const remove = (id) =>
    setCart((c) => {
      const qty = (c[id] || 0) - 1;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const lines = everything
    .map(({ item }) => item)
    .filter((i) => cart[i.id])
    .map((i) => ({ ...i, qty: cart[i.id] }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  async function placeOrder() {
    setStatus("sending");
    const { error } = await supabase.from("orders").insert({
      table_no: table,
      items: lines.map((l) => ({ name: l.orderName, qty: l.qty, price: l.price })),
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
          <img src="/images/logo-red.png" alt="Lower Ground Coffee" className="header-logo-img" />
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
        <img src="/images/logo-red.png" alt="Lower Ground Coffee" className="header-logo-img" />
        {table !== "?" && <div className="table-label">Table {table}</div>}
      </header>

      <div className="search-bar">
        <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          placeholder="Search the menu"
          aria-label="Search the menu"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      {loading && <p className="loading">Loading menu...</p>}
      {loadError && <p className="error">Couldn't load the menu. Refresh to try again.</p>}

      {!q && sections.length > 0 && (
        <PopularStrip cards={popularCards} cart={cart} onAdd={add} onRemove={remove} />
      )}

      {category && (
        <>
          {/* Part 1: Beverages / Food  ·  Part 2: category tabs */}
          {!q && (
            <nav className="menu-nav">
              <div className="menu-switch">
                {sections.map((s) => (
                  <button key={s.id} type="button" aria-pressed={s.id === section.id} onClick={() => pickSection(s)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="menu-tabs">
                {section.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="menu-tab"
                    aria-current={c.id === category.id ? "true" : undefined}
                    onClick={() => pickCategory(c)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </nav>
          )}

          <main className="menu-body">
            {q ? (
              results.length ? (
                <ul className="dish-list">
                  {results.map(({ item, where }) => (
                    <Dish key={item.id} item={item} where={where} qty={cart[item.id]} onAdd={add} onRemove={remove} />
                  ))}
                </ul>
              ) : (
                <p className="menu-empty">Nothing matches “{search}”.</p>
              )
            ) : (
              <>
                {category.note && <p className="menu-note">{category.note}</p>}
                {category.groups.map((g, gi) => (
                  <section className="menu-group" key={gi}>
                    {g.name && <h2 className="menu-group-title">{g.name}</h2>}
                    {g.note && <p className="menu-group-note">{g.note}</p>}
                    <ul className="dish-list">
                      {g.items.map((item) => (
                        <Dish key={item.id} item={item} qty={cart[item.id]} onAdd={add} onRemove={remove} />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </main>
        </>
      )}

      {count > 0 && !showCart && (
        <div className="cart-bar" onClick={() => setShowCart(true)}>
          <span>{count} {count === 1 ? "item" : "items"}</span>
          <span>View cart · {rupee(total)}</span>
        </div>
      )}

      {showCart && (
        <div className="cart-panel">
          <div className="cart-top">
            <button className="cart-back" onClick={() => setShowCart(false)} aria-label="Back to menu">←</button>
            <h2>My cart</h2>
          </div>
          {lines.map((l) => (
            <div key={l.id} className="cart-line">
              <div className="cart-line-icon">{l.section === "food" ? "🍽️" : "☕"}</div>
              <div className="cart-line-info">
                <strong>{l.orderName}</strong>
                <span className="cart-line-price">{rupee(l.price)}</span>
              </div>
              <div className="qty">
                <button onClick={() => remove(l.id)} aria-label={`Remove one ${l.name}`}>−</button>
                <span>{l.qty}</span>
                <button onClick={() => add(l.id)} aria-label={`Add one ${l.name}`}>+</button>
              </div>
            </div>
          ))}
          <textarea
            className="note"
            placeholder="Any note? (e.g. less sugar, add vanilla)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cart-summary">
            <div className="cart-summary-row"><span>Cart</span><span>{rupee(total)}</span></div>
            <div className="cart-summary-row cart-summary-total"><span>Total</span><span>{rupee(total)}</span></div>
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
