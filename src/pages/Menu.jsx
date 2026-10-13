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
  const [search, setSearch] = useState("");
  const [active, setActive] = useState({ part: "", cat: "" }); // what is on screen right now
  const [navH, setNavH] = useState(120); // height of the sticky bar, so jumps stop just below it

  const navRef = useRef(null);
  const tabsRef = useRef(null);

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

  // ---- jumping around the long page ----
  const goTo = (id) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // measure the sticky bar
  useEffect(() => {
    const measure = () => navRef.current && setNavH(navRef.current.offsetHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [sections.length, q]);

  // scroll-spy: work out which part and category is under the sticky bar
  useEffect(() => {
    if (q || !sections.length) return;
    let ticking = false;

    const update = () => {
      ticking = false;
      const marks = Array.from(document.querySelectorAll("[data-spy]"));
      if (!marks.length) return;
      const line = navH + 24;
      let current = marks[0];
      for (const el of marks) {
        if (el.getBoundingClientRect().top <= line) current = el;
        else break;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = marks[marks.length - 1]; // very bottom of the page = last category
      }
      const next = { part: current.dataset.part, cat: current.dataset.cat };
      setActive((prev) => (prev.part === next.part && prev.cat === next.cat ? prev : next));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections, navH, q]);

  const activePart = sections.find((s) => s.id === active.part) ?? sections[0];
  const activeCat = active.cat || activePart?.categories[0]?.id;

  // keep the highlighted tab in the middle of the tab row
  useEffect(() => {
    const box = tabsRef.current;
    const tab = box?.querySelector('[aria-current="true"]');
    if (box && tab) {
      box.scrollTo({ left: tab.offsetLeft - box.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
    }
  }, [activeCat, activePart?.id]);

  return (
    <div className="menu-page" style={{ "--nav-h": `${navH}px` }}>
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

      {activePart && (
        <>
          {/* Sticky shortcuts: they jump to a place on the page and follow you as you scroll */}
          {!q && (
            <nav className="menu-nav" ref={navRef}>
              <div className="menu-switch">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === activePart.id}
                    onClick={() => goTo(`part-${s.id}`)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="menu-tabs" ref={tabsRef}>
                {activePart.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="menu-tab"
                    aria-current={c.id === activeCat ? "true" : undefined}
                    onClick={() => goTo(`cat-${activePart.id}-${c.id}`)}
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
              sections.map((s) => (
                <div className="menu-part" key={s.id}>
                  <h1
                    className="menu-part-title"
                    id={`part-${s.id}`}
                    data-spy
                    data-part={s.id}
                    data-cat={s.categories[0].id}
                  >
                    {s.label}
                  </h1>
                  {s.categories.map((c) => (
                    <section className="menu-cat" id={`cat-${s.id}-${c.id}`} key={c.id} data-spy data-part={s.id} data-cat={c.id}>
                      <h2 className="menu-cat-title">{c.label}</h2>
                      {c.note && <p className="menu-note">{c.note}</p>}
                      {c.groups.map((g, gi) => (
                        <div className="menu-group" key={gi}>
                          {g.name && <h3 className="menu-group-title">{g.name}</h3>}
                          {g.note && <p className="menu-group-note">{g.note}</p>}
                          <ul className="dish-list">
                            {g.items.map((item) => (
                              <Dish key={item.id} item={item} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ))
            )}
          </main>
        </>
      )}
    </div>
  );
}
