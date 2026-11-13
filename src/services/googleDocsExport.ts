import { FLOORS } from '../data/menu';
import type { BatchReport, CompletedSession, LoungeTable } from '../types';

export interface DailyReportPayload {
  title: string;
  generatedAt: number;
  generatedBy: string;
  isBatchClosed: boolean;
  closedSessions: CompletedSession[];
  openTablesIncluded: number;
  subtotal: number;
  tax: number;
  total: number;
  cashTotal: number;
  cardTotal: number;
}

export function buildDailyReportPayload(params: {
  tables: LoungeTable[];
  history: CompletedSession[];
  staffName: string;
  includeOpenTables: boolean;
  fromBatch?: BatchReport | null;
}): DailyReportPayload {
  const now = Date.now();
  const dateStr = new Date(params.fromBatch?.closedAt || now).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  );

  const computeSplitTotals = (sessions: CompletedSession[]) => {
    const cash = sessions.reduce(
      (s, x) => s + (x.cashPaid ?? (x.paymentMethod === 'cash' ? x.total : 0)),
      0
    );
    const card = sessions.reduce(
      (s, x) =>
        s +
        (x.cardPaid ??
          (x.paymentMethod === 'cash' ? 0 : x.total - (x.cashPaid ?? 0))),
      0
    );
    return { cash, card };
  };

  if (params.fromBatch) {
    const split = computeSplitTotals(params.fromBatch.sessions);
    return {
      title: `SIN-OS Daily Batch Report — ${dateStr}`,
      generatedAt: params.fromBatch.closedAt,
      generatedBy: params.fromBatch.closedBy,
      isBatchClosed: true,
      closedSessions: params.fromBatch.sessions,
      openTablesIncluded: params.fromBatch.autoClosedOpenTables,
      subtotal: params.fromBatch.subtotal,
      tax: params.fromBatch.tax,
      total: params.fromBatch.total,
      cashTotal: params.fromBatch.cashTotal ?? split.cash,
      cardTotal: params.fromBatch.cardTotal ?? split.card,
    };
  }

  const allSessions: CompletedSession[] = [...params.history];
  let openTablesIncluded = 0;

  if (params.includeOpenTables) {
    for (const table of params.tables) {
      if (table.status !== 'occupied' || !table.seatedAt) continue;
      openTablesIncluded += 1;
      const sub = table.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0);
      const tax = 0;
      allSessions.push({
        id: `open-${table.id}`,
        tableName: `${table.tableNumber ? `#${table.tableNumber} · ` : ''}${table.name} (Open)`,
        floor: table.floor,
        zone: table.zone,
        partySize: table.partySize || 1,
        guestName: table.guestName,
        serverName: table.serverName || params.staffName,
        seatedAt: table.seatedAt,
        closedAt: now,
        durationMinutes: Math.max(1, Math.round((now - table.seatedAt) / 60_000)),
        orders: table.orders,
        subtotal: sub,
        tax,
        total: sub,
        paymentMethod: 'card',
        cashPaid: 0,
        cardPaid: sub,
      });
    }
  }

  const subtotal = allSessions.reduce((s, sess) => s + sess.subtotal, 0);
  const tax = 0;
  const total = allSessions.reduce((s, sess) => s + sess.total, 0);
  const split = computeSplitTotals(allSessions);

  return {
    title: `SIN-OS Daily Total — ${dateStr}`,
    generatedAt: now,
    generatedBy: params.staffName,
    isBatchClosed: false,
    closedSessions: allSessions,
    openTablesIncluded,
    subtotal,
    tax,
    total,
    cashTotal: split.cash,
    cardTotal: split.card,
  };
}

export function formatReportDocumentText(report: DailyReportPayload): string {
  const timestamp = new Date(report.generatedAt).toLocaleString('en-US');
  const lines: string[] = [];

  lines.push(`${report.title}`);
  lines.push(`Generated: ${timestamp}`);
  lines.push(`Prepared by: ${report.generatedBy}`);
  lines.push(
    `Status: ${report.isBatchClosed ? 'End-of-Day Batch Closed' : 'Live Shift Snapshot'}`
  );
  lines.push('');
  lines.push('DAILY TOTALS');
  lines.push(`Total Tabs: ${report.closedSessions.length}`);
  if (report.openTablesIncluded > 0) {
    lines.push(`Open Tables Included: ${report.openTablesIncluded}`);
  }
  lines.push(`CASH TOTAL: $${report.cashTotal.toFixed(2)}`);
  lines.push(`CARD TOTAL: $${report.cardTotal.toFixed(2)}`);
  lines.push(`GRAND TOTAL: $${report.total.toFixed(2)}`);
  lines.push('');
  lines.push('REVENUE BY FLOOR');

  for (const floor of FLOORS) {
    const floorSessions = report.closedSessions.filter((s) => s.floor === floor);
    const floorTotal = floorSessions.reduce((sum, s) => sum + s.total, 0);
    lines.push(
      `- ${floor}: $${floorTotal.toFixed(2)} (${floorSessions.length} tab${
        floorSessions.length === 1 ? '' : 's'
      })`
    );
  }

  // Tally seating options, extra guest fees, refills & ice hose add-ons
  let vipAllDayCount = 0;
  let vipOneTimeCount = 0;
  let barAllDayCount = 0;
  let barOneTimeCount = 0;
  let downstairsCount = 0;
  let xtraVipAllDayCount = 0;
  let xtraVipOneTimeCount = 0;
  let xtraDownstairsCount = 0;
  let upgradeVipCount = 0;
  let upgradeAllDayVipCount = 0;
  let refillCount = 0;
  let iceHoseCount = 0;
  const flavorCounts: Record<string, number> = {};

  for (const session of report.closedSessions) {
    for (const order of session.orders) {
      if (order.menuItemId === 'h-vip-allday' || order.menuItemId === 'h-allday') {
        vipAllDayCount += order.quantity;
      }
      if (order.menuItemId === 'h-vip-onetime') vipOneTimeCount += order.quantity;
      if (order.menuItemId === 'h-bar-allday') barAllDayCount += order.quantity;
      if (order.menuItemId === 'h-bar-onetime') barOneTimeCount += order.quantity;
      if (order.menuItemId === 'h-downstairs' || order.menuItemId === 'h-onetime') {
        downstairsCount += order.quantity;
      }
      if (order.menuItemId === 'r-xtra-vip-allday' || order.menuItemId === 'r-vip-allday-guest') {
        xtraVipAllDayCount += order.quantity;
      }
      if (order.menuItemId === 'r-xtra-vip-onetime' || order.menuItemId === 'r-vip-onetime-guest') {
        xtraVipOneTimeCount += order.quantity;
      }
      if (order.menuItemId === 'r-xtra-downstairs') {
        xtraDownstairsCount += order.quantity;
      }
      if (order.menuItemId === 'r-upgrade-vip') {
        upgradeVipCount += order.quantity;
      }
      if (order.menuItemId === 'r-upgrade-vip-allday') {
        upgradeAllDayVipCount += order.quantity;
      }
      if (order.menuItemId === 'r1') refillCount += order.quantity;
      if (order.iceHose || order.menuItemId === 'r-ice') {
        iceHoseCount += order.quantity;
      }
      order.flavors?.forEach((f) => {
        flavorCounts[f] = (flavorCounts[f] || 0) + order.quantity;
      });
    }
  }

  lines.push('');
  lines.push('SEATING & ADD-ON BREAKDOWN');
  lines.push(`- All Day VIP ($250): ${vipAllDayCount}`);
  lines.push(`- One Time VIP · 2h ($100): ${vipOneTimeCount}`);
  lines.push(`- Bar Top · All Day ($100): ${barAllDayCount}`);
  lines.push(`- Bar Top · One Time ($60): ${barOneTimeCount}`);
  lines.push(`- Downstairs Hookah ($50): ${downstairsCount}`);
  lines.push(`- Xtra Person · All Day VIP ($65): ${xtraVipAllDayCount}`);
  lines.push(`- Xtra Person · One Time VIP ($20): ${xtraVipOneTimeCount}`);
  lines.push(`- Xtra Person · Downstairs ($10): ${xtraDownstairsCount}`);
  lines.push(`- Upgrade to VIP ($200): ${upgradeVipCount}`);
  lines.push(`- All Day VIP Upgrade ($150): ${upgradeAllDayVipCount}`);
  lines.push(`- Hookah Refills: ${refillCount}`);
  lines.push(`- Ice Hose Add-ons: ${iceHoseCount}`);

  const topFlavors = Object.entries(flavorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (topFlavors.length > 0) {
    lines.push('');
    lines.push('TOP SHISHA FLAVORS');
    for (const [flavor, count] of topFlavors) {
      lines.push(`- ${flavor}: ${count} bowl${count === 1 ? '' : 's'}`);
    }
  }

  lines.push('');
  lines.push('TAB LEDGER');
  if (report.closedSessions.length === 0) {
    lines.push('No tabs recorded for this period.');
  } else {
    for (const sess of report.closedSessions) {
      const itemsText =
        sess.orders.length > 0
          ? sess.orders
              .map(
                (o) =>
                  `${o.quantity}x ${o.name}${
                    o.iceHose ? ' (+Ice Hose)' : ''
                  }${o.flavors?.length ? ` [${o.flavors.join(' + ')}]` : ''}`
              )
              .join(', ')
          : 'No items';
      const payTag =
        sess.paymentMethod === 'cash'
          ? 'CASH'
          : sess.paymentMethod === 'split'
          ? `SPLIT ($${(sess.cashPaid ?? 0).toFixed(2)} Cash / $${(
              sess.cardPaid ?? 0
            ).toFixed(2)} Card)`
          : 'CARD';
      lines.push(
        `• ${sess.floor} · ${sess.tableName}${
          sess.guestName ? ` (${sess.guestName})` : ''
        } — $${sess.total.toFixed(2)} [${payTag}] | Party ${sess.partySize} | ${
          sess.durationMinutes
        }m | Server: ${sess.serverName || 'Staff'}`
      );
      lines.push(`   Orders: ${itemsText}`);
    }
  }

  return lines.join('\n') + '\n';
}

export async function exportDailyTotalToGoogleDocs(
  accessToken: string,
  report: DailyReportPayload
): Promise<{ documentId: string; documentUrl: string; title: string }> {
  // 1. Create a new Google Doc
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: report.title }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => '');
    if (createRes.status === 401 || createRes.status === 403) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(
      `Failed to create Google Doc (${createRes.status}): ${errBody || createRes.statusText}`
    );
  }

  const created = (await createRes.json()) as {
    documentId: string;
    title: string;
  };

  // 2. Insert formatted report text
  const bodyText = formatReportDocumentText(report);
  const titleEndIndex = 1 + report.title.length;

  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${created.documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: bodyText,
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: titleEndIndex },
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              fields: 'namedStyleType',
            },
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const errBody = await updateRes.text().catch(() => '');
    throw new Error(
      `Created document, but failed to write content (${updateRes.status}): ${errBody}`
    );
  }

  return {
    documentId: created.documentId,
    documentUrl: `https://docs.google.com/document/d/${created.documentId}/edit`,
    title: created.title || report.title,
  };
}
