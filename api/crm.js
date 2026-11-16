const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TMP_DB_PATH = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'phw-production-crm-v4.json');

let memoryStore = null;
let pgPool = null;
let pgTableInitialized = false;

function getPgPool() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) return null;
  if (pgPool) return pgPool;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 15000
    });
    return pgPool;
  } catch (err) {
    console.error('PostgreSQL driver initialization error:', err.message);
    return null;
  }
}

async function ensurePgTable(pool) {
  if (pgTableInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS phw_crm_state (
      id INT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgTableInitialized = true;
}

/**
 * Clean Production Initial State — ZERO dummy customers, payments, services, or complaints.
 * Only baseline Rental Plans and Default Technician are initialized for dropdowns.
 */
function getDefaultProductionState() {
  const nowIso = new Date().toISOString();

  return {
    version: 1,
    updatedAt: nowIso,
    counters: {
      customers: 0,
      rentalPlans: 3,
      serviceRecords: 0,
      payments: 0,
      customerComments: 0,
      customerComplaints: 0,
      technicians: 1,
      whatsappLogs: 0
    },
    rentalPlans: [
      {
        id: 1,
        name: 'Basic',
        monthlyRent: 399,
        depositAmount: 2000,
        description: 'Essential water purification for small families',
        features: ['RO + UV + Alkaline + TDS Control', 'Base look', 'Quarterly Service', '24/7 Support'],
        createdAt: nowIso
      },
      {
        id: 2,
        name: 'Standard',
        monthlyRent: 499,
        depositAmount: 3000,
        description: 'Advanced purification with UV protection',
        features: ['RO + UV + Alkaline + TDS Control', 'Rich look', 'Quarterly Service', '24/7 Support'],
        createdAt: nowIso
      },
      {
        id: 3,
        name: 'Premium',
        monthlyRent: 499,
        depositAmount: 3500,
        description: 'Complete protection with mineral enhancement',
        features: ['Steel Tank', 'RO + UV + Alkaline + TDS Control', 'Quarterly Service', '24/7 Support'],
        createdAt: nowIso
      }
    ],
    technicians: [
      {
        id: 1,
        name: 'Default Technician',
        isDefault: true,
        createdAt: nowIso
      }
    ],
    customers: [],
    payments: [],
    serviceRecords: [],
    customerComplaints: [],
    customerComments: [],
    paymentLinks: {},
    whatsappLogs: [],
    automationConfig: {
      enabled: true,
      preDueDays: 5,
      overdueEscalationDays: 3,
      autoSendPaymentReceipt: true,
      autoReplyComplaints: true,
      lastRunAt: null
    }
  };
}

async function loadStore(origin) {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTable(pool);
      const res = await pool.query('SELECT state FROM phw_crm_state WHERE id = 1');
      if (res.rows.length > 0 && res.rows[0].state && Array.isArray(res.rows[0].state.customers)) {
        memoryStore = res.rows[0].state;
        runAutomationEngine(memoryStore, origin);
        return memoryStore;
      } else {
        memoryStore = getDefaultProductionState();
        await saveStore(memoryStore);
        return memoryStore;
      }
    } catch (err) {
      console.error('PostgreSQL loadStore error, using fallback store:', err.message);
    }
  }

  if (memoryStore) {
    return memoryStore;
  }

  try {
    if (fs.existsSync(TMP_DB_PATH)) {
      const raw = fs.readFileSync(TMP_DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.customers)) {
        memoryStore = parsed;
        runAutomationEngine(memoryStore, origin);
        return memoryStore;
      }
    }
  } catch (err) {
    console.error('Failed to read TMP_DB_PATH:', err.message);
  }

  memoryStore = getDefaultProductionState();
  await saveStore(memoryStore);
  return memoryStore;
}

async function saveStore(store) {
  store.version = (store.version || 1) + 1;
  store.updatedAt = new Date().toISOString();
  memoryStore = store;

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTable(pool);
      await pool.query(
        `INSERT INTO phw_crm_state (id, state, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
        [JSON.stringify(store)]
      );
    } catch (err) {
      console.error('PostgreSQL saveStore error:', err.message);
    }
  }

  try {
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(store), 'utf8');
  } catch {
    // Ignore file write errors on read-only fs
  }
}

function nextId(store, key) {
  if (!store.counters) store.counters = {};
  const maxExisting = Array.isArray(store[key])
    ? store[key].reduce((max, item) => Math.max(max, Number(item.id) || 0), 0)
    : 0;
  const current = Math.max(Number(store.counters[key] || 0), maxExisting) + 1;
  store.counters[key] = current;
  return current;
}

function formatMonthLabel(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function formatYearMonthCode(dateInput) {
  const d = new Date(dateInput);
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const yyyy = valid.getFullYear();
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
}

function calculateNextCycleDueDate(joinDateInput, currentDueDateInput) {
  const joinDate = new Date(joinDateInput || Date.now());
  const anchorDay = Number.isNaN(joinDate.getTime()) ? 1 : joinDate.getDate();

  const baseDue = new Date(currentDueDateInput || Date.now());
  const validBase = Number.isNaN(baseDue.getTime()) ? new Date() : baseDue;

  const nextMonth = new Date(validBase.getFullYear(), validBase.getMonth() + 1, 1);
  const maxDaysInTargetMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(anchorDay, maxDaysInTargetMonth));
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth;
}

function ensureCustomerDueDateFromOnboarding(customer) {
  const joinDate = new Date(customer.joinDate || Date.now());
  if (Number.isNaN(joinDate.getTime())) {
    customer.joinDate = new Date().toISOString();
  }
  if (!customer.nextDueDate || Number.isNaN(new Date(customer.nextDueDate).getTime())) {
    const nextDue = calculateNextCycleDueDate(customer.joinDate, customer.joinDate);
    customer.nextDueDate = nextDue.toISOString();
  }
}

function isCustomerPaidForCycle(store, customerId, forMonth, dueDateInput) {
  const due = new Date(dueDateInput);
  const cycleStart = new Date(due.getFullYear(), due.getMonth(), 1);
  return (store.payments || []).some(p => {
    if (Number(p.customerId) !== Number(customerId)) return false;
    if (p.forMonth && p.forMonth.toLowerCase() === forMonth.toLowerCase()) return true;
    const paidDate = new Date(p.paidDate);
    return paidDate >= cycleStart && paidDate.getMonth() === due.getMonth() && paidDate.getFullYear() === due.getFullYear();
  });
}

function ensureUniquePaymentLink(store, customer, origin) {
  if (!store.paymentLinks) store.paymentLinks = {};
  ensureCustomerDueDateFromOnboarding(customer);

  const ymCode = formatYearMonthCode(customer.nextDueDate);
  const forMonth = formatMonthLabel(customer.nextDueDate);
  const paymentId = `PAY-PHW-${String(customer.id).padStart(3, '0')}-${ymCode}`;
  const baseOrigin = origin || process.env.FRONTEND_URL || 'https://pure-home-waters-zeta.vercel.app';
  const shortUrl = `${baseOrigin.replace(/\/$/, '')}/pay/${paymentId}`;

  const existing = store.paymentLinks[paymentId];
  const amount = Number(customer.monthlyRent) || 499;

  if (!existing) {
    store.paymentLinks[paymentId] = {
      paymentId,
      customerId: Number(customer.id),
      customerName: customer.name,
      customerPhone: customer.phone,
      customerArea: customer.area || '',
      purifierModel: customer.purifierModel || 'Water Purifier',
      planName: customer.planName || 'Rental Plan',
      amount,
      forMonth,
      onboardingDate: customer.joinDate,
      dueDate: customer.nextDueDate,
      status: 'PENDING',
      shortUrl,
      createdAt: new Date().toISOString()
    };

    // Optional live Razorpay Payment Link creation when RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET are configured
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && customer.phone) {
      const authHeader = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const cleanPhone = String(customer.phone).replace(/\D/g, '').slice(-10);
      fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: 'INR',
          reference_id: paymentId,
          description: `Pure Home Waters Rent - ${forMonth} (${customer.purifierModel})`,
          customer: {
            name: customer.name,
            contact: `+91${cleanPhone}`
          },
          notify: { sms: false, email: false },
          reminder_enable: false,
          notes: {
            paymentId,
            customerId: String(customer.id),
            forMonth
          }
        })
      })
        .then(r => r.json())
        .then(rzp => {
          if (rzp && rzp.short_url && store.paymentLinks[paymentId]) {
            store.paymentLinks[paymentId].razorpayLinkId = rzp.id;
            store.paymentLinks[paymentId].razorpayShortUrl = rzp.short_url;
          }
        })
        .catch(() => undefined);
    }
  } else {
    existing.customerName = customer.name;
    existing.customerPhone = customer.phone;
    existing.customerArea = customer.area || '';
    existing.purifierModel = customer.purifierModel || existing.purifierModel;
    existing.amount = amount;
    existing.dueDate = customer.nextDueDate;
    existing.shortUrl = existing.razorpayShortUrl || shortUrl;
  }

  customer.uniquePaymentId = paymentId;
  customer.paymentLinkUrl = store.paymentLinks[paymentId].shortUrl;
  return store.paymentLinks[paymentId];
}

function logWhatsAppMessage(store, entry) {
  if (!Array.isArray(store.whatsappLogs)) {
    store.whatsappLogs = [];
  }
  const id = nextId(store, 'whatsappLogs');
  const record = {
    id,
    customerId: entry.customerId || null,
    customerName: entry.customerName || 'Customer',
    phone: entry.phone || '',
    direction: entry.direction || 'OUTBOUND',
    category: entry.category || 'PRE_DUE_5D',
    paymentId: entry.paymentId || null,
    ticketId: entry.ticketId || null,
    message: entry.message,
    idempotencyKey: entry.idempotencyKey || null,
    deliveryStatus: process.env.WHATSAPP_ACCESS_TOKEN ? 'SENT_API' : 'LOGGED_AUTO',
    createdAt: new Date().toISOString()
  };
  store.whatsappLogs.unshift(record);
  if (store.whatsappLogs.length > 250) {
    store.whatsappLogs.length = 250;
  }

  // Live Meta WhatsApp Cloud API dispatch when WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID are set
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && record.direction === 'OUTBOUND' && record.phone) {
    const cleanPhone = String(record.phone).replace(/\D/g, '');
    const toPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { preview_url: true, body: record.message }
      })
    }).catch(() => undefined);
  }

  return record;
}

function buildAutomatedReminderText(customer, link, stage, daysUntilDue) {
  const dueStr = new Date(customer.nextDueDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (stage === 'PRE_DUE_5D') {
    return [
      `Hello *${customer.name}*,`,
      '',
      `This is a friendly reminder from *Pure Home Waters*.`,
      `Your monthly water purifier (*${customer.purifierModel}*) rental payment of *Rs.${link.amount}* for *${link.forMonth}* is due in *${daysUntilDue} day(s)* on *${dueStr}*.`,
      '',
      `Payment ID: ${link.paymentId}`,
      `Rent Amount: Rs.${link.amount}/-`,
      `Due Date: ${dueStr}`,
      '',
      `Please make the payment using this secure payment link:`,
      `${link.shortUrl}`,
      '',
      `Thank you for choosing Pure Home Waters!`,
      `- Pure Home Waters, Tirupati`
    ].join('\n');
  }

  if (stage === 'DUE_TODAY') {
    return [
      `Hello *${customer.name}*,`,
      '',
      `Your *Pure Home Waters* monthly purifier rent of *Rs.${link.amount}* for *${link.forMonth}* is *Due Today (${dueStr})*.`,
      '',
      `Payment ID: ${link.paymentId}`,
      `Amount Due: Rs.${link.amount}/-`,
      '',
      `Pay securely using your link:`,
      `${link.shortUrl}`,
      '',
      `- Pure Home Waters, Tirupati`
    ].join('\n');
  }

  return [
    `Hello *${customer.name}*,`,
    '',
    `Your *Pure Home Waters* rental payment of *Rs.${link.amount}* for *${link.forMonth}* was due on *${dueStr}* and is currently *Overdue*.`,
    '',
    `Payment ID: ${link.paymentId}`,
    `Amount Due: Rs.${link.amount}/-`,
    '',
    `Please complete payment using your link:`,
    `${link.shortUrl}`,
    '',
    `- Pure Home Waters, Tirupati`
  ].join('\n');
}

function runAutomationEngine(store, origin) {
  if (!store || !Array.isArray(store.customers)) return { triggered: 0, evaluated: 0 };

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const preDueWindowDays = store.automationConfig?.preDueDays ?? 5;
  let triggeredCount = 0;

  for (const customer of store.customers) {
    if (customer.status === 'inactive') continue;

    ensureCustomerDueDateFromOnboarding(customer);
    const dueDate = new Date(customer.nextDueDate);
    const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const daysUntilDue = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86400000);
    const forMonth = formatMonthLabel(dueDate);

    const paidForCycle = isCustomerPaidForCycle(store, customer.id, forMonth, dueDate);

    if (paidForCycle) {
      const nextCycleDate = calculateNextCycleDueDate(customer.joinDate, dueDate);
      customer.nextDueDate = nextCycleDate.toISOString();
      customer.status = 'active';
      customer.currentCycleStatus = 'paid';
      const nextLink = ensureUniquePaymentLink(store, customer, origin);
      customer.daysUntilDue = Math.round((new Date(nextLink.dueDate).getTime() - todayMidnight.getTime()) / 86400000);
      continue;
    }

    const link = ensureUniquePaymentLink(store, customer, origin);
    customer.daysUntilDue = daysUntilDue;

    if (daysUntilDue < 0) {
      customer.status = 'overdue';
      customer.currentCycleStatus = 'overdue';
    } else if (daysUntilDue <= preDueWindowDays) {
      customer.status = 'active';
      customer.currentCycleStatus = 'due_soon';
    } else {
      customer.status = 'active';
      customer.currentCycleStatus = 'pending';
    }

    if (store.automationConfig?.enabled === false) continue;

    let stageToTrigger = null;
    if (daysUntilDue > 0 && daysUntilDue <= preDueWindowDays) {
      stageToTrigger = 'PRE_DUE_5D';
    } else if (daysUntilDue === 0) {
      stageToTrigger = 'DUE_TODAY';
    } else if (daysUntilDue < 0) {
      stageToTrigger = 'OVERDUE_3D';
    }

    if (stageToTrigger) {
      const idempotencyKey = `${customer.id}:${link.paymentId}:${stageToTrigger}`;
      const alreadySent = (store.whatsappLogs || []).some(log => log.idempotencyKey === idempotencyKey);

      if (!alreadySent) {
        const message = buildAutomatedReminderText(customer, link, stageToTrigger, daysUntilDue);
        logWhatsAppMessage(store, {
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          direction: 'OUTBOUND',
          category: stageToTrigger,
          paymentId: link.paymentId,
          message,
          idempotencyKey
        });
        customer.lastReminderStage = stageToTrigger;
        customer.lastReminderSentAt = new Date().toISOString();
        triggeredCount++;
      }
    }
  }

  if (store.automationConfig) {
    store.automationConfig.lastRunAt = new Date().toISOString();
  }

  return {
    triggered: triggeredCount,
    evaluated: store.customers.length,
    ranAt: new Date().toISOString()
  };
}

async function completePaymentByLink(store, paymentId, payload, origin) {
  if (!store.paymentLinks) store.paymentLinks = {};
  let link = store.paymentLinks[paymentId];

  if (!link) {
    const match = /^PAY-PHW-(\d+)-(\d{6})/i.exec(String(paymentId));
    if (match) {
      const custId = Number(match[1]);
      const customer = store.customers.find(c => Number(c.id) === custId);
      if (customer) {
        link = ensureUniquePaymentLink(store, customer, origin);
      }
    }
  }

  if (!link) {
    return { error: 'Payment link not found', status: 404 };
  }

  const customer = store.customers.find(c => Number(c.id) === Number(link.customerId));
  if (!customer) {
    return { error: 'Customer not found for this payment link', status: 404 };
  }

  if (link.status === 'PAID') {
    return {
      alreadyPaid: true,
      paymentLink: link,
      customer
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const txRef = payload?.transactionRef || payload?.razorpayPaymentId || `TXN-${Date.now().toString(36).toUpperCase()}`;
  const method = payload?.paymentMethod || 'Online Payment Link';

  link.status = 'PAID';
  link.paidAt = nowIso;
  link.transactionRef = txRef;
  link.paymentMethod = method;

  const newPayment = {
    id: nextId(store, 'payments'),
    customerId: Number(customer.id),
    amount: Number(link.amount),
    paidDate: nowIso,
    forMonth: link.forMonth,
    receiver: 'Online Payment',
    notes: `Payment ID: ${link.paymentId} · Ref: ${txRef}`,
    paymentId: link.paymentId,
    transactionRef: txRef,
    createdAt: nowIso
  };
  store.payments.unshift(newPayment);

  const nextDue = calculateNextCycleDueDate(customer.joinDate, customer.nextDueDate);
  customer.lastPaymentDate = nowIso;
  customer.nextDueDate = nextDue.toISOString();
  customer.status = 'active';
  customer.currentCycleStatus = 'paid';
  customer.lastReminderStage = 'RECEIPT_SENT';
  customer.lastReminderSentAt = nowIso;

  const nextMonthLink = ensureUniquePaymentLink(store, customer, origin);
  customer.daysUntilDue = Math.round((nextDue.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);

  const nextDueFormatted = nextDue.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const receiptMessage = [
    `Hello *${customer.name}*,`,
    '',
    `Payment Received! Thank you for paying your *Pure Home Waters* purifier rent.`,
    '',
    `Payment ID: ${link.paymentId}`,
    `Transaction Ref: ${txRef}`,
    `Amount Paid: Rs.${link.amount}/-`,
    `Month: ${link.forMonth}`,
    `Next Due Date: ${nextDueFormatted}`,
    '',
    `- Pure Home Waters, Tirupati`
  ].join('\n');

  const whatsappReceipt = logWhatsAppMessage(store, {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    direction: 'OUTBOUND',
    category: 'PAYMENT_RECEIPT',
    paymentId: link.paymentId,
    message: receiptMessage,
    idempotencyKey: `receipt:${link.paymentId}`
  });

  await saveStore(store);

  return {
    alreadyPaid: false,
    payment: newPayment,
    paymentLink: link,
    nextPaymentLink: nextMonthLink,
    customer,
    whatsappReceipt
  };
}

async function handleIncomingWhatsAppComplaint(store, payload) {
  let rawPhone = '';
  let messageText = '';
  let senderName = '';

  if (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
    const val = payload.entry[0].changes[0].value;
    const msg = val.messages[0];
    rawPhone = msg.from || '';
    messageText = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '';
    senderName = val.contacts?.[0]?.profile?.name || '';
  } else {
    rawPhone = payload?.phone || payload?.from || '';
    messageText = payload?.message || payload?.complaint || payload?.text || '';
    senderName = payload?.customerName || '';
  }

  const digits = String(rawPhone).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

  let customer = null;
  if (payload?.customerId) {
    customer = store.customers.find(c => Number(c.id) === Number(payload.customerId));
  }
  if (!customer && last10) {
    customer = store.customers.find(c => {
      const cPhone = String(c.phone || '').replace(/\D/g, '').slice(-10);
      const cAlt = String(c.alternatePhone || '').replace(/\D/g, '').slice(-10);
      return cPhone === last10 || (cAlt && cAlt === last10);
    });
  }

  if (!messageText || !String(messageText).trim()) {
    return { error: 'WhatsApp complaint message text is required', status: 400 };
  }

  const nowIso = new Date().toISOString();

  if (!customer) {
    const newCustId = nextId(store, 'customers');
    customer = {
      id: newCustId,
      name: senderName || `Customer (${last10 || 'WhatsApp'})`,
      phone: last10 || '',
      address: 'Reported via WhatsApp',
      area: 'Tirupati',
      purifierModel: 'Purosis',
      planId: 1,
      planName: 'Basic',
      monthlyRent: 399,
      depositPaid: 0,
      joinDate: nowIso,
      nextDueDate: calculateNextCycleDueDate(nowIso, nowIso).toISOString(),
      status: 'active',
      notes: 'Created from incoming WhatsApp complaint',
      createdAt: nowIso
    };
    store.customers.push(customer);
  }

  const complaintId = nextId(store, 'customerComplaints');
  const ticketId = `CMP-${1000 + complaintId}`;

  logWhatsAppMessage(store, {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    direction: 'INBOUND',
    category: 'COMPLAINT_INBOUND',
    ticketId,
    message: String(messageText).trim()
  });

  const autoReply = [
    `Hello *${customer.name}*,`,
    '',
    `We have received your complaint on WhatsApp. Your Ticket ID is *${ticketId}*.`,
    `Our team will assign a technician shortly.`,
    `- Pure Home Waters, Tirupati`
  ].join('\n');

  const newComplaint = {
    id: complaintId,
    ticketId,
    customerId: Number(customer.id),
    customerName: customer.name,
    customerPhone: customer.phone,
    customerArea: customer.area || 'Tirupati',
    complaint: String(messageText).trim(),
    source: 'whatsapp',
    admissionStatus: 'NEW_WHATSAPP',
    resolved: false,
    autoReplyMessage: autoReply,
    createdAt: nowIso
  };

  store.customerComplaints.unshift(newComplaint);

  logWhatsAppMessage(store, {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    direction: 'OUTBOUND',
    category: 'COMPLAINT_AUTO_REPLY',
    ticketId,
    message: autoReply,
    idempotencyKey: `complaint-autoreply:${ticketId}`
  });

  await saveStore(store);

  return {
    complaint: newComplaint,
    customer,
    ticketId,
    autoReply
  };
}

async function admitComplaintAndScheduleFix(store, complaintId, body) {
  const complaint = (store.customerComplaints || []).find(c => Number(c.id) === Number(complaintId));
  if (!complaint) {
    return { error: 'Complaint not found', status: 404 };
  }

  const customer = (store.customers || []).find(c => Number(c.id) === Number(complaint.customerId));
  const defaultTech = (store.technicians || []).find(t => t.isDefault) || (store.technicians || [])[0];
  const technicianName = body?.technicianName || defaultTech?.name || 'Default Technician';

  const now = new Date();
  const visitDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nowIso = now.toISOString();
  const ticketId = complaint.ticketId || `CMP-${1000 + Number(complaint.id)}`;

  complaint.ticketId = ticketId;
  complaint.admissionStatus = 'ADMITTED';
  complaint.admittedAt = nowIso;
  complaint.assignedTechnician = technicianName;

  const serviceRecord = {
    id: nextId(store, 'serviceRecords'),
    customerId: Number(complaint.customerId),
    customerName: customer?.name || complaint.customerName || 'Customer',
    serviceType: 'repair',
    serviceDate: visitDate.toISOString(),
    nextServiceDate: visitDate.toISOString(),
    complaintId: Number(complaint.id),
    technicianName,
    partsReplaced: '',
    notes: `Complaint ${ticketId}: ${complaint.complaint}`,
    cost: 0,
    createdAt: nowIso
  };
  store.serviceRecords.unshift(serviceRecord);
  complaint.serviceRecordId = serviceRecord.id;

  if (customer) {
    customer.nextServiceDate = visitDate.toISOString();
  }

  const visitStr = visitDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const admitWhatsAppMsg = [
    `Hello *${customer?.name || complaint.customerName || 'Customer'}*,`,
    '',
    `Your service request *${ticketId}* has been approved.`,
    `Technician *${technicianName}* is scheduled to visit on *${visitStr}*.`,
    `- Pure Home Waters, Tirupati`
  ].join('\n');

  const whatsappNotification = logWhatsAppMessage(store, {
    customerId: customer?.id || complaint.customerId,
    customerName: customer?.name || complaint.customerName || 'Customer',
    phone: customer?.phone || complaint.customerPhone || '',
    direction: 'OUTBOUND',
    category: 'COMPLAINT_ADMITTED',
    ticketId,
    message: admitWhatsAppMsg,
    idempotencyKey: `complaint-admit:${ticketId}`
  });

  await saveStore(store);

  return {
    complaint,
    serviceRecord,
    whatsappNotification
  };
}

function parseRequestBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string' && req.body.trim()) {
      try {
        resolve(JSON.parse(req.body));
        return;
      } catch {
        resolve({});
        return;
      }
    }
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Razorpay-Signature');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'pure-home-waters-zeta.vercel.app';
  const origin = `${proto}://${host}`;

  const urlObj = new URL(req.url, origin);
  const routeParam = urlObj.searchParams.get('route');
  const pathname = (routeParam !== null
    ? routeParam
    : urlObj.pathname.replace(/^\/api\/v1\/crm\/?/, '').replace(/^\/api\/crm\/?/, '')
  ).replace(/^\/+|\/+$/g, '');
  const method = (req.method || 'GET').toUpperCase();

  const store = await loadStore(origin);

  const sendJson = (statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  try {
    // 1. GET full real-time state
    if ((pathname === '' || pathname === 'state') && method === 'GET') {
      const autoSummary = runAutomationEngine(store, origin);
      if (autoSummary.triggered > 0) {
        await saveStore(store);
      }
      return sendJson(200, {
        success: true,
        version: store.version,
        updatedAt: store.updatedAt,
        databaseMode: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'postgresql' : 'cloud-realtime',
        automation: {
          ...store.automationConfig,
          lastSummary: autoSummary
        },
        data: {
          customers: store.customers,
          rentalPlans: store.rentalPlans,
          payments: store.payments,
          serviceRecords: store.serviceRecords,
          technicians: store.serviceRecords ? store.technicians : [],
          customerComplaints: store.customerComplaints,
          customerComments: store.customerComments,
          paymentLinks: Object.values(store.paymentLinks || {}),
          whatsappLogs: store.whatsappLogs || []
        }
      });
    }

    // 2. Trigger Automation Cycle manually or via Vercel Cron
    if ((pathname === 'automation/run' || pathname === 'automation/cron') && (method === 'POST' || method === 'GET')) {
      const summary = runAutomationEngine(store, origin);
      await saveStore(store);
      return sendJson(200, {
        success: true,
        message: `Evaluated ${summary.evaluated} customers.`,
        data: summary,
        version: store.version
      });
    }

    // 3. Payment Link Lookup: GET /api/v1/crm/payment-links/:paymentId
    const paymentLinkMatch = /^payment-links\/([^/]+)$/.exec(pathname);
    if (paymentLinkMatch && method === 'GET') {
      const paymentId = decodeURIComponent(paymentLinkMatch[1]);
      runAutomationEngine(store, origin);
      let link = store.paymentLinks?.[paymentId];
      if (!link) {
        const m = /^PAY-PHW-(\d+)-(\d{6})/i.exec(paymentId);
        if (m) {
          const customer = store.customers.find(c => Number(c.id) === Number(m[1]));
          if (customer) {
            link = ensureUniquePaymentLink(store, customer, origin);
            await saveStore(store);
          }
        }
      }
      if (!link) {
        return sendJson(404, { success: false, message: 'Payment link not found' });
      }
      const customer = store.customers.find(c => Number(c.id) === Number(link.customerId));
      return sendJson(200, {
        success: true,
        data: {
          paymentLink: link,
          customer
        }
      });
    }

    // 4. Complete Payment via Unique Link: POST /api/v1/crm/payment-links/:paymentId/pay
    const paymentPayMatch = /^payment-links\/([^/]+)\/pay$/.exec(pathname);
    if (paymentPayMatch && method === 'POST') {
      const paymentId = decodeURIComponent(paymentPayMatch[1]);
      const body = await parseRequestBody(req);
      const result = await completePaymentByLink(store, paymentId, body, origin);
      if (result.error) {
        return sendJson(result.status || 400, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: result.alreadyPaid ? 'Payment already recorded' : 'Payment completed successfully',
        data: result,
        version: store.version
      });
    }

    // 5. Razorpay Webhook: POST /api/v1/crm/webhooks/razorpay
    if (pathname === 'webhooks/razorpay' && method === 'POST') {
      const body = await parseRequestBody(req);

      // Verify HMAC signature if RAZORPAY_WEBHOOK_SECRET is configured
      if (process.env.RAZORPAY_WEBHOOK_SECRET && req.headers['x-razorpay-signature']) {
        const expected = crypto
          .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
          .update(JSON.stringify(body))
          .digest('hex');
        if (expected !== req.headers['x-razorpay-signature']) {
          return sendJson(401, { success: false, message: 'Invalid Razorpay webhook signature' });
        }
      }

      const refId =
        body?.payload?.payment_link?.entity?.reference_id ||
        body?.payload?.payment?.entity?.notes?.paymentId ||
        body?.paymentId;
      const rzpPaymentId = body?.payload?.payment?.entity?.id || body?.transactionRef;

      if (!refId) {
        return sendJson(400, { success: false, message: 'Missing reference_id / paymentId in webhook payload' });
      }

      const result = await completePaymentByLink(
        store,
        refId,
        { transactionRef: rzpPaymentId, paymentMethod: 'Razorpay' },
        origin
      );
      if (result.error) {
        return sendJson(result.status || 404, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: 'Razorpay webhook processed',
        data: result
      });
    }

    // 6. Meta Official WhatsApp Webhook Verification (GET) & Incoming Message (POST)
    if (pathname === 'webhooks/whatsapp') {
      if (method === 'GET') {
        const mode = urlObj.searchParams.get('hub.mode');
        const verifyToken = urlObj.searchParams.get('hub.verify_token');
        const challenge = urlObj.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && challenge) {
          if (process.env.WHATSAPP_VERIFY_TOKEN && verifyToken !== process.env.WHATSAPP_VERIFY_TOKEN) {
            return sendJson(403, { success: false, message: 'Invalid verify token' });
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end(challenge);
          return;
        }
        return sendJson(200, { success: true, message: 'WhatsApp Webhook Active' });
      }

      if (method === 'POST') {
        const body = await parseRequestBody(req);
        const result = await handleIncomingWhatsAppComplaint(store, body);
        if (result.error) {
          return sendJson(result.status || 400, { success: false, message: result.error });
        }
        return sendJson(201, {
          success: true,
          message: `Complaint ${result.ticketId} logged`,
          data: result,
          version: store.version
        });
      }
    }

    // 7. Admin "Admit & Assign Fix" for Complaint: POST /api/v1/crm/complaints/:id/admit
    const admitMatch = /^complaints\/(\d+)\/admit$/.exec(pathname);
    if (admitMatch && method === 'POST') {
      const complaintId = Number(admitMatch[1]);
      const body = await parseRequestBody(req);
      const result = await admitComplaintAndScheduleFix(store, complaintId, body);
      if (result.error) {
        return sendJson(result.status || 404, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: `Complaint ${result.complaint.ticketId} admitted`,
        data: result,
        version: store.version
      });
    }

    // 8. Sync / Bulk Import (for migrating existing IndexedDB or SQL backup into Cloud Store)
    if (pathname === 'sync/import' && method === 'POST') {
      const body = await parseRequestBody(req);
      const mode = body?.mode || 'merge';

      if (mode === 'replace') {
        if (Array.isArray(body.rentalPlans)) store.rentalPlans = body.rentalPlans;
        if (Array.isArray(body.customers)) store.customers = body.customers;
        if (Array.isArray(body.payments)) store.payments = body.payments;
        if (Array.isArray(body.serviceRecords)) store.serviceRecords = body.serviceRecords;
        if (Array.isArray(body.technicians)) store.technicians = body.technicians;
        if (Array.isArray(body.customerComplaints)) store.customerComplaints = body.customerComplaints;
        if (Array.isArray(body.customerComments)) store.customerComments = body.customerComments;
        store.paymentLinks = {};
      } else {
        if (Array.isArray(body.customers)) {
          for (const incoming of body.customers) {
            const exists = store.customers.some(
              c => String(c.phone).trim() === String(incoming.phone).trim() || Number(c.id) === Number(incoming.id)
            );
            if (!exists) {
              const id = incoming.id || nextId(store, 'customers');
              store.customers.push({ ...incoming, id });
            }
          }
        }
        if (Array.isArray(body.payments) && store.payments.length === 0) {
          store.payments = body.payments;
        }
        if (Array.isArray(body.serviceRecords) && store.serviceRecords.length === 0) {
          store.serviceRecords = body.serviceRecords;
        }
        if (Array.isArray(body.customerComplaints) && store.customerComplaints.length === 0) {
          store.customerComplaints = body.customerComplaints;
        }
        if (Array.isArray(body.customerComments) && store.customerComments.length === 0) {
          store.customerComments = body.customerComments;
        }
      }

      runAutomationEngine(store, origin);
      await saveStore(store);
      return sendJson(200, {
        success: true,
        message: 'Database synchronized.',
        version: store.version
      });
    }

    // 9. Generic Entity CRUD: /api/v1/crm/:collection and /api/v1/crm/:collection/:id
    const collectionMap = {
      customers: 'customers',
      plans: 'rentalPlans',
      rentalPlans: 'rentalPlans',
      payments: 'payments',
      services: 'serviceRecords',
      serviceRecords: 'serviceRecords',
      technicians: 'technicians',
      complaints: 'customerComplaints',
      customerComplaints: 'customerComplaints',
      comments: 'customerComments',
      customerComments: 'customerComments'
    };

    const parts = pathname.split('/');
    const collectionKey = collectionMap[parts[0]];
    const itemId = parts[1] ? Number(parts[1]) : null;

    if (collectionKey) {
      const list = store[collectionKey] || [];

      if (method === 'GET' && !itemId) {
        return sendJson(200, { success: true, data: list, version: store.version });
      }

      if (method === 'GET' && itemId) {
        const item = list.find(x => Number(x.id) === itemId);
        return sendJson(item ? 200 : 404, { success: !!item, data: item || null });
      }

      if (method === 'POST' && !itemId) {
        const body = await parseRequestBody(req);
        const nowIso = new Date().toISOString();
        const id = nextId(store, collectionKey);

        if (collectionKey === 'technicians' && body.isDefault) {
          list.forEach(t => {
            t.isDefault = false;
          });
        }

        const newItem = {
          ...body,
          id,
          createdAt: body.createdAt || nowIso
        };

        if (collectionKey === 'customerComplaints' && !newItem.ticketId) {
          newItem.ticketId = `CMP-${1000 + id}`;
          newItem.source = newItem.source || 'admin';
          newItem.admissionStatus = newItem.admissionStatus || 'NEW_WHATSAPP';
        }

        list.push(newItem);

        if (collectionKey === 'payments' && newItem.customerId) {
          const customer = store.customers.find(c => Number(c.id) === Number(newItem.customerId));
          if (customer) {
            if (customer.uniquePaymentId && store.paymentLinks?.[customer.uniquePaymentId]) {
              store.paymentLinks[customer.uniquePaymentId].status = 'PAID';
              store.paymentLinks[customer.uniquePaymentId].paidAt = nowIso;
            }
            customer.lastPaymentDate = newItem.paidDate || nowIso;
            customer.status = 'active';
          }
        }

        runAutomationEngine(store, origin);
        await saveStore(store);
        return sendJson(201, { success: true, data: newItem, id, version: store.version });
      }

      if ((method === 'PATCH' || method === 'PUT') && itemId) {
        const body = await parseRequestBody(req);
        const idx = list.findIndex(x => Number(x.id) === itemId);
        if (idx === -1) {
          return sendJson(404, { success: false, message: 'Record not found' });
        }

        if (collectionKey === 'technicians' && body.isDefault) {
          list.forEach(t => {
            t.isDefault = false;
          });
        }

        list[idx] = { ...list[idx], ...body, id: itemId };
        if (collectionKey === 'customerComplaints' && body.resolved === true) {
          list[idx].admissionStatus = 'RESOLVED';
        }

        runAutomationEngine(store, origin);
        await saveStore(store);
        return sendJson(200, { success: true, data: list[idx], version: store.version });
      }

      if (method === 'DELETE' && itemId) {
        const idx = list.findIndex(x => Number(x.id) === itemId);
        if (idx !== -1) {
          list.splice(idx, 1);
          await saveStore(store);
        }
        return sendJson(200, { success: true, version: store.version });
      }
    }

    return sendJson(404, { success: false, message: `Unknown CRM API route: ${pathname}` });
  } catch (err) {
    console.error('CRM API Error:', err);
    return sendJson(500, {
      success: false,
      message: 'Internal server error'
    });
  }
};
