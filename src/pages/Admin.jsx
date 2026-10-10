import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { THEMES, THEME_KEYS } from "../popularThemes.js";

const PARTS = [
  { id: "beverages", label: "Beverages" },
  { id: "food", label: "Food" },
];

const BLANK = {
  section: "beverages",
  category: "",
  grp: "",
  name: "",
  description: "",
  price: "",
  premium: false,
  available: true,
  popular: false,
  image: "",
  pop_theme: "",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dish";

const NOT_ALLOWED = "You're not allowed to change the menu. Check the admin email you put in the SQL.";

/* ---------------- login ---------------- */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Wrong email or password.");
    setBusy(false);
  }

  return (
    <div className="admin-login">
      <img src="/images/logo-red.png" alt="Lower Ground Coffee" className="auth-logo-img" />
      <h2>Menu admin</h2>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Signing in..." : "Log in"}</button>
      </form>
    </div>
  );
}

/* ---------------- add / edit form ---------------- */
function DishForm({ initial, categories, groups, busy, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [file, setFile] = useState(null);
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  // small preview of a picture chosen from the computer
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const shownImage = preview || f.image;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f, file);
      }}
    >
      <label>Part</label>
      <select value={f.section} onChange={(e) => set("section", e.target.value)}>
        {PARTS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      <label>Category (the tab, e.g. Coffee)</label>
      <input list="category-list" value={f.category} onChange={(e) => set("category", e.target.value)} required />
      <datalist id="category-list">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      <label>Group / sub-heading (optional, e.g. Hot Coffee)</label>
      <input list="group-list" value={f.grp} onChange={(e) => set("grp", e.target.value)} />
      <datalist id="group-list">
        {groups.map((g) => <option key={g} value={g} />)}
      </datalist>

      <label>Name</label>
      <input value={f.name} onChange={(e) => set("name", e.target.value)} required />

      <label>Description (optional)</label>
      <textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />

      <label>Price (₹)</label>
      <input type="number" min="0" step="1" value={f.price} onChange={(e) => set("price", e.target.value)} required />

      <div className="check-row">
        <label>
          <input type="checkbox" checked={f.premium} onChange={(e) => set("premium", e.target.checked)} />
          Chef's Choice
        </label>
        <label>
          <input type="checkbox" checked={f.available} onChange={(e) => set("available", e.target.checked)} />
          Available
        </label>
      </div>

      <div className="check-row">
        <label>
          <input type="checkbox" checked={f.popular} onChange={(e) => set("popular", e.target.checked)} />
          Popular pick (shows in the carousel at the top)
        </label>
      </div>

      {f.popular && (
        <div className="pop-box">
          <label>Picture (a PNG with a see-through background looks best, max 2 MB)</label>
          {shownImage && <img className="pop-preview" src={shownImage} alt="" />}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label>Or a picture address, e.g. /images/pizza.png</label>
          <input
            value={f.image}
            onChange={(e) => {
              setFile(null);
              set("image", e.target.value);
            }}
          />
          {shownImage && (
            <button type="button" className="btn-secondary" onClick={() => { setFile(null); set("image", ""); }}>
              Remove picture
            </button>
          )}

          <label style={{ marginTop: 12 }}>Card colour</label>
          <div className="theme-row">
            {THEME_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`theme-chip${f.pop_theme === k ? " on" : ""}`}
                style={{ background: THEMES[k].bg, color: THEMES[k].fg }}
                onClick={() => set("pop_theme", f.pop_theme === k ? "" : k)}
              >
                {THEMES[k].label}
              </button>
            ))}
          </div>
          <p className="admin-hint">No colour chosen = picked automatically.</p>
        </div>
      )}

      <button className="btn" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
    </form>
  );
}

/* ---------------- admin page ---------------- */
export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | dish id
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) setErr("Couldn't load the menu.");
    else setRows(data || []);
  }
  useEffect(() => {
    if (session) load();
  }, [session]);

  const upd = (id, patch) => supabase.from("menu_items").update(patch).eq("id", id).select();

  // Runs one or more database calls, shows a message, then reloads the list.
  async function exec(jobs, okMessage) {
    setBusy(true);
    setErr("");
    setMsg("");
    const results = await Promise.all(jobs);
    setBusy(false);
    const bad = results.find((r) => r.error || !r.data || r.data.length === 0);
    if (bad) {
      setErr(bad.error ? bad.error.message : NOT_ALLOWED);
      return false;
    }
    if (okMessage) setMsg(okMessage);
    await load();
    return true;
  }

  async function save(f, file) {
    if (file && file.size > 2 * 1024 * 1024) {
      setErr("That picture is bigger than 2 MB. Please use a smaller one.");
      return;
    }
    let image = f.image.trim() || null;
    if (file) {
      setBusy(true);
      setErr("");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${Date.now()}-${slug(f.name)}.${ext}`;
      const { error } = await supabase.storage
        .from("menu-images")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        setBusy(false);
        setErr("Couldn't upload the picture: " + error.message);
        return;
      }
      image = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    }
    const row = {
      section: f.section,
      category: f.category.trim(),
      grp: f.grp.trim() || null,
      name: f.name.trim(),
      description: f.description.trim(),
      price: Number(f.price),
      premium: f.premium,
      available: f.available,
      popular: f.popular,
      image,
      pop_theme: f.pop_theme || null,
    };
    if (!row.name || !row.category || Number.isNaN(row.price)) {
      setErr("Name, category and price are required.");
      return;
    }
    let ok;
    if (editing === "new") {
      const last = Math.max(0, ...rows.map((r) => r.sort_order || 0));
      ok = await exec(
        [supabase.from("menu_items").insert({ ...row, sort_order: last + 10 }).select()],
        "Dish added."
      );
    } else {
      ok = await exec([upd(editing, row)], "Saved.");
    }
    if (ok) setEditing(null);
  }

  const toggle = (item, field) => exec([upd(item.id, { [field]: !item[field] })]);

  const remove = (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    exec([supabase.from("menu_items").delete().eq("id", item.id).select()], "Deleted.");
  };

  // Swap position with the neighbour in the same tab.
  const move = (item, dir) => {
    const list = rows.filter((r) => r.section === item.section && r.category === item.category);
    const other = list[list.findIndex((r) => r.id === item.id) + dir];
    if (!other) return;
    exec([upd(item.id, { sort_order: other.sort_order }), upd(other.id, { sort_order: item.sort_order })]);
  };

  if (session === undefined) return <p className="loading">Loading...</p>;
  if (!session) return <Login />;

  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || (r.category || "").toLowerCase().includes(q)
  );
  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))];
  const groups = [...new Set(rows.map((r) => r.grp).filter(Boolean))];

  const asForm = (r) => ({
    section: r.section || "food",
    category: r.category || "",
    grp: r.grp || "",
    name: r.name,
    description: r.description || "",
    price: r.price,
    premium: !!r.premium,
    available: r.available !== false,
    popular: !!r.popular,
    image: r.image || "",
    pop_theme: r.pop_theme || "",
  });

  return (
    <div className="admin-page">
      <div className="admin-top">
        <h1>Menu admin</h1>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>

      {msg && <p className="admin-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      {editing === "new" ? (
        <div className="admin-form">
          <h2>New dish</h2>
          <DishForm
            key="new"
            initial={BLANK}
            categories={categories}
            groups={groups}
            busy={busy}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <button className="btn" style={{ marginBottom: 14 }} onClick={() => { setErr(""); setMsg(""); setEditing("new"); }}>
          + Add dish
        </button>
      )}

      <div className="admin-search">
        <input placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {PARTS.map((part) => {
        const cats = [];
        shown
          .filter((r) => (r.section || "food") === part.id)
          .forEach((r) => {
            let c = cats.find((x) => x.name === r.category);
            if (!c) cats.push((c = { name: r.category, items: [] }));
            c.items.push(r);
          });
        if (!cats.length) return null;

        return (
          <div key={part.id}>
            <h1 className="admin-part">{part.label}</h1>
            {cats.map((cat) => (
              <section key={cat.name} className="admin-category">
                <h2>{cat.name}</h2>
                {cat.items.map((r) => (
                  <div key={r.id} className="admin-item">
                    {editing === r.id ? (
                      <DishForm
                        key={r.id}
                        initial={asForm(r)}
                        categories={categories}
                        groups={groups}
                        busy={busy}
                        onSave={save}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <>
                        <div className="admin-item-info">
                          <div className="admin-item-text">
                            <strong>{r.name}</strong>
                            <span className="admin-item-meta">
                              ₹{r.price}
                              {r.grp ? ` · ${r.grp}` : ""}
                              {r.premium ? " · ★ Chef's Choice" : ""}
                              {r.popular ? " · Popular pick" : ""}
                              {r.available === false ? " · Sold out" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="admin-item-actions">
                          <button className="btn-secondary" disabled={busy} onClick={() => { setErr(""); setMsg(""); setEditing(r.id); }}>Edit</button>
                          <button className="btn-secondary" disabled={busy} onClick={() => toggle(r, "available")}>
                            {r.available === false ? "Back in stock" : "Sold out"}
                          </button>
                          <button className="btn-secondary" disabled={busy} onClick={() => toggle(r, "premium")}>
                            {r.premium ? "Remove ★" : "★ Chef's Choice"}
                          </button>
                          <button className="btn-secondary" disabled={busy} onClick={() => toggle(r, "popular")}>
                            {r.popular ? "Remove from popular" : "Make popular"}
                          </button>
                          <button className="btn-secondary" disabled={busy} onClick={() => move(r, -1)} aria-label="Move up">▲</button>
                          <button className="btn-secondary" disabled={busy} onClick={() => move(r, 1)} aria-label="Move down">▼</button>
                          <button className="btn-secondary" disabled={busy} onClick={() => remove(r)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        );
      })}
    </div>
  );
}
