-- ============================================================================
-- Coffee Palace: sample menu (optional)
-- Run after schema.sql on an empty database. Prices are in US dollars.
-- Running it twice adds nothing new: existing categories and products are skipped.
-- ============================================================================

-- Read this file as UTF-8 (accents like é, ñ). Some clients default to latin1.
SET NAMES utf8mb4;

USE coffee_palace;

INSERT IGNORE INTO categories (name, sort_order) VALUES
  ('Cafés calientes', 1),
  ('Cafés fríos', 2),
  ('Té y más', 3),
  ('Panadería', 4);

INSERT INTO products (category_id, name, description, price_usd)
SELECT c.id, p.name, p.description, p.price_usd
FROM (
            SELECT 'Cafés calientes' AS category, 'Guayoyo' AS name, 'Café colado suave, como en casa.' AS description, 2.00 AS price_usd
  UNION ALL SELECT 'Cafés calientes', 'Espresso', 'Un shot doble, corto e intenso.', 2.50
  UNION ALL SELECT 'Cafés calientes', 'Marrón', 'Espresso con un poco de leche espumada.', 2.75
  UNION ALL SELECT 'Cafés calientes', 'Capuchino', 'Espresso con mucha espuma de leche.', 4.00
  UNION ALL SELECT 'Cafés calientes', 'Latte', 'Espresso con leche cremosa.', 4.75
  UNION ALL SELECT 'Cafés calientes', 'Moca', 'Latte con chocolate oscuro.', 5.25
  UNION ALL SELECT 'Cafés calientes', 'Latte Rosa Palace', 'Nuestro latte de la casa con rosa y vainilla.', 5.75
  UNION ALL SELECT 'Cafés fríos', 'Latte frío', 'Espresso y leche fría con hielo.', 5.00
  UNION ALL SELECT 'Cafés fríos', 'Cold brew', 'Reposado en frío por 18 horas, suave y con cuerpo.', 4.50
  UNION ALL SELECT 'Cafés fríos', 'Frappé de caramelo', 'Café, leche, hielo y caramelo.', 5.50
  UNION ALL SELECT 'Té y más', 'Chai latte', 'Té negro con especias y leche.', 4.75
  UNION ALL SELECT 'Té y más', 'Matcha latte', 'Matcha y leche cremosa.', 5.25
  UNION ALL SELECT 'Té y más', 'Matcha de fresa', 'Matcha frío sobre leche de fresa.', 5.75
  UNION ALL SELECT 'Té y más', 'Chocolate caliente', 'Chocolate venezolano con leche caliente.', 4.00
  UNION ALL SELECT 'Panadería', 'Cachito de jamón', 'Pan suave relleno de jamón.', 3.00
  UNION ALL SELECT 'Panadería', 'Croissant de mantequilla', '', 3.75
  UNION ALL SELECT 'Panadería', 'Golfeado', 'Pan dulce con papelón, anís y queso.', 3.25
  UNION ALL SELECT 'Panadería', 'Galleta con chispas de chocolate', '', 2.50
  UNION ALL SELECT 'Panadería', 'Pan de cambur', 'Una rebanada gruesa, ligeramente tostada.', 3.25
) AS p
JOIN categories c ON c.name = p.category
WHERE NOT EXISTS (SELECT 1 FROM products x WHERE x.name = p.name);
