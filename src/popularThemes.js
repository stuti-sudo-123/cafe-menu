// Card colours for the "Popular picks" carousel. The admin picks one of these per dish.
// To add a colour, add a line here; it appears in the admin automatically.
export const THEMES = {
  coffee: { label: "Coffee brown", bg: "#4a2f22", fg: "#fbeee0", gold: "#f2c15b" },
  tomato: { label: "Tomato red", bg: "#c8362d", fg: "#fff3e8", gold: "#ffd56a" },
  orange: { label: "Orange", bg: "#f2c98f", fg: "#3a2210", gold: "#8a5a00" },
  matcha: { label: "Matcha green", bg: "#2f4a2a", fg: "#eef5dc", gold: "#f2c15b" },
  sand: { label: "Sand", bg: "#e3d7a3", fg: "#34290f", gold: "#8a5a00" },
  olive: { label: "Olive", bg: "#55602b", fg: "#f7f3d6", gold: "#f2c15b" },
};
export const THEME_KEYS = Object.keys(THEMES);
