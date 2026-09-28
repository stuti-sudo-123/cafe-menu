1. npm create vite@latest cafe-menu -- --template react
2. cd cafe-menu && npm install react-router-dom @supabase/supabase-js qrcode
3. Delete the default src files, copy this src/ folder in (replace everything).
4. Create a free Supabase project, run schema.sql in its SQL Editor,
   then paste your URL + anon key into src/supabase.js.
5. npm run dev -> open http://localhost:5173/?table=5 and /staff
