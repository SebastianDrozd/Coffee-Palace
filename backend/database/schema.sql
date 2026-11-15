-- ============================================================================
-- Coffee Palace: database schema
--
-- Works on MariaDB 10.4+ (the "MySQL" that comes with XAMPP) and MySQL 8.0+.
-- Run it once, then optionally run seed.sql for the sample menu.
--   phpMyAdmin: Import > choose this file > Go
--   Command line: mysql -u root -p < schema.sql
-- Safe to run again: it only creates what doesn't exist yet.
-- Times are stored in UTC; order_date is the business day in Caracas.
-- ============================================================================

-- Read this file as UTF-8 (accents like é, ñ). Some clients default to latin1.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS coffee_palace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE coffee_palace;

-- Menu categories, shown on the tablet in sort_order
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60)  NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products. Prices are saved in US dollars; bolívares come from the BCV rate.
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  category_id   INT UNSIGNED  NOT NULL,
  name          VARCHAR(80)   NOT NULL,
  description   VARCHAR(200)  NOT NULL DEFAULT '',
  price_usd     DECIMAL(10,2) NULL,
  image_path    VARCHAR(255)  NULL COMMENT 'File name inside the uploads folder',
  is_available  TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '0 = hidden from the tablet',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_products_category (category_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders placed on the tablet
CREATE TABLE IF NOT EXISTS orders (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_date            DATE          NOT NULL COMMENT 'Business day in Caracas',
  order_number          INT UNSIGNED  NOT NULL COMMENT 'Number shown to the customer, restarts at 1 each day',
  customer_name         VARCHAR(40)   NOT NULL,
  note                  VARCHAR(200)  NOT NULL DEFAULT '',
  status                ENUM('new','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'new',
  total_usd             DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_bs              DECIMAL(16,2) NULL COMMENT 'NULL when no exchange rate was known',
  exchange_rate         DECIMAL(18,8) NULL COMMENT 'Bs. per US$ used for this order',
  exchange_rate_source  ENUM('bcv','manual') NULL,
  created_at            DATETIME(3)   NOT NULL,
  updated_at            DATETIME(3)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_day_number (order_date, order_number),
  KEY ix_orders_status (status),
  KEY ix_orders_date_status (order_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order lines. Name and prices are copied so later menu changes don't alter past orders.
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED      NOT NULL,
  product_id  INT UNSIGNED      NULL COMMENT 'NULL if the product was deleted later',
  name        VARCHAR(80)       NOT NULL,
  price_usd   DECIMAL(10,2)     NULL,
  price_bs    DECIMAL(16,2)     NULL,
  quantity    SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_order_items_order (order_id),
  KEY ix_order_items_product (product_id),
  CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders (id)   ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hands out order numbers per day without duplicates, even with two tablets
CREATE TABLE IF NOT EXISTS order_counters (
  order_date   DATE         NOT NULL,
  last_number  INT UNSIGNED NOT NULL,
  PRIMARY KEY (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Official BCV dollar rates, one per "fecha valor"
CREATE TABLE IF NOT EXISTS exchange_rates (
  value_date  DATE          NOT NULL COMMENT 'BCV fecha valor: the day this rate applies',
  rate        DECIMAL(18,8) NOT NULL COMMENT 'Bs. per US$',
  fetched_at  DATETIME(3)   NOT NULL,
  PRIMARY KEY (value_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row: manual rate override and the result of the last BCV check
CREATE TABLE IF NOT EXISTS exchange_rate_state (
  id             TINYINT UNSIGNED NOT NULL,
  manual_rate    DECIMAL(18,8)    NULL COMMENT 'When set, used instead of the BCV rate',
  manual_set_at  DATETIME(3)      NULL,
  last_check_at  DATETIME(3)      NULL,
  last_error     VARCHAR(300)     NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_exchange_rate_state_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO exchange_rate_state (id) VALUES (1);
