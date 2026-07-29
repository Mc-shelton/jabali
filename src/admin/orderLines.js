// Shared shaping for an order's purchased items. Both the orders table and the
// order detail dialog read a purchase the same way, so a change to how add-ons
// are presented can't leave the two disagreeing.

export const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const buyerName = (o) =>
  `${o.customer?.preferredName ?? ''} ${o.customer?.otherNames ?? ''}`.trim();

export const reference = (o) => o.receipt || o.ticketCode || '';

// Present every purchase as lines, including merchandise added while buying a
// ticket. The API has always persisted these in `addOns`; keeping this shaping
// here also lets older, single-item orders use the same rendering path.
export const orderLines = (o) => [
  {
    name: o.itemName,
    type: o.itemType ?? 'ticket',
    quantity: Number(o.quantity ?? 0),
    amount: o.itemAmount ?? (o.addOns?.length ? null : o.amount),
    options: o.options ?? [],
  },
  ...(o.addOns ?? []).map((line) => ({ ...line, type: 'merch' })),
].filter((line) => line.name);

export const optionText = (options = []) =>
  options.map((opt) => `${opt.name}: ${opt.choice}`).join(' · ');

export const itemText = (o) =>
  orderLines(o)
    .map((line) => [line.name, optionText(line.options)].filter(Boolean).join(' '))
    .join(' ');

export const totalUnits = (o) =>
  orderLines(o).reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
