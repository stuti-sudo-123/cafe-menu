import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

export default function Staff() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);

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
      .from("orders")
      .select("*")
      .neq("status", "done")
      .order("created_at", { ascending: true });
    setOrders(data || []);
  }

  useEffect(() => {
    if (!session) return;
    load();
    const t = setInterval(load, 5000); // refresh every 5 seconds
    return () => clearInterval(t);
  }, [session]);

  async function login() {
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Wrong email or password.");
  }

  async function setStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id", id);
    load();
  }

  if (!ready) return <p className="loading">Loading...</p>;

  if (!session) {
    return (
      <div className="staff-login">
        <h2>Staff login</h2>
        <input
          type="email"
          placeholder="Email"
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

  return (
    <div className="staff-page">
      <div className="staff-top">
        <h1>Incoming orders ({orders.length})</h1>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>
      {orders.length === 0 && <p>No open orders.</p>}
      {orders.map((o) => (
        <div key={o.id} className={`order order-${o.status}`}>
          <div className="order-head">
            <strong>Table {o.table_no}</strong>
            <span>{new Date(o.created_at).toLocaleTimeString()}</span>
          </div>
          <ul>
            {o.items.map((i, n) => (
              <li key={n}>{i.qty} × {i.name}</li>
            ))}
          </ul>
          {o.note && <p className="order-note">Note: {o.note}</p>}
          <div className="order-total">₹{o.total} · {o.status}</div>
          {o.status === "new" && (
            <button className="btn" onClick={() => setStatus(o.id, "preparing")}>
              Start preparing
            </button>
          )}
          {o.status === "preparing" && (
            <button className="btn" onClick={() => setStatus(o.id, "done")}>
              Mark done
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
