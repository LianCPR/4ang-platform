/**
 * Supabase PostgreSQL data access layer for 4ANG.
 *
 * Replaces the SQLite `db.prepare().get()/.all()/.run()` pattern
 * with Supabase-native helpers. Route files import helpers from here.
 */
import { supabaseAdmin } from "./supabase.js";

// Re-export supabaseAdmin for direct use
export { supabaseAdmin as pg };

// ─── Core CRUD Helpers ──────────────────────────────────

/**
 * Select rows from a table.
 * @param {string} table - Table name
 * @param {object} opts - { filters, columns, order, limit, offset }
 */
export async function pgSelect(table, { filters = {}, columns = "*", order = null, limit = null, offset = null } = {}) {
  let query = supabaseAdmin.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) query = query.is(key, null);
    else if (typeof value === "object" && value !== null && value._op) {
      switch (value._op) {
        case "gte": query = query.gte(key, value.v); break;
        case "lte": query = query.lte(key, value.v); break;
        case "gt": query = query.gt(key, value.v); break;
        case "lt": query = query.lt(key, value.v); break;
        case "like": query = query.like(key, value.v); break;
        case "ilike": query = query.ilike(key, value.v); break;
        case "in": query = query.in(key, value.v); break;
        case "neq": query = query.neq(key, value.v); break;
        case "not_in": query = query.not(key, "in", value.v); break;
        default: query = query.eq(key, value.v);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  if (order) {
    if (Array.isArray(order)) {
      for (const o of order) query = query.order(o.column, { ascending: o.asc ?? false, nullsFirst: o.nullsFirst });
    } else {
      query = query.order(order.column, { ascending: order.asc ?? false });
    }
  }
  if (limit) query = query.limit(limit);
  if (offset) query = query.range(offset, offset + (limit || 50) - 1);
  const { data, error } = await query;
  if (error) {
    console.error(`[pg] select ${table}:`, error.message);
    return [];
  }
  return data || [];
}

/**
 * Select one row from a table.
 */
export async function pgSelectOne(table, { filters = {}, columns = "*" } = {}) {
  const rows = await pgSelect(table, { filters, columns, limit: 1 });
  return rows[0] || null;
}

/**
 * Insert a row. Returns the inserted row.
 */
export async function pgInsert(table, row) {
  const { data, error } = await supabaseAdmin.from(table).insert(row).select().single();
  if (error) {
    console.error(`[pg] insert ${table}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Insert multiple rows.
 */
export async function pgInsertMany(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabaseAdmin.from(table).insert(rows).select();
  if (error) {
    console.error(`[pg] insertMany ${table}:`, error.message);
    return [];
  }
  return data || [];
}

/**
 * Update rows. Returns updated rows.
 */
export async function pgUpdate(table, updates, filters) {
  let query = supabaseAdmin.from(table).update(updates);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.select();
  if (error) {
    console.error(`[pg] update ${table}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Upsert a row. Returns the upserted row.
 */
export async function pgUpsert(table, row, { onConflict = null, ignoreDuplicates = false } = {}) {
  const opts = {};
  if (onConflict) opts.onConflict = onConflict;
  opts.ignoreDuplicates = ignoreDuplicates;
  let query = supabaseAdmin.from(table).upsert(row, opts);
  const { data, error } = await query.select().single();
  if (error) {
    console.error(`[pg] upsert ${table}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Delete rows. Returns boolean success.
 */
export async function pgDelete(table, filters) {
  let query = supabaseAdmin.from(table).delete();
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error) {
    console.error(`[pg] delete ${table}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Count rows in a table.
 */
export async function pgCount(table, filters = {}) {
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) query = query.is(key, null);
    else if (typeof value === "object" && value !== null && value._op) {
      switch (value._op) {
        case "gte": query = query.gte(key, value.v); break;
        case "lte": query = query.lte(key, value.v); break;
        case "gt": query = query.gt(key, value.v); break;
        case "lt": query = query.lt(key, value.v); break;
        case "in": query = query.in(key, value.v); break;
        default: query = query.eq(key, value.v);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  const { count, error } = await query;
  if (error) {
    console.error(`[pg] count ${table}:`, error.message);
    return 0;
  }
  return count || 0;
}

/**
 * RPC call.
 */
export async function pgRpc(fn, params = {}) {
  const { data, error } = await supabaseAdmin.rpc(fn, params);
  if (error) {
    console.error(`[pg] rpc ${fn}:`, error.message);
    return null;
  }
  return data;
}

// ─── Convenience ────────────────────────────────────────

/**
 * Insert and return the row, with optional select columns.
 */
export async function pgInsertReturning(table, row, columns = "*") {
  const { data, error } = await supabaseAdmin.from(table).insert(row).select(columns).single();
  if (error) {
    console.error(`[pg] insertReturning ${table}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Upsert and return the row.
 */
export async function pgUpsertReturning(table, row, { onConflict = null, columns = "*" } = {}) {
  const opts = {};
  if (onConflict) opts.onConflict = onConflict;
  const { data, error } = await supabaseAdmin.from(table).upsert(row, opts).select(columns).single();
  if (error) {
    console.error(`[pg] upsertReturning ${table}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Check if a row exists.
 */
export async function pgExists(table, filters) {
  const count = await pgCount(table, filters);
  return count > 0;
}
