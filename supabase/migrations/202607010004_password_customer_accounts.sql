-- password-customer-accounts-v1
-- Re-enable optional customer accounts with email + password while keeping guest checkout available.

update public.bakery_settings
set settings = coalesce(settings, '{}'::jsonb)
  || '{
    "allowGuestCheckout": true,
    "requireSignInForOrders": false,
    "customerPasswordAccountsEnabled": true,
    "customerReorderEnabled": true,
    "customerProfileSavingEnabled": true
  }'::jsonb;
