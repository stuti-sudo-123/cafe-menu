import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { THEMES, THEME_KEYS } from "../popularThemes.js";

const rupee = (n) => `₹${n}`;

// Top-level parts, in display order. `id` must match the "section" column.
const SECTION_META = [
  { id: "beverages", label: "Beverages" },
  { id: "food", label: "Food" },
];

// Small notes that aren't dishes. Keys: slug of the category / exact group name.
const CATEGORY_NOTES = {
  coffee: "Add-ons for ₹30: vanilla, caramel, hazelnut, irish, mocha, biscoff, nutella, blueberry, coconut.",
};
const GROUP_NOTES = {
  Tonic: "Choose ginger ale, Red Bull or tonic.",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Rows from menu_items -> section > category > group > items (rows arrive ordered by sort_order).
function buildSections(rows) {
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
          price: Number(r.price),
          desc: r.description || "",
          chef: !!r.premium,
          available: r.available !== false,
          section: meta.id,
          popular: !!r.popular,
          image: r.image || "",
          theme: r.pop_theme || "",
        });
      });
    return { ...meta, categories };
  }).filter((s) => s.categories.length);
}

// The carousel shows every dish the admin ticked as "Popular pick".
function PopularCard({ card, hidden }) {
  const { item } = card;
  return (
    <div className="popular-card" style={{ "--card-bg": card.bg, "--card-fg": card.fg }} aria-hidden={hidden || undefined}>
      {card.img ? (
        <img className="popular-card-img" src={card.img} alt={hidden ? "" : item.name} draggable="false" />
      ) : (
        <div className="popular-card-emoji" aria-hidden="true">{item.section === "food" ? "🍽️" : "☕"}</div>
      )}
      <strong>{item.name}</strong>
      <div className="popular-card-row">
        {item.available ? (
          <span className="popular-card-price">{rupee(item.price)}</span>
        ) : (
          <span className="popular-card-sold">Sold out</span>
        )}
      </div>
    </div>
  );
}

// Horizontal carousel: drifts left by itself, pauses while touched / hovered, and can be swiped.
function PopularStrip({ cards }) {
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

  // With only a few picks, repeat them so the loop is always wider than the screen.
  const repeat = Math.max(1, Math.ceil(4 / cards.length));
  const base = Array.from({ length: repeat }).flatMap(() => cards);

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
      >
        {[0, 1].flatMap((copy) =>
          base.map((card, i) => (
            <PopularCard key={`${card.key}-${copy}-${i}`} card={card} hidden={copy === 1 || i >= cards.length} />
          ))
        )}
      </div>
    </section>
  );
}

function Dish({ item, where }) {
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
        {!item.available && <p className="dish-sold">Sold out</p>}
        {where && <p className="dish-where">{where}</p>}
      </div>
    </li>
  );
}

export default function Menu() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sectionId, setSectionId] = useState(SECTION_META[0].id);
  const [catId, setCatId] = useState("");
  const [search, setSearch] = useState("");

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

  const popularCards = everything
    .map((e) => e.item)
    .filter((i) => i.popular)
    .map((item, i) => {
      const theme = THEMES[item.theme] || THEMES[THEME_KEYS[i % THEME_KEYS.length]];
      return { key: item.id, item, img: item.image, bg: theme.bg, fg: theme.fg };
    });

  return (
    <div className="menu-page">
      <header className="header">
        <img src="/images/logo-red.png" alt="Lower Ground Coffee" className="header-logo-img" />
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

      {!q && popularCards.length > 0 && <PopularStrip cards={popularCards} />}

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
                    <Dish key={item.id} item={item} where={where} />
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
                        <Dish key={item.id} item={item} />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}
