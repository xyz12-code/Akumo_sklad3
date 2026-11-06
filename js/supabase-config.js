(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoSupabaseConfig = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Public Data API endpoint + publishable key only (safe with RLS). Never put service_role/secret here.
  return Object.freeze({
    projectRef: 'uyjgjuinqtgstquhhvie',
    url: 'https://uyjgjuinqtgstquhhvie.supabase.co',
    publishableKey: 'sb_publishable_fFaNI1RVmDkDVqcUr3yBwA_YwPJosNs',
    historyTable: 'akumo_search_history',
  });
});
