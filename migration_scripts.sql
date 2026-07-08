-- ============================================
-- PRODUCTION DATABASE MIGRATION SCRIPT
-- RevolRMO - Development to Production
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Replit project
-- 2. Go to the Database pane (left sidebar)
-- 3. Select "Production Database"
-- 4. Click "My Data" tab
-- 5. Toggle "Edit" mode ON (top right)
-- 6. Copy and paste each section below and run them IN ORDER
-- ============================================

-- ============================================
-- STEP 1: ROLES (Run this first)
-- ============================================
INSERT INTO roles (id, name, display_name, description, is_system, is_active, sort_order, created_at, updated_at) VALUES
('b266eaeb-d01d-4462-aa63-014055d45da1', 'administrator', 'Administrator', 'Full system access with all permissions', true, true, 0, NOW(), NOW()),
('04184145-8399-4bf7-b2dc-d521f647a49b', 'c_suite', 'C-Suite', 'Executive access with view-only permissions for strategic oversight', true, true, 1, NOW(), NOW()),
('64497183-5f8e-4816-86f5-a55512a7bd3b', 'finance', 'Finance Department', 'Full access to payments, reports, and banking settings', true, true, 2, NOW(), NOW()),
('f904d04f-0fd9-4252-98fb-e95cb67a9d3c', 'business_development', 'Business Development', 'Full access to projects, upsells, and client management', true, true, 3, NOW(), NOW()),
('6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'production', 'Production Department', 'Access to projects and planning for operational management', true, true, 4, NOW(), NOW()),
('df81d4e6-026e-4fde-af87-92527b09ccf5', 'project_manager', 'Project Manager', 'Recurring management access', true, true, 5, NOW(), NOW()),
('921b33a1-409b-4fa5-81aa-259c50f1a415', 'tr_emp', 'TR EMP', 'Unauthorised user. Need to get access from the System Administrator first.', false, true, 6, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================
-- STEP 2: USERS (Run this second)
-- ============================================
INSERT INTO users (id, email, first_name, last_name, role, profile_image_url) VALUES
('d06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Abid.iqrar@tekrevol.com', 'Abid', 'Iqrar', 'project_manager', NULL),
('afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'Alina.iqbal@tekrevol.com', 'Alina', 'Iqbal', 'project_manager', NULL),
('d486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Muneeb.ghauri@tekrevol.com', 'Muneeb', 'Ghauri', 'project_manager', NULL),
('9b947b33-8e75-476f-88c2-08437633499f', 'asim@tekrevol.com', 'Asim', 'Rais Siddiqui', 'administrator', NULL),
('923b4821-609e-47f8-a73f-40f2b6634205', 'elena@tekrevol.com', 'Elena', 'Martallacci Moya', 'project_manager', NULL),
('4972444e-9e64-4768-8bd9-b29cb060eecb', 'hunza.aqeel@tekrevol.com', 'Syeda Hunza', 'Aqeel', 'project_manager', NULL),
('36c85ec5-5917-449e-8874-4c4d43b05597', 'moiz.murad@tekrevol.com', 'Moiz', 'Murad', 'project_manager', NULL),
('35a7b439-9bf8-4ef9-b09d-6bc478992388', 'zohaib@tekrevol.com', 'Zohaib', 'Hasan Nizami', 'administrator', NULL)
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role;

-- ============================================
-- STEP 3: ROLE PERMISSIONS (Run this third)
-- ============================================
-- C-Suite permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'export_reports', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_analytics', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_calendar', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_dashboard', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_notifications', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_payments', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_planning', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_projects', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_reports', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_settings', NOW()),
(gen_random_uuid(), '04184145-8399-4bf7-b2dc-d521f647a49b', 'view_users', NOW())
ON CONFLICT DO NOTHING;

-- Finance permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'create_payments', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'create_planning', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'delete_payments', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'edit_payments', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'edit_planning', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'edit_settings', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'export_reports', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_analytics', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_dashboard', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_notifications', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_payments', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_planning', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_projects', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_reports', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_settings', NOW()),
(gen_random_uuid(), '64497183-5f8e-4816-86f5-a55512a7bd3b', 'view_upsells', NOW())
ON CONFLICT DO NOTHING;

-- Production permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_analytics', NOW()),
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_dashboard', NOW()),
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_payments', NOW()),
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_planning', NOW()),
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_projects', NOW()),
(gen_random_uuid(), '6a189d41-8a78-4632-bcb8-a7df21c11ea1', 'view_upsells', NOW())
ON CONFLICT DO NOTHING;

-- Administrator permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'create_payments', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'create_planning', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'create_projects', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'create_upsells', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'create_users', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'delete_payments', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'delete_planning', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'delete_projects', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'delete_upsells', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'delete_users', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_payments', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_planning', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_projects', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_settings', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_upsells', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'edit_users', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'export_reports', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'manage_roles', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'send_notifications', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_analytics', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_calendar', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_dashboard', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_notifications', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_payments', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_planning', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_projects', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_reports', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_settings', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_upsells', NOW()),
(gen_random_uuid(), 'b266eaeb-d01d-4462-aa63-014055d45da1', 'view_users', NOW())
ON CONFLICT DO NOTHING;

-- Project Manager permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'create_projects', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'create_upsells', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'edit_payments', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'edit_upsells', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'send_notifications', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_analytics', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_dashboard', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_notifications', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_payments', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_planning', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_projects', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_reports', NOW()),
(gen_random_uuid(), 'df81d4e6-026e-4fde-af87-92527b09ccf5', 'view_upsells', NOW())
ON CONFLICT DO NOTHING;

-- Business Development permissions
INSERT INTO role_permissions (id, role_id, permission, created_at) VALUES
(gen_random_uuid(), 'f904d04f-0fd9-4252-98fb-e95cb67a9d3c', 'view_dashboard', NOW()),
(gen_random_uuid(), 'f904d04f-0fd9-4252-98fb-e95cb67a9d3c', 'view_payments', NOW()),
(gen_random_uuid(), 'f904d04f-0fd9-4252-98fb-e95cb67a9d3c', 'view_planning', NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: PROJECTS (Run this fourth)
-- ============================================
INSERT INTO projects (id, name, client_name, client_email, region, pm_id, project_type, phase, total_cost, payment_terms, billing_type, contract_start_date, contract_end_date, number_of_phases, tbe_hours_per_month, tbe_hourly_rate, mrr_monthly_amount, mrr_duration_months, status, created_at, updated_at) VALUES
('2bde6357-5aff-4855-9148-b0e12b462d72', '7 System Plan', 'Dr. Pat Luse', 'patlusedc@gmail.com', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'App Development', NULL, 31700.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('b8a0f85b-799b-4694-8eb3-8cbbbc776ce4', 'ADA - SSSA', 'Mr. Sultan', 'sultan.alshamsi@sssa.gov.ae', 'AE', '35a7b439-9bf8-4ef9-b09d-6bc478992388', 'Web & App Development', NULL, 170000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f79402e0-3968-49ba-bbd0-3db86fb2b80c', 'ASRS', 'Mr. Ahmed Qaddura', 'Ahmad.Qaddura@asrs.ae', 'AE', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'Web Development', NULL, 6300.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('5747b104-31e6-405b-977d-8a92fa3559a4', 'Ad Intelligence SAAS', 'Mr. Malak Pierre Nguyen', 'malaky31@hotmail.fr', 'AE', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'Web & App Development', NULL, 36360.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('fb5dbb7d-4ede-4847-919b-70a24d245310', 'Afrotierre', 'Ms. Jade', 'jotons@yahoo.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 97500.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f1e2449f-5910-4640-a33c-f81aef4201cd', 'ArtistWiz', 'Mr. Mark Leddy', 'mleddy@mac.com', 'CA', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'App Development', NULL, 7200.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('49073f4e-d808-4ace-a82a-2c438b919370', 'Atelier Lily', 'Ilona Chirkinyan', 'chirkilona@gmail.com', 'CA', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Web Development', NULL, 7220.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('ea7ffa30-ad85-4699-aa43-257cbeb46716', 'Cape Cod - MA', 'Mr. Gregory Baldwin', 'gregb3777@hotmail.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Web Development', NULL, 50000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('9131cd67-336d-42d0-9555-4d916ed4acfa', 'Car Wash App - Nazif', 'Mr. Khalil Nabil', 'khalilqtifan@hotmail.com', 'AE', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Web & App Development', NULL, 40000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('18b0f15b-880e-4eea-b231-88284d3f1bf9', 'CareShare', 'Mr. Victor Cancino', 'vcancino0124@gmail.com', 'CA', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 66000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('54d93b75-9a74-4341-8963-aff85aa86f09', 'Catalink', 'Mr. Abdallah Mar', 'developer@catalink.app', 'AE', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 27750.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('7f6ced2e-e528-4f78-b0fa-635e9a85440a', 'Chapter - POC', 'Mr. Tony Barrow', 'tonybarrow982@gmail.com', 'AE', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'POC', NULL, 3500.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('cd52da6c-0cd0-488d-9ef0-4c93a5dfebb7', 'Comment Sense - POC', 'Mr. Steven Etienne', 'stevenetienne33@gmail.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'POC', NULL, 1000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('a541e326-48d8-4d5f-b232-f814f7f668c7', 'Complete Focus', 'Mr. David Gatti', 'gattiville@gmail.com', 'CA', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'Web Development', NULL, 43200.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('bd28370d-c285-4440-8e74-b616c7b5a6e7', 'Construction Worker', 'Mr. Dustin Crockett', 'dustin.crockett@skylerdesignbuild.com', 'TX', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'Web & App Development', NULL, 115000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('a521ff0b-6c2e-4a30-8c01-d3a6e5f71aea', 'Destination Tour', 'Mr. Ahmad Roda', 'ahmad@dtltours.com', 'AE', NULL, 'App Development', NULL, 22722.00, NULL, 'ftfc', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NOW(), NOW()),
('e4b7fd52-0ed3-4db1-ab72-daefafc62f17', 'Discount App', 'Mr. Naif Al Saud', 'naif.bm.7@gmail.com', 'AE', '36c85ec5-5917-449e-8874-4c4d43b05597', 'App Development', NULL, 53496.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f9e6132f-e733-4471-abff-19bc6da05070', 'District Connect - POC', 'Ms. Emily Salamon', 'dcdistrictconnect@gmail.com', 'CA', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'POC', NULL, 3840.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('0df921f7-49f8-40de-b279-0a7d9544583e', 'DreamList', 'Mr. David Gold', 'dgold@dreamlistapp.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Web & App Development', NULL, 135000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('cc30dbda-59d4-4845-8931-628d34b4f4d8', 'Elara Dubai', 'Ms. Claudia Pezzola', 'claudia@elaradubai.com', 'AE', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 22000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('a317eabe-6b88-4d85-a90d-3a8f52df57ea', 'Electronic Invitation', 'Ms. Mai Mohammad', 'M2q@hotmail.com', 'AE', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'App Development', NULL, 25647.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f9781ed0-226b-44c0-9b2b-b7c0858ffc1a', 'FSK', 'Mr. Adam Degraide', 'adegraide@bambamtastic.com', 'CA', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Game Development', NULL, 250000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('5856132f-a4d9-4133-8468-2deef75f888d', 'Find a feast - POC', 'Mr. Matthew Hurt', 'matthew.d.hurt@gmail.com', 'CA', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'POC', NULL, 5000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('60387c70-6818-4af4-9bff-13e6a2b9da24', 'FlareX', 'Mr. Tirhani Shibanda', 'tirhani@rcgmarkets.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 13176.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('78dec1b2-464e-45b7-990e-3e6c7d60bad9', 'Gambit Sports', 'Mr. Leo Schittino', 'lschittino@gmail.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 19800.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('9ba3eba5-790e-412a-b64e-25f1584d07c7', 'Genuine Connection', 'Ms. Adrienne Knott', 'adrienneknott7@gmail.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'App Development', NULL, 8924.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('5dffad6f-b7ee-49f7-a0f3-c8a7e807eb13', 'Gravity Group Ind. LLC', 'Mr. Haider Tariq', 'haider.awan@toppansecurity.com', 'AE', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Web Development', NULL, 24000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('957cda44-fe54-4a23-b096-49b8d993378b', 'Hard Shoulder', 'Mr. Majed Alayan', 'majed@alayan.co.uk', 'AE', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'Web & App Development', NULL, 41000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('8e771bff-8ab9-4e4a-9fa4-35475855e921', 'Heet Dating', 'Ms. Korelle Dickson', 'korelledickson@gmail.com', 'TX', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'App Development', NULL, 2500.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('41acbb5c-4a5c-4de3-88da-94463a728acb', 'Hip Hop Streets', 'Mr. Marquis Jonkins', 'hiphopstreets2016@gmail.com', 'TX', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'App Development', NULL, 4500.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('7bfc9c8f-0f44-4352-bd62-d4577d38af4d', 'HotSpot', 'Mr. Fernando Trillo', 'fertrillo054@gmail.com', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 59400.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('363aaefc-d31d-4f59-b62d-281aa5543ed9', 'IKIDs App', 'Ms. Autumn', 'autumn@ikidsinc.com', 'TX', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Game Development', NULL, 158600.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('8acc1f01-75d7-4de2-ae2d-bd5a008ea00a', 'Kinder Morgan', 'Ms. Swathi', 'Swathi_Sriramla@kindermorgan.com', 'TX', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'App Development', NULL, 31800.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('0d8a030a-6297-4e8d-9506-6729b79c7590', 'Laundry Delivery', 'Mr. Mubarak', 'mqtr99@gmail.com', 'AE', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'App Development', NULL, 20000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('d1b7c3a8-3b0c-48ab-90f4-4a5f441bf310', 'Let''s Explore More', 'Ms. Kayera Johnson', 'kyera93@yahoo.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 32000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('d13b8072-5eb6-4890-bf60-530fdeec46a4', 'Loser Base', 'Ms. Brittany Foster', 'brittanyannefoster@gmail.com', 'CA', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web Development', NULL, 18772.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('505978df-00fe-41f4-a074-49be3f277f7f', 'MMP', 'Ms. Susanne Riley', 'sriley@mymedicalplanner.org', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 86040.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('cb524c64-bc75-4f08-bda7-0a87c12ddbb8', 'Maze Runner', 'Mr. Rytis Roche', 'rytisroche@hotmail.com', 'CA', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Game Development', NULL, 144060.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('e65ad9ba-9806-46dd-9be6-4a42f2a0165b', 'MetaFort', 'Mr. Alden Radd', 'playmetafort@gmail.com', 'CA', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Game Development', NULL, 427000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('49eb5a09-c812-422f-8757-25b3f182a22c', 'Midpoint App - POC', 'Mr. Jon Danley', 'joncdanley@gmail.com', 'CA', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'POC', NULL, 8940.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('d11c8e0a-9a25-44f0-83c9-cf6c2fb35259', 'Mocuts', 'Ms. Anna Palko', 'annapalko119@gmail.com', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'App Development', NULL, 74250.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('29f27735-b031-444b-9675-b089043580a6', 'Multi Restaurant', 'Mr. Nawaf Abu Alnasr', 'nabualnasr@gmail.com', 'AE', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'Web & App Development', NULL, 34860.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('d19b9a32-b6fb-419c-adb2-1764ccc07dc7', 'My Drivers', 'Mr. Kevin Tavarez', 'ktavarez.kt@gmail.com', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 76640.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('66b56312-a8a7-4aae-86dc-9059ebb1e521', 'MyBFFCo.', 'Mr. Samer Naccouzi', 'samer_naccouzi@outlook.com', 'AE', '4972444e-9e64-4768-8bd9-b29cb060eecb', NULL, NULL, 17040.00, NULL, 'ftfc', NULL, NULL, 5, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('fee627c9-4939-4175-bf8b-4fcd522f92da', 'Nulite App', 'Ms. Bo Hood', 'bo.hood@kidtech.us', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'App Development', NULL, 41800.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('495d9d9c-0740-484f-9d13-670a1dc356dc', 'OneSource', 'Mr. James Alvarez', 'jamespalvarez@gmail.com', 'CA', '923b4821-609e-47f8-a73f-40f2b6634205', 'App Development', NULL, 8100.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f952bbd0-953e-4339-942a-4a4e27343877', 'PagePerks', 'Ms. Rebecca Hamilton', 'sixfigureauthorcoach@gmail.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Web & App Development', NULL, 206960.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('fe487a5c-2ea4-47f2-a59f-d7a3a5cdc5ac', 'Pets Vet Connect', 'Mr. Hunt Garren', 'hunt@petsvetconnect.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'App Development', NULL, 68300.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f2a35124-962a-4da6-8514-a4d57ee62728', 'Point 200 - POC', 'Mr. Tyler Helms', 'tyler@point200.com', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Web & App Development', NULL, 2000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('45038101-85c5-4cd1-80f9-d51582a96f68', 'Proline', 'Ms. Hams', 'hams@proline.sa', 'AE', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 68000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('2f3d705c-ec3b-4832-a79f-17102c8b1818', 'Quintrace', 'Mr. Abhinaav Singh', 'as@private-energypartners.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 9840.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('fe3c001d-78f9-4615-9227-a11288374682', 'RUM Enterprises', 'Mr. Kenneth Davis', 'kdavis@dqaustin.com', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 25000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('b6de86c1-be98-4948-aa18-deb30e7e6703', 'Recovery App', 'Mr. Nicholas Summan', 'summan916@gmail.com', 'CA', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'App Development', NULL, 23600.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('c34793c0-ff14-4dbe-ba6e-8248e4352de4', 'Rehkempers', 'Mr. Craig Vonder Haar', 'craigvh@rehkempers.com', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 51000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('22306d38-cd5b-49f0-ab13-22254cb0c4f9', 'Remin Diary', 'Mr. Rida Alturk', 'rida.alturk@gmail.com', 'AE', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'Web & App Development', NULL, 17500.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('fabe09ef-0d31-4267-ab46-3f13dd121b9d', 'Riseup Kings', 'Mr. Skylar', 'skylar@riseupkings.com', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 78600.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('14bbaf3f-5807-41df-8d45-59301ebf3317', 'Roll App', 'Mr. Michael Happa.', 'michael.haapaniemi@gmail.com', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 100000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('98bceeb8-f76a-4f44-b328-1f237d2729c2', 'Safe Plan LLC', 'Mr. Wambura mkono', 'mkonopulmonarycc@gmail.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 81960.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('6eca0d71-a0cc-4f1a-bb5d-e5fa09c14d36', 'San Jose GEAR UP', 'Ms. Dolores Mena', 'Dolores.mena@sjsu.edu', 'CA', 'd06891c0-c4a3-45bb-b0e9-b986aadf764c', 'Web & App Development', NULL, 61600.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('02f58d62-bb7a-4198-806f-201414e1c94a', 'Sobriety Companion', 'Mr. John Edward Clifford IV', 'jclifford3484@gmail.com', 'CA', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 80730.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('9f39ddb3-889d-428c-90d8-fe9dcd414af2', 'South Asian Care', 'Ms. Nishat Uddin', 'nishat@browngirlshealth.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 12000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('34d0bb18-5347-4166-ab10-acf02df974ae', 'Spot finder', 'Mr. Aaron Morton', 'coachmorty@gmail.com', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 108300.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f12fd14c-10de-4940-8102-4c25bbc9bced', 'Stack App', 'Mr. Maurice Scott', 'mauricescott30@gmail.com', 'TX', NULL, 'App Development', NULL, 53400.00, NULL, 'ftfc', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NOW(), NOW()),
('8f17d78a-517d-416d-8045-5bf3f4391e41', 'Stop Room Software', 'Mr. Matt Linder', 'mlinder@thedesiredeffect.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web Development', NULL, 24400.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('f42afed7-20e2-4eba-af00-cd122b7465ec', 'String Easy', 'Mr. John Milstead', 'john@stringeasy.net', 'TX', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 99000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('e4f64f42-69d8-448c-bced-bfeaf48032d2', 'Super App - SSSA', 'Mr. Sultan', 'sultan.alshamsi@sssa.gov.ae', 'AE', '35a7b439-9bf8-4ef9-b09d-6bc478992388', 'Web & App Development', NULL, 103450.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('bd556f73-7fcc-434c-88d3-1951bd5ab737', 'Syllable App', 'Ms. Lisa Godwin', 'lmgodwin361@gmail.com', 'TX', 'd486adaa-bbbc-4394-a6d7-0a0c84a9f591', 'Game Development', NULL, 58240.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('0a96e711-5b3b-4203-aa03-81b6952cd62d', 'Synaptics', 'Ms. Ela Hunter', 'thrivefounders@outlook.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'App Development', NULL, 30100.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('6f677790-a5e2-427f-a690-fec1412991ca', 'Texas Food Lovers', 'Mr. John Dawson', 'jd@texasfoodlovers.com', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 81000.00, NULL, 'mrr', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('49c55d0f-f3ed-42d9-a522-2ab35ff77d2a', 'The Luggage Taxi', 'Mr. Luigi Mercogliano', 'info@theluggagetaxi.com', 'AE', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'Web Development', NULL, 2850.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('d115efd9-3e22-4377-9094-3485c1d8475b', 'The Pasttime Place', 'Mr. Craig Underkoffler', 'cunderkoffler@gmail.com', 'CA', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web Development', NULL, 43000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('b219c0dc-730e-48a3-9f3b-b7ad294b56e7', 'V.I.B.E', 'Mr. Dante Brookes', 'brooksgdante@gmail.com', 'TX', '4972444e-9e64-4768-8bd9-b29cb060eecb', 'App Development', NULL, 24640.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('7fa27b33-2a62-4412-b409-57c268d39929', 'W M Trucking & Excavating Inc.', 'Mr. Nathan', 'nsalas@wmtrucking.net', 'TX', '923b4821-609e-47f8-a73f-40f2b6634205', 'Web & App Development', NULL, 80914.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('79fb3c4f-c7ae-46e5-9dfc-db0d9e332075', 'WM Trucking', 'Mr. Angel Minero', 'jaminero@wmtrucking.net', 'TX', NULL, 'Web & App Development', NULL, 80914.00, NULL, 'ftfc', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NOW(), NOW()),
('9faceae7-61ac-4d4a-ad50-d5e33a09a22d', 'WWP', 'Ms. Carolina Pena', 'carolinanpena@gmail.com', 'CA', 'afd7c0c1-210f-4f7f-b58e-5b36ff2142cd', 'App Development', NULL, 45120.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW()),
('54ea2167-f970-4bbc-9446-fc94e00feda6', 'Wave on the Go', 'Ms. Tonya', 'tonya@waveonthego.com', 'TX', NULL, 'Web Development', NULL, 34300.00, 'Net 30', 'ftfc', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NOW(), NOW()),
('59715a32-ef96-4bec-af38-a2fbe2ea5c1b', 'Zillow Killer', 'Mr. Cory Kramer', 'corylkramer@gmail.com', 'CA', '36c85ec5-5917-449e-8874-4c4d43b05597', 'Web & App Development', NULL, 96000.00, NULL, 'ftfc', NULL, NULL, 1, NULL, NULL, NULL, 12, 'active', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  client_name = EXCLUDED.client_name,
  client_email = EXCLUDED.client_email,
  region = EXCLUDED.region,
  pm_id = EXCLUDED.pm_id,
  project_type = EXCLUDED.project_type,
  total_cost = EXCLUDED.total_cost,
  billing_type = EXCLUDED.billing_type,
  number_of_phases = EXCLUDED.number_of_phases,
  mrr_duration_months = EXCLUDED.mrr_duration_months,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================
-- END OF MIGRATION SCRIPT
-- ============================================
