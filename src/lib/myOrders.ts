// Tracks order IDs the diner has placed from this device, per table.
// Lets us show a "My Orders" list so they can re-track active orders later.

const KEY = "fsc_my_orders_v1";

type StoredOrder = { id: string; table: number; created_at: string };

export const recordMyOrder = (id: string, table: number) => {
  const list = readMyOrders();
  if (list.some((o) => o.id === id)) return;
  list.unshift({ id, table, created_at: new Date().toISOString() });
  // cap to last 50
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
};

export const readMyOrders = (): StoredOrder[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

export const myOrdersForTable = (table: number) =>
  readMyOrders().filter((o) => o.table === table);
