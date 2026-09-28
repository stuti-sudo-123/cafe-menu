import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";

export default function Menu() {
  const [params] = useSearchParams();
  const table = params.get("table") || "?";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState({}); // { itemId: quantity }
  const [note, setNote] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | done | error

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

  const categories = [...new Set(items.map((i) => i.category))];

  const change = (id, delta) =>
    setCart((c) => {
      const qty = (c[id] || 0) + delta;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const lines = items
    .filter((i) => cart[i.id])
    .map((i) => ({ ...i, qty: cart[i.id] }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * Number(l.price), 0);

  async function placeOrder() {
    setStatus("sending");
    const { error } = await supabase.from("orders").insert({
      table_no: table,
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: Number(l.price) })),
      total,
      note,
    });
    if (error) {
      setStatus("error");
    } else {
      setCart({});
      setNote("");
      setShowCart(false);
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <div className="success">
        <h2>Order placed!</h2>
        <p>Table {table} — we'll bring it over shortly.</p>
        <button className="btn" onClick={() => setStatus("idle")}>
          Order more
        </button>
      </div>
    );
  }

  return (
    <div className="menu-page">
      <header className="header">
        <h1>My Cafe</h1>
        <p className="table-label">Table {table}</p>
      </header>

      {loading && <p className="loading">Loading menu...</p>}
      {loadError && <p className="error">Couldn't load the menu. Refresh to try again.</p>}

      {categories.map((cat) => (
        <section key={cat} className="category">
          <h2>{cat}</h2>
          {items
            .filter((i) => i.category === cat)
            .map((item) => (
              <div key={item.id} className={`item${item.available ? "" : " item-soldout"}`}>
                <div className="item-info">
                  <strong className="item-name">{item.name}</strong>
                  {item.description && <p className="item-desc">{item.description}</p>}
                  <span className="item-price">₹{item.price}</span>
                </div>
                {!item.available ? (
                  <span className="sold-out">Sold out</span>
                ) : cart[item.id] ? (
                  <div className="qty">
                    <button onClick={() => change(item.id, -1)}>−</button>
                    <span>{cart[item.id]}</span>
                    <button onClick={() => change(item.id, 1)}>+</button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => change(item.id, 1)}>
                    Add
                  </button>
                )}
              </div>
            ))}
        </section>
      ))}

      {count > 0 && !showCart && (
        <div className="cart-bar" onClick={() => setShowCart(true)}>
          <span>{count} items</span>
          <span>View cart · ₹{total}</span>
        </div>
      )}

      {showCart && (
        <div className="cart-panel">
          <h2>Your order</h2>
          {lines.map((l) => (
            <div key={l.id} className="cart-line">
              <span>{l.name} × {l.qty}</span>
              <span>₹{l.qty * Number(l.price)}</span>
            </div>
          ))}
          <textarea
            className="note"
            placeholder="Any note? (e.g. less sugar)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cart-total">Total: ₹{total}</div>
          {status === "error" && (
            <p className="error">Couldn't send order. Please try again.</p>
          )}
          <button className="btn" onClick={placeOrder} disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Place order"}
          </button>
          <button className="btn-secondary" onClick={() => setShowCart(false)}>
            Back to menu
          </button>
        </div>
      )}
    </div>
  );
}
