import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const FOODS = [
  { name: "Tiramisu", bg: "#4a2f22", fg: "#fbeee0", img: "/images/tiramisu.png", desc: "Cream meets coffee in the perfect Italian dream." },
  { name: "Pizza and Love", bg: "#c8362d", fg: "#fff3e8", img: "/images/pizza.png", desc: "Veggies meet cheese in the happiest slice alive." },
  { name: "Carrot cake", bg: "#f2c98f", fg: "#3a2210", img: "/images/carrotCake.png", desc: "Spiced carrot layers and cream cheese frosting, soft and sweet." },
  { name: "Matcha Latte", bg: "#2f4a2a", fg: "#eef5dc", img: "/images/matchaLatte.png", desc: "A silky swirl of vibrant green matcha and creamy milk\u2014your perfect moment of calm in every sip." },
  { name: "Edamame Falafel", bg: "#e3d7a3", fg: "#34290f", img: "/images/cucumberToast.png", desc: "From Middle Eastern roots to a modern twist \u2014 our Edamame Falafel blends earthy chickpeas, vibrant edamame, and bold spices into one unforgettable bite." },
  { name: "Feta & Olives", bg: "#55602b", fg: "#f7f3d6", img: "/images/fetaOlives.png", desc: "Salty feta and juicy olives, simple and Mediterranean to the core." },
];

const INTERVAL = 3000; // ms between slides

export default function Welcome() {
  const [params] = useSearchParams();
  const table = params.get("table");
  const menuLink = table ? `/?table=${table}` : "/";

  const n = FOODS.length;
  const step = 360 / n;

  // `tick` keeps increasing so the wheel always spins forward (no rewind at the end)
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = tick % n;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTick((t) => t + 1), INTERVAL);
    return () => clearInterval(id);
  }, [paused]);

  // Tapping an item brings it to the center (spinning forward)
  const goTo = (i) => setTick((t) => t + ((i - (t % n) + n) % n));

  // Item i sits at angle i*step. We want the active one at 180deg (left side of the wheel).
  const rot = 180 - tick * step;

  return (
    <div className="welcome" style={{ "--bg": FOODS[active].bg, "--fg": FOODS[active].fg }}>
      <header className="welcome-header">
        <img src="/images/logo-red.png" alt="Lower Ground Coffee" className="welcome-logo-img" />
      </header>

      <div
        className="welcome-stage"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Name + description of the item that is currently in the center */}
        <div className="welcome-info" aria-live="polite">
          <h2 key={`t-${active}`} className="welcome-info-title">{FOODS[active].name}</h2>
          <p key={`d-${active}`} className="welcome-info-desc">{FOODS[active].desc}</p>
        </div>

        <div className="welcome-wrap">
          <div className="welcome-wheel">
            <div className="welcome-ring" />
            <div className="welcome-orbit" style={{ "--rot": `${rot}deg` }}>
              {FOODS.map((f, i) => (
                <div key={f.name} className="welcome-slot" style={{ "--a": `${i * step}deg` }}>
                  <button
                    type="button"
                    className={`welcome-food ${i === active ? "is-active" : ""}`}
                    onClick={() => goTo(i)}
                    aria-label={f.name}
                  >
                    <img src={f.img} alt={f.name} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-cta">
        <Link to={menuLink}>View menu</Link>
      </div>
    </div>
  );
}
