import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";

// Each polaroid gets its own tilt and piece of tape so the wall looks hand-stuck.
const TILTS = [-4, 3, -2.5, 4.5, -5, 2];
const TAPES = [-4, 5, -2, 4, -6, 3];

export default function Gallery() {
  const [ok, setOk] = useState([]);       // photos that loaded
  const [failed, setFailed] = useState([]); // photos whose file is missing
  const [open, setOpen] = useState(null);  // index of the photo shown big, or null
  const [list, setList] = useState([]); // photos from the database, in the order the admin set
  const wall = useRef(null);

  useEffect(() => {
    supabase
      .from("gallery_photos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .then(({ data }) => setList((data || []).map((r) => ({ src: r.image_url, caption: r.caption || "" }))));
  }, []);

  const photos = list.filter((p) => !failed.includes(p.src));

  // polaroids fade up one after another as they scroll into view
  useEffect(() => {
    const cards = wall.current ? Array.from(wall.current.querySelectorAll(".polaroid")) : [];
    if (!("IntersectionObserver" in window)) {
      cards.forEach((c) => c.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.15 }
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [photos.length]);

  // big view: Esc closes, arrow keys move, and the page behind doesn't scroll
  const step = (d) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length));
  useEffect(() => {
    if (open === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, photos.length]);

  return (
    <section className="moments" data-spy data-part="moments" data-cat="moments" hidden={ok.length === 0}>
      <h2 className="moments-title">Moments</h2>
      <p className="moments-sub">a little peek inside Lower Ground</p>

      <div className="moments-wall" ref={wall}>
        {photos.map((p, i) => (
          <figure
            className="polaroid"
            key={p.src}
            style={{ "--tilt": `${TILTS[i % TILTS.length]}deg`, "--tape": `${TAPES[i % TAPES.length]}deg`, "--d": `${(i % 2) * 120}ms` }}
          >
            <button type="button" className="polaroid-btn" onClick={() => setOpen(i)} aria-label={`Open photo: ${p.caption}`}>
              <img
                src={p.src}
                alt={p.caption}
                decoding="async"
                onLoad={() => setOk((o) => (o.includes(p.src) ? o : [...o, p.src]))}
                onError={() => setFailed((f) => [...f, p.src])}
              />
            </button>
            <figcaption>{p.caption}</figcaption>
          </figure>
        ))}
      </div>

      {open !== null && photos[open] && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={photos[open].caption} onClick={() => setOpen(null)}>
          <button type="button" className="lightbox-x" onClick={() => setOpen(null)} aria-label="Close">×</button>
          <figure className="lightbox-fig" onClick={(e) => e.stopPropagation()}>
            <img src={photos[open].src} alt={photos[open].caption} />
            <figcaption>{photos[open].caption}</figcaption>
          </figure>
          {photos.length > 1 && (
            <>
              <button type="button" className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo">‹</button>
              <button type="button" className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo">›</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
