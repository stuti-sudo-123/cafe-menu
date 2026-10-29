import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { THEMES, THEME_KEYS } from "../popularThemes.js";
import Gallery from "../Gallery.jsx";

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

// Colour worlds: the whole page changes colour with the category on screen, like the welcome page.
// Set to false to go back to the plain cream menu.
const COLOUR_WORLDS = true;
const NEUTRAL = { bg: "#faf6f0", fg: "#3a2210", gold: "#b8860b" };
// The photo wall ("Moments") gets its own colour: deep navy, so the polaroids and gold tape glow.
const MOMENTS = { bg: "#22304a", fg: "#f7efe2", gold: "#f2c15b" };
// Which colour each category gets (keys from popularThemes.js). Others are picked in turn.
const CATEGORY_THEMES = {
  coffee: "coffee", brews: "olive", "barista-specials": "tomato", "cold-drinks": "matcha",
  "tea-chocolate": "sand", desserts: "orange",
  starters: "olive", toasts: "sand", sandwiches: "orange", "pasta-bowls": "matcha", pizzeria: "tomato",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Rows from menu_items -> section > category > group > items (rows arrive ordered by sort_order).
function buildSections(rows) {
  const result = SECTION_META.map((meta) => {
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
          story: r.story || "",
        });
      });
    // a dish picture for the category heading: the first popular dish that has one
    categories.forEach((cat) => {
      const first = cat.groups.flatMap((g) => g.items).find((i) => i.popular && i.image);
      cat.img = first ? first.image : "";
    });
    return { ...meta, categories };
  }).filter((s) => s.categories.length);

  let n = 0;
  result.forEach((s) =>
    s.categories.forEach((c) => {
      c.theme = CATEGORY_THEMES[c.id] || THEME_KEYS[n % THEME_KEYS.length];
      n++;
      c.groups.forEach((g) => g.items.forEach((i) => { i.world = c.theme; i.catLabel = c.label; }));
    })
  );
  return result;
}

// The carousel shows every dish the admin ticked as "Popular pick".
function PopularCard({ card, hidden, index }) {
  const { item } = card;
  return (
    <div className="popular-card" style={{ "--card-bg": card.bg, "--card-fg": card.fg, "--i": index }} aria-hidden={hidden || undefined}>
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
            <PopularCard key={`${card.key}-${copy}-${i}`} card={card} index={i} hidden={copy === 1 || i >= cards.length} />
          ))
        )}
      </div>
    </section>
  );
}

// A small wheel of popular dishes, like the welcome page: it turns one step at a time and the dish
// facing the text is shown larger.
function Hero({ special, cards }) {
  const pics = cards.filter((c) => c.img).slice(0, 6);
  const n = pics.length;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 2800);
    return () => clearInterval(id);
  }, [n]);

  const step = 360 / Math.max(n, 1);
  const rot = 180 - tick * step; // the active dish sits at the left of the wheel
  const active = n ? tick % n : 0;
  const on = special && special.active && (special.title || special.details);

  return (
    <section className="hero">
      <div className="hero-text">
        {on ? (
          <>
            <p className="hero-kicker">Today's special</p>
            {special.title && <h2 className="hero-title">{special.title}</h2>}
            {special.details && <p className="hero-details">{special.details}</p>}
            {special.price != null && <span className="hero-price">{rupee(special.price)}</span>}
          </>
        ) : (
          <>
            <p className="hero-kicker">Welcome</p>
            <h2 className="hero-title">What are you craving?</h2>
            <p className="hero-details">Scroll through, search, or tap any dish to read its story.</p>
          </>
        )}
      </div>

      {n > 0 && (
        <div className="hero-wheel" aria-hidden="true">
          <div className="hero-ring" />
          <div className="hero-orbit" style={{ "--rot": n > 1 ? `${rot}deg` : "180deg" }}>
            {pics.map((p, i) => (
              <div key={p.key} className="hero-slot" style={{ "--a": `${step * i}deg` }}>
                <img className={`hero-food${i === active ? " on" : ""}`} src={p.img} alt="" draggable="false" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Tap a dish and this slides up from the bottom, in the colour of the dish's category.
function DishSheet({ item, onClose }) {
  const t = THEMES[item.world] || THEMES[THEME_KEYS[0]];
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        style={{ "--sheet-bg": t.bg, "--sheet-fg": t.fg, "--sheet-gold": t.gold }}
      >
        <div className="sheet-grab" />
        <button type="button" className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        <div className="sheet-pic">
          {item.image ? <img src={item.image} alt="" /> : <div className="sheet-emoji" aria-hidden="true">{item.section === "food" ? "🍽️" : "☕"}</div>}
        </div>
        {item.chef && <p className="sheet-pick">★ Chef's Choice</p>}
        <h3 className="sheet-title">{item.name}</h3>
        <div className="sheet-meta">
          <span className="sheet-price">{rupee(item.price)}</span>
          {item.catLabel && <span className="sheet-cat">{item.catLabel}</span>}
        </div>
        {item.story && <p className="sheet-text">{item.story}</p>}
        {item.desc && <p className={item.story ? "sheet-sub" : "sheet-text"}>{item.desc}</p>}
        {!item.available && <p className="sheet-sold">Sold out right now</p>}
      </div>
    </div>
  );
}

function Dish({ item, where, onOpen }) {
  return (
    <li className={`dish reveal ${item.available ? "" : "dish-soldout"}`}>
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
      <button type="button" className="dish-hit" onClick={() => onOpen(item)} aria-label={`${item.name}: open details`} />
    </li>
  );
}

export default function Menu() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [special, setSpecial] = useState(null); // Today's special, set from the admin page
  const [sheetItem, setSheetItem] = useState(null); // the dish whose details are open
  const openSheet = useCallback((item) => setSheetItem(item), []);
  const closeSheet = useCallback(() => setSheetItem(null), []);
  const [active, setActive] = useState({ part: "", cat: "" }); // what is on screen right now
  const [inMoments, setInMoments] = useState(false); // true once the photo wall is coming into view
  const [neutral, setNeutral] = useState(true); // true while the header / popular strip is still on screen
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

  useEffect(() => {
    supabase
      .from("todays_special")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setSpecial(data || null));
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

  // ---- things glide in as they scroll into view ----
  useEffect(() => {
    const items = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        let k = 0; // dishes that appear together glide in one after another
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.style.setProperty("--rd", `${Math.min(k++, 7) * 50}ms`);
          en.target.classList.add("in");
          io.unobserve(en.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, q, results.length]);

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
      // only sections that are actually on the page (the photo wall is hidden until it has photos)
      const marks = Array.from(document.querySelectorAll("[data-spy]")).filter((el) => el.getClientRects().length > 0);
      if (!marks.length) return;
      const line = navH + 24;
      // the photo wall switches colour as soon as it rises into the lower part of the screen
      const lineFor = (el) => (el.dataset.part === "moments" ? window.innerHeight * 0.7 : line);
      let current = marks[0];
      for (const el of marks) {
        if (el.getBoundingClientRect().top <= lineFor(el)) current = el;
        else break;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = marks[marks.length - 1]; // very bottom of the page = last section
      }
      setNeutral(marks[0].getBoundingClientRect().top > line);
      const isMoments = current.dataset.part === "moments";
      setInMoments(isMoments);
      if (!isMoments) {
        const next = { part: current.dataset.part, cat: current.dataset.cat };
        setActive((prev) => (prev.part === next.part && prev.cat === next.cat ? prev : next));
      }
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

  // paint the page in the colour of the category on screen
  const activeTheme = THEMES[activePart?.categories.find((c) => c.id === activeCat)?.theme];
  useEffect(() => {
    const t = !COLOUR_WORLDS || q || neutral ? NEUTRAL : inMoments ? MOMENTS : activeTheme || NEUTRAL;
    const style = document.documentElement.style;
    style.setProperty("--page-bg", t.bg);
    style.setProperty("--page-fg", t.fg);
    style.setProperty("--page-gold", t.gold || NEUTRAL.gold);
  }, [q, neutral, inMoments, activeTheme]);
  useEffect(
    () => () => {
      const style = document.documentElement.style;
      ["--page-bg", "--page-fg", "--page-gold"].forEach((k) => style.removeProperty(k));
    },
    []
  );

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

      {!q && !loading && !loadError && <Hero special={special} cards={popularCards} />}

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
                    <Dish key={item.id} item={item} where={where} onOpen={openSheet} />
                  ))}
                </ul>
              ) : (
                <p className="menu-empty">Nothing matches “{search}”.</p>
              )
            ) : (
              sections.map((s) => (
                <div className="menu-part" key={s.id}>
                  <h1
                    className="menu-part-title reveal"
                    id={`part-${s.id}`}
                    data-spy
                    data-part={s.id}
                    data-cat={s.categories[0].id}
                  >
                    {s.label}
                  </h1>
                  {s.categories.map((c) => (
                    <section className="menu-cat" id={`cat-${s.id}-${c.id}`} key={c.id} data-spy data-part={s.id} data-cat={c.id}>
                      <div className="menu-cat-head">
                        <h2 className="menu-cat-title reveal">{c.label}</h2>
                        {c.img && (
                          <div className="menu-cat-img reveal" aria-hidden="true">
                            <img src={c.img} alt="" loading="lazy" onError={(e) => (e.currentTarget.parentNode.style.display = "none")} />
                          </div>
                        )}
                      </div>
                      {c.note && <p className="menu-note">{c.note}</p>}
                      {c.groups.map((g, gi) => (
                        <div className="menu-group" key={gi}>
                          {g.name && <h3 className="menu-group-title reveal">{g.name}</h3>}
                          {g.note && <p className="menu-group-note">{g.note}</p>}
                          <ul className="dish-list">
                            {g.items.map((item) => (
                              <Dish key={item.id} item={item} onOpen={openSheet} />
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

      {!q && <Gallery />}

      {sheetItem && <DishSheet item={sheetItem} onClose={closeSheet} />}
    </div>
  );
}
