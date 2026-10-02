import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

const EMPTY = { name: "", price: "", description: "", category: "", image: "" };

export default function Admin() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [adminSearch, setAdminSearch] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    setItems(data || []);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function login() {
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
  }

  async function save() {
    setMsg("");
    const price = Number(form.price);
    if (!form.name.trim() || !form.category.trim() || !(price > 0)) {
      setMsg("Enter a name, a category and a price above 0.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      price,
      image: form.image || null,
    };
    const { error } = editingId
      ? await supabase.from("menu_items").update(payload).eq("id", editingId)
      : await supabase
          .from("menu_items")
          .insert({ ...payload, sort_order: items.length + 1 });
    if (error) {
      setMsg("Couldn't save. Check that you're logged in and try again.");
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
    setMsg(editingId ? "Item updated." : "Item added.");
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      price: String(item.price),
      description: item.description || "",
      category: item.category,
      image: item.image || "",
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(file) {
    setMsg("Uploading photo...");
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file);
    if (error) {
      setMsg("Couldn't upload the photo. Try a smaller image.");
      return;
    }
    const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image: data.publicUrl }));
    setMsg("Photo uploaded.");
  }

  async function toggle(item) {
    await supabase.from("menu_items").update({ available: !item.available }).eq("id", item.id);
    load();
  }

  async function togglePremium(item) {
    await supabase.from("menu_items").update({ premium: !item.premium }).eq("id", item.id);
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await supabase.from("menu_items").delete().eq("id", item.id);
    load();
  }

  if (!ready) return <p className="loading">Loading...</p>;

  if (!session) {
    return (
      <div className="admin-login">
        <div className="auth-logo">cafe</div>
        <div className="auth-logo-sub">COFFEE BEANS</div>
        <h2>Admin login</h2>
        <input
          type="email"
          placeholder="admin@yourcafe.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {loginError && <p className="error">{loginError}</p>}
        <button className="btn" onClick={login}>Log in</button>
      </div>
    );
  }

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(adminSearch.toLowerCase())
  );
  const categories = [...new Set(filteredItems.map((i) => i.category))];

  return (
    <div className="admin-page">
      <div className="admin-top">
        <h1>Menu admin</h1>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>

      <div className="admin-form">
        <h2>{editingId ? "Edit item" : "Add item"}</h2>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Category (e.g. Coffee)"
          list="cats"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <datalist id="cats">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <label className="image-upload">
          {form.image ? (
            <img src={form.image} alt="Preview" className="image-preview" />
          ) : (
            <span>Tap to add a photo</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0])}
          />
        </label>

        {msg && <p className="admin-msg">{msg}</p>}
        <button className="btn" onClick={save}>
          {editingId ? "Save changes" : "Add item"}
        </button>
        {editingId && (
          <button
            className="btn-secondary"
            onClick={() => { setEditingId(null); setForm(EMPTY); setMsg(""); }}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="admin-search">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search items"
          value={adminSearch}
          onChange={(e) => setAdminSearch(e.target.value)}
        />
      </div>

      {categories.length === 0 && (
        <p className="loading">No items match "{adminSearch}".</p>
      )}

      {categories.map((cat) => (
        <section key={cat} className="admin-category">
          <h2>{cat}</h2>
          {filteredItems.filter((i) => i.category === cat).map((item) => (
            <div key={item.id} className="admin-item">
              <div className="admin-item-info">
                {item.image && <img src={item.image} alt="" className="admin-item-thumb" />}
                <strong>{item.name}</strong> · ₹{item.price}
                {item.premium && <span className="premium-tag"> ★ Premium</span>}
                {!item.available && <span className="sold-out"> Sold out</span>}
              </div>
              <div className="admin-item-actions">
                <button className="btn-secondary" onClick={() => toggle(item)}>
                  {item.available ? "Mark sold out" : "Mark available"}
                </button>
                <button className="btn-secondary" onClick={() => togglePremium(item)}>
                  {item.premium ? "Unmark premium" : "Mark premium"}
                </button>
                <button className="btn-secondary" onClick={() => startEdit(item)}>Edit</button>
                <button className="btn-secondary" onClick={() => remove(item)}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}