-- Pure Home Waters MySQL schema
-- Use this SQL to create the database tables when you are ready to switch from the mock backend.

CREATE DATABASE IF NOT EXISTS pure_home_waters CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pure_home_waters;

CREATE TABLE IF NOT EXISTS rental_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  description TEXT NULL,
  features JSON NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20) NULL,
  address TEXT NOT NULL,
  area VARCHAR(255) NOT NULL,
  purifier_model VARCHAR(255) NOT NULL,
  plan_id BIGINT NOT NULL,
  plan_name VARCHAR(255) NULL,
  monthly_rent DECIMAL(10,2) NULL,
  deposit_paid DECIMAL(10,2) NOT NULL,
  initial_investment DECIMAL(10,2) NULL,
  join_date DATETIME NOT NULL,
  next_due_date DATETIME NOT NULL,
  last_payment_date DATETIME NULL,
  last_service_date DATETIME NULL,
  next_service_date DATETIME NULL,
  status VARCHAR(32) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS service_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  customer_name VARCHAR(255) NULL,
  service_type VARCHAR(64) NOT NULL,
  service_date DATETIME NOT NULL,
  next_service_date DATETIME NULL,
  technician_name VARCHAR(255) NOT NULL,
  parts_replaced TEXT NULL,
  notes TEXT NULL,
  cost DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid_date DATETIME NOT NULL,
  for_month VARCHAR(64) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL
);
