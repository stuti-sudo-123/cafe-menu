import { Link, useSearchParams } from "react-router-dom";

const FOODS = [
  { name: "Croissant", img: "/images/croissant.png" },
  { name: "Pizza", img: "/images/pizza.png" },
  { name: "Burger", img: "/images/burger.png" },
  { name: "Momos", img: "/images/momos.png" },
  { name: "Pani puri", img: "/images/pani-puri.png" },
  { name: "Pasta", img: "/images/pasta.png" },
];

export default function Welcome() {
  const [params] = useSearchParams();
  const table = params.get("table");
  const menuLink = table ? `/?table=${table}` : "/";
  const step = 360 / FOODS.length;

  return (
    <div className="welcome">
      <header className="welcome-header">
        <div className="welcome-logo">cafe</div>
        <div className="welcome-logo-sub">COFFEE BEANS</div>
      </header>

      <div className="welcome-stage">
        <div className="welcome-text">
          <b>Hungry?</b>
          <span>Pick from our menu and order from your table</span>
        </div>

        <div className="welcome-wrap">
          <div className="welcome-wheel">
            <div className="welcome-ring" />
            <div className="welcome-orbit">
              {FOODS.map((f, i) => (
                <div key={f.name} className="welcome-slot" style={{ "--a": `${i * step}deg` }}>
                  <div className="welcome-food">
                    <img src={f.img} alt={f.name} />
                  </div>
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