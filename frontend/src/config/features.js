// Feature flags. Flip a flag to true to re-enable a temporarily hidden feature.
// STORE_ENABLED controls the child Store (nav tile + spending-jar link) and the
// parent Shopping List + Purchases entry points. Set to true to bring them back.
export const STORE_ENABLED = false;

// STOCKS_ENABLED controls the Grade 3+ "Stocks" nav tile, the Investing jar/account
// (for grade 3+ only — the Grade 1-2 "My Garden" jar is unaffected), and any parent
// dashboard summaries about investing. Set to true to bring it back.
export const STOCKS_ENABLED = false;

// LENDING_ENABLED controls the "Lending" nav tile/banner (child) and the parent
// dashboard's lending summary. Set to true to bring it back.
export const LENDING_ENABLED = false;
