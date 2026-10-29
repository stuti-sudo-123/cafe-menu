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
  story: "",
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

      <label>Story (optional): a few lines shown when a customer taps the dish</label>
      <textarea rows={3} value={f.story} onChange={(e) => set("story", e.target.value)} />

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

/* ---------------- today's special ---------------- */
function SpecialEditor() {
  const [s, setS] = useState(null); // null = still loading
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("todays_special")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setMissing(true);
        else setS({ active: data.active, title: data.title || "", details: data.details || "", price: data.price ?? "" });
      });
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const { data, error } = await supabase
      .from("todays_special")
      .update({
        active: s.active,
        title: s.title.trim(),
        details: s.details.trim(),
        price: s.price === "" ? null : Number(s.price),
      })
      .eq("id", 1)
      .select();
    setBusy(false);
    if (error || !data || data.length === 0) setErr(error ? error.message : NOT_ALLOWED);
    else setMsg(s.active ? "Saved. It's showing on the menu now." : "Saved. It's hidden from the menu.");
  }

  if (missing) return <p className="admin-hint">Today's special isn't set up yet. Run extras_setup.sql in Supabase.</p>;
  if (!s) return null;
  const set = (key, value) => setS((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="admin-form">
      <h2>Today's special</h2>
      <form onSubmit={save}>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} />
            Show it at the top of the menu
          </label>
        </div>
        <label>Title (e.g. Pistachio Latte)</label>
        <input value={s.title} onChange={(e) => set("title", e.target.value)} />
        <label>A line about it (optional)</label>
        <textarea rows={2} value={s.details} onChange={(e) => set("details", e.target.value)} />
        <label>Price (₹, optional)</label>
        <input type="number" min="0" step="1" value={s.price} onChange={(e) => set("price", e.target.value)} />
        {msg && <p className="admin-msg">{msg}</p>}
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "Saving..." : "Save special"}</button>
      </form>
    </div>
  );
}

/* ---------------- Moments photos ---------------- */
function GalleryEditor() {
  const [photos, setPhotos] = useState(null); // null = still loading
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0); // changing this clears the file box
  const [drafts, setDrafts] = useState({}); // photo id -> caption being typed

  async function load() {
    const { data, error } = await supabase
      .from("gallery_photos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) setMissing(true);
    else {
      setMissing(false);
      setPhotos(data || []);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // runs database calls, shows a message, reloads the list
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

  async function addPhoto(e) {
    e.preventDefault();
    if (!file) {
      setErr("Choose a photo first.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr("That photo is bigger than 2 MB. Please use a smaller one.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `gallery/${Date.now()}.${ext}`;
    const { error: upError } = await supabase.storage
      .from("menu-images")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (upError) {
      setBusy(false);
      setErr("Couldn't upload the photo: " + upError.message);
      return;
    }
    const url = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    const last = Math.max(0, ...photos.map((p) => p.sort_order || 0));
    const { data, error } = await supabase
      .from("gallery_photos")
      .insert({ image_url: url, caption: caption.trim(), sort_order: last + 10 })
      .select();
    setBusy(false);
    if (error || !data || data.length === 0) {
      setErr(error ? error.message : NOT_ALLOWED);
      return;
    }
    setFile(null);
    setCaption("");
    setInputKey((k) => k + 1);
    setMsg("Photo added. It shows in Moments now.");
    load();
  }

  const saveCaption = (p) =>
    exec([supabase.from("gallery_photos").update({ caption: (drafts[p.id] ?? p.caption).trim() }).eq("id", p.id).select()], "Caption saved.").then(
      (ok) => ok && setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; })
    );

  async function remove(p) {
    if (!window.confirm("Remove this photo from Moments?")) return;
    const ok = await exec([supabase.from("gallery_photos").delete().eq("id", p.id).select()], "Photo removed.");
    if (ok) {
      const stored = p.image_url.split("/menu-images/")[1]; // photos uploaded here live in the menu-images folder
      if (stored) supabase.storage.from("menu-images").remove([decodeURIComponent(stored)]);
    }
  }

  function move(p, dir) {
    const other = photos[photos.findIndex((x) => x.id === p.id) + dir];
    if (!other) return;
    exec([
      supabase.from("gallery_photos").update({ sort_order: other.sort_order }).eq("id", p.id).select(),
      supabase.from("gallery_photos").update({ sort_order: p.sort_order }).eq("id", other.id).select(),
    ]);
  }

  if (missing) return <p className="admin-hint">Moments photos aren't set up yet. Run gallery_setup.sql in Supabase.</p>;
  if (!photos) return null;

  return (
    <div className="admin-form" style={{ marginTop: 28 }}>
      <h2>Moments photos</h2>
      {msg && <p className="admin-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <form onSubmit={addPhoto}>
        <label>Add a photo (JPG, PNG or WebP, max 2 MB)</label>
        <input key={inputKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label>Caption (optional, e.g. Coffee o'clock)</label>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={40} />
        <button className="btn" disabled={busy || !file}>{busy ? "Working..." : "Add photo"}</button>
      </form>

      <div className="gal-list">
        {photos.length === 0 && <p className="admin-hint">No photos yet. The Moments section stays hidden until you add one.</p>}
        {photos.map((p, i) => (
          <div className="gal-item" key={p.id}>
            <img className="gal-thumb" src={p.image_url} alt="" />
            <div className="gal-body">
              <input
                value={drafts[p.id] ?? p.caption}
                maxLength={40}
                placeholder="Caption"
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
              />
              <div className="admin-item-actions">
                {drafts[p.id] !== undefined && drafts[p.id] !== p.caption && (
                  <button className="btn-secondary" disabled={busy} onClick={() => saveCaption(p)}>Save caption</button>
                )}
                <button className="btn-secondary" disabled={busy || i === 0} onClick={() => move(p, -1)} aria-label="Move earlier">▲</button>
                <button className="btn-secondary" disabled={busy || i === photos.length - 1} onClick={() => move(p, 1)} aria-label="Move later">▼</button>
                <button className="btn-secondary" disabled={busy} onClick={() => remove(p)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      story: f.story.trim(),
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
    story: r.story || "",
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

      <SpecialEditor />

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

      <GalleryEditor />
    </div>
  );
}
