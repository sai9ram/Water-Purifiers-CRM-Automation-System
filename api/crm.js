const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TMP_DB_PATH = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'phw-realtime-cloud-db-v2.json');

// In-memory singleton for warm serverless invocations
let memoryStore = null;

function getDefaultSeedState() {
  const now = new Date();
  const nowIso = now.toISOString();

  // Sample dates to demonstrate 5-day pre-due automation immediately
  const joinDate1 = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate() + 4);
  const dueIn4Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);

  const joinDate2 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const joinDate3 = new Date(now.getFullYear(), now.getMonth() - 4, now.getDate() - 4);
  const overdue4Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4);

  return {
    version: 1,
    updatedAt: nowIso,
    counters: {
      customers: 3,
      rentalPlans: 3,
      serviceRecords: 1,
      payments: 1,
      customerComments: 1,
      customerComplaints: 1,
      technicians: 2,
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
        monthlyRent: 599,
        depositAmount: 3500,
        description: 'Complete protection with stainless steel tank & mineral enhancement',
        features: ['Steel Tank', 'RO + UV + Alkaline + TDS Control', 'Quarterly Service', '24/7 Support'],
        createdAt: nowIso
      }
    ],
    technicians: [
      {
        id: 1,
        name: 'Ravi Kumar (Senior Tech)',
        isDefault: true,
        createdAt: nowIso
      },
      {
        id: 2,
        name: 'Suresh Babu',
        isDefault: false,
        createdAt: nowIso
      }
    ],
    customers: [
      {
        id: 1,
        name: 'Ramesh Naidu',
        phone: '9876543210',
        alternatePhone: '',
        address: 'Flat 204, Sri Sai Residency, AIR Bypass Road',
        area: 'AIR Bypass Road, Tirupati',
        purifierModel: 'Purosis Plus',
        planId: 2,
        planName: 'Standard',
        monthlyRent: 499,
        depositPaid: 3000,
        initialInvestment: 8500,
        joinDate: joinDate1.toISOString(),
        nextDueDate: dueIn4Days.toISOString(),
        lastServiceDate: joinDate1.toISOString(),
        nextServiceDate: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
        status: 'active',
        notes: 'Onboarded with Standard RO plan',
        createdAt: joinDate1.toISOString()
      },
      {
        id: 2,
        name: 'Lakshmi Devi',
        phone: '9848011223',
        alternatePhone: '',
        address: 'Door 12-4-88, Bhavani Nagar',
        area: 'Bhavani Nagar, Tirupati',
        purifierModel: 'Dolphin',
        planId: 1,
        planName: 'Basic',
        monthlyRent: 399,
        depositPaid: 2000,
        initialInvestment: 7200,
        joinDate: joinDate2.toISOString(),
        nextDueDate: dueToday.toISOString(),
        lastServiceDate: joinDate2.toISOString(),
        nextServiceDate: new Date(now.getFullYear(), now.getMonth() + 1, 20).toISOString(),
        status: 'active',
        notes: 'Prefers morning technician visits',
        createdAt: joinDate2.toISOString()
      },
      {
        id: 3,
        name: 'Kiran Kumar Reddy',
        phone: '9701234567',
        alternatePhone: '',
        address: 'Plot 45, Padmavathi Puram',
        area: 'Padmavathi Puram, Tirupati',
        purifierModel: 'Priya Aqua Steel Guard',
        planId: 3,
        planName: 'Premium',
        monthlyRent: 599,
        depositPaid: 3500,
        initialInvestment: 10500,
        joinDate: joinDate3.toISOString(),
        nextDueDate: overdue4Days.toISOString(),
        lastServiceDate: joinDate3.toISOString(),
        nextServiceDate: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString(),
        status: 'overdue',
        notes: 'Steel Guard model installed',
        createdAt: joinDate3.toISOString()
      }
    ],
    payments: [],
    serviceRecords: [
      {
        id: 1,
        customerId: 1,
        customerName: 'Ramesh Naidu',
        serviceType: 'installation',
        serviceDate: joinDate1.toISOString(),
        nextServiceDate: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
        technicianName: 'Ravi Kumar (Senior Tech)',
        partsReplaced: 'New Installation Kit',
        notes: 'Initial RO purifier onboarding installation',
        cost: 0,
        createdAt: joinDate1.toISOString()
      }
    ],
    customerComplaints: [
      {
        id: 1,
        ticketId: 'CMP-1001',
        customerId: 2,
        customerName: 'Lakshmi Devi',
        customerPhone: '9848011223',
        customerArea: 'Bhavani Nagar, Tirupati',
        complaint: 'Water flow from the purifier tap is slow since morning, please send technician.',
        source: 'whatsapp',
        admissionStatus: 'NEW_WHATSAPP',
        resolved: false,
        autoReplyMessage: 'Hello Lakshmi Devi, we received your WhatsApp complaint. Your Ticket ID is CMP-1001. Our admin team is reviewing it and will assign a technician shortly.',
        createdAt: nowIso
      }
    ],
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

function loadStore(origin) {
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
    console.error('Failed to read TMP_DB_PATH, initializing seed store:', err.message);
  }

  memoryStore = getDefaultSeedState();
  runAutomationEngine(memoryStore, origin);
  saveStore(memoryStore);
  return memoryStore;
}

function saveStore(store) {
  store.version = (store.version || 1) + 1;
  store.updatedAt = new Date().toISOString();
  memoryStore = store;
  try {
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(store), 'utf8');
  } catch (err) {
    console.error('Warning: could not write TMP_DB_PATH:', err.message);
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
  } else {
    existing.customerName = customer.name;
    existing.customerPhone = customer.phone;
    existing.customerArea = customer.area || '';
    existing.purifierModel = customer.purifierModel || existing.purifierModel;
    existing.amount = amount;
    existing.dueDate = customer.nextDueDate;
    existing.shortUrl = shortUrl;
  }

  customer.uniquePaymentId = paymentId;
  customer.paymentLinkUrl = shortUrl;
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

  // Optional live Meta WhatsApp Cloud API dispatch when WHATSAPP_ACCESS_TOKEN is configured
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
  const onboardStr = new Date(customer.joinDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (stage === 'PRE_DUE_5D') {
    return [
      `Hello *${customer.name}*,`,
      '',
      `Automated Reminder from *Pure Home Waters* 💧`,
      `Your water purifier (*${customer.purifierModel}*) monthly rent for *${link.forMonth}* is due in *${daysUntilDue} day(s)* on *${dueStr}*.`,
      '',
      `• *Unique Payment ID:* ${link.paymentId}`,
      `• *Monthly Rent:* Rs.${link.amount}/-`,
      `• *Onboarded Date:* ${onboardStr}`,
      `• *Next Due Date:* ${dueStr}`,
      '',
      `Click your unique payment link below to pay securely (UPI / GPay / PhonePe / Card):`,
      `${link.shortUrl}`,
      '',
      `_Once paid via this link, your account is automatically marked as PAID in real time._`,
      `- Pure Home Waters, Tirupati`
    ].join('\n');
  }

  if (stage === 'DUE_TODAY') {
    return [
      `Hello *${customer.name}*,`,
      '',
      `Your *Pure Home Waters* monthly purifier rent of *Rs.${link.amount}* for *${link.forMonth}* is *Due Today (${dueStr})*.`,
      '',
      `• *Unique Payment ID:* ${link.paymentId}`,
      `• *Amount Due:* Rs.${link.amount}/-`,
      '',
      `Pay instantly using your unique link:`,
      `${link.shortUrl}`,
      '',
      `- Pure Home Waters, Tirupati`
    ].join('\n');
  }

  return [
    `Hello *${customer.name}*,`,
    '',
    `URGENT: Your *Pure Home Waters* rental payment of *Rs.${link.amount}* for *${link.forMonth}* was due on *${dueStr}* and is currently *Overdue*.`,
    '',
    `• *Unique Payment ID:* ${link.paymentId}`,
    `• *Overdue Amount:* Rs.${link.amount}/-`,
    '',
    `Please complete payment immediately using your unique link to avoid service interruption:`,
    `${link.shortUrl}`,
    '',
    `- Pure Home Waters, Tirupati`
  ].join('\n');
}

/**
 * Core Real-Time Automation Engine:
 * 1. Analyzes every customer's onboarding date (joinDate) and nextDueDate
 * 2. Generates unique Payment ID & Payment Link (PAY-PHW-<ID>-<YYYYMM>)
 * 3. Sends automated WhatsApp reminders 5 days before due date, on due date, and when overdue
 * 4. Syncs customer status ('active' vs 'overdue') automatically
 */
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
      // Customer already paid for this due cycle — advance their nextDueDate automatically!
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

/**
 * Completes a payment via Unique Payment Link (or Razorpay Webhook),
 * immediately records the PaymentRecord, advances nextDueDate by +1 month,
 * moves customer out of Unpaid into Paid, and sends automated WhatsApp receipt.
 */
function completePaymentByLink(store, paymentId, payload, origin) {
  if (!store.paymentLinks) store.paymentLinks = {};
  let link = store.paymentLinks[paymentId];

  // If paymentId encodes customerId (e.g. PAY-PHW-001-202611), resolve customer even if link wasn't cached
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
  const method = payload?.paymentMethod || 'UPI / Online Payment Link';

  link.status = 'PAID';
  link.paidAt = nowIso;
  link.transactionRef = txRef;
  link.paymentMethod = method;

  // 1. Record payment in CRM payments list
  const newPayment = {
    id: nextId(store, 'payments'),
    customerId: Number(customer.id),
    amount: Number(link.amount),
    paidDate: nowIso,
    forMonth: link.forMonth,
    receiver: 'Auto Payment Link (Online)',
    notes: `Paid via Unique Link ${link.paymentId} · Ref: ${txRef} (${method})`,
    paymentId: link.paymentId,
    transactionRef: txRef,
    createdAt: nowIso
  };
  store.payments.unshift(newPayment);

  // 2. Advance customer's nextDueDate by +1 month & set status = 'active'
  const nextDue = calculateNextCycleDueDate(customer.joinDate, customer.nextDueDate);
  customer.lastPaymentDate = nowIso;
  customer.nextDueDate = nextDue.toISOString();
  customer.status = 'active';
  customer.currentCycleStatus = 'paid';
  customer.lastReminderStage = 'RECEIPT_SENT';
  customer.lastReminderSentAt = nowIso;

  // 3. Pre-generate next month's unique payment link
  const nextMonthLink = ensureUniquePaymentLink(store, customer, origin);
  customer.daysUntilDue = Math.round((nextDue.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);

  // 4. Send automated WhatsApp Payment Receipt
  const nextDueFormatted = nextDue.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const receiptMessage = [
    `Hello *${customer.name}*,`,
    '',
    `✅ *Payment Received Successfully!*`,
    `Thank you for paying your *Pure Home Waters* purifier rent.`,
    '',
    `• *Payment ID:* ${link.paymentId}`,
    `• *Transaction Ref:* ${txRef}`,
    `• *Amount Paid:* Rs.${link.amount}/-`,
    `• *Billing Month:* ${link.forMonth}`,
    `• *Account Status:* PAID & ACTIVE`,
    `• *Next Due Date:* ${nextDueFormatted}`,
    '',
    `Thank you for choosing Pure Home Waters!`,
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

  saveStore(store);

  return {
    alreadyPaid: false,
    payment: newPayment,
    paymentLink: link,
    nextPaymentLink: nextMonthLink,
    customer,
    whatsappReceipt
  };
}

/**
 * Processes an incoming customer WhatsApp message (Meta Cloud API or Direct Webhook),
 * logs the complaint in real time with a Ticket ID (e.g. CMP-1002),
 * and sends an automated WhatsApp acknowledgement back to the customer.
 */
function handleIncomingWhatsAppComplaint(store, payload) {
  let rawPhone = '';
  let messageText = '';
  let senderName = '';

  // Support official Meta WhatsApp Cloud API payload format
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

  // If phone is from an unknown customer, create a profile so complaint is never lost
  if (!customer) {
    const newCustId = nextId(store, 'customers');
    customer = {
      id: newCustId,
      name: senderName || `WhatsApp Customer (${last10 || 'New'})`,
      phone: last10 || '9000000000',
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
      notes: 'Auto-created from incoming WhatsApp complaint',
      createdAt: nowIso
    };
    store.customers.push(customer);
  }

  const complaintId = nextId(store, 'customerComplaints');
  const ticketId = `CMP-${1000 + complaintId}`;

  // 1. Log inbound WhatsApp message
  logWhatsAppMessage(store, {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    direction: 'INBOUND',
    category: 'COMPLAINT_INBOUND',
    ticketId,
    message: String(messageText).trim()
  });

  // 2. Build auto-reply message with Ticket ID
  const autoReply = [
    `Hello *${customer.name}*,`,
    '',
    `We have received your service complaint on WhatsApp:`,
    `"${String(messageText).trim()}"`,
    '',
    `• *Complaint Ticket ID:* ${ticketId}`,
    `• *Purifier Model:* ${customer.purifierModel}`,
    `• *Status:* Logged in CRM (Awaiting Admin Admission)`,
    '',
    `Our admin team has been notified in real time and will assign a technician shortly.`,
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

  // 3. Log outbound auto-reply
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

  saveStore(store);

  return {
    complaint: newComplaint,
    customer,
    ticketId,
    autoReply
  };
}

/**
 * Admin 1-Click "Admit & Assign Fix" on an incoming complaint:
 * 1. Marks complaint as ADMITTED
 * 2. Assigns default (or selected) technician
 * 3. Creates a scheduled repair ServiceRecord
 * 4. Sends WhatsApp notification to customer that their fix is admitted & technician assigned
 */
function admitComplaintAndScheduleFix(store, complaintId, body) {
  const complaint = (store.customerComplaints || []).find(c => Number(c.id) === Number(complaintId));
  if (!complaint) {
    return { error: 'Complaint not found', status: 404 };
  }

  const customer = (store.customers || []).find(c => Number(c.id) === Number(complaint.customerId));
  const defaultTech = (store.technicians || []).find(t => t.isDefault) || (store.technicians || [])[0];
  const technicianName = body?.technicianName || defaultTech?.name || 'Ravi Kumar (Senior Tech)';

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
    notes: `Admitted from WhatsApp Complaint ${ticketId}: ${complaint.complaint}`,
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
    `🛠 *Your Complaint ${ticketId} Has Been Admitted!*`,
    `Admin has approved your service request and assigned a technician.`,
    '',
    `• *Ticket ID:* ${ticketId}`,
    `• *Issue:* ${complaint.complaint}`,
    `• *Assigned Technician:* ${technicianName}`,
    `• *Scheduled Visit:* ${visitStr}`,
    '',
    `Our technician will visit and resolve the issue promptly.`,
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

  saveStore(store);

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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

  const store = loadStore(origin);

  const sendJson = (statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  try {
    // 1. GET full real-time state (or check version)
    if ((pathname === '' || pathname === 'state') && method === 'GET') {
      const autoSummary = runAutomationEngine(store, origin);
      if (autoSummary.triggered > 0) {
        saveStore(store);
      }
      return sendJson(200, {
        success: true,
        version: store.version,
        updatedAt: store.updatedAt,
        automation: {
          ...store.automationConfig,
          lastSummary: autoSummary
        },
        data: {
          customers: store.customers,
          rentalPlans: store.rentalPlans,
          payments: store.payments,
          serviceRecords: store.serviceRecords,
          technicians: store.technicians,
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
      saveStore(store);
      return sendJson(200, {
        success: true,
        message: `Automation evaluated ${summary.evaluated} customers and sent ${summary.triggered} new WhatsApp reminder(s).`,
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
            saveStore(store);
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
      const result = completePaymentByLink(store, paymentId, body, origin);
      if (result.error) {
        return sendJson(result.status || 400, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: result.alreadyPaid ? 'Payment already recorded' : 'Payment completed and reflected in CRM in real time!',
        data: result,
        version: store.version
      });
    }

    // 5. Razorpay Webhook: POST /api/v1/crm/webhooks/razorpay
    if (pathname === 'webhooks/razorpay' && method === 'POST') {
      const body = await parseRequestBody(req);
      const refId =
        body?.payload?.payment_link?.entity?.reference_id ||
        body?.payload?.payment?.entity?.notes?.paymentId ||
        body?.paymentId;
      const rzpPaymentId = body?.payload?.payment?.entity?.id || body?.transactionRef;

      if (!refId) {
        return sendJson(400, { success: false, message: 'Missing reference_id / paymentId in webhook payload' });
      }

      const result = completePaymentByLink(
        store,
        refId,
        { transactionRef: rzpPaymentId, paymentMethod: 'Razorpay Webhook' },
        origin
      );
      if (result.error) {
        return sendJson(result.status || 404, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: 'Razorpay webhook processed and customer marked as PAID',
        data: result
      });
    }

    // 6. Meta Official WhatsApp Webhook Verification (GET) & Incoming Message (POST)
    if (pathname === 'webhooks/whatsapp') {
      if (method === 'GET') {
        const mode = urlObj.searchParams.get('hub.mode');
        const challenge = urlObj.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && challenge) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end(challenge);
          return;
        }
        return sendJson(200, { success: true, message: 'WhatsApp Webhook Endpoint Active' });
      }

      if (method === 'POST') {
        const body = await parseRequestBody(req);
        const result = handleIncomingWhatsAppComplaint(store, body);
        if (result.error) {
          return sendJson(result.status || 400, { success: false, message: result.error });
        }
        return sendJson(201, {
          success: true,
          message: `WhatsApp complaint logged as ${result.ticketId} and auto-reply sent!`,
          data: result,
          version: store.version
        });
      }
    }

    // 7. One-Click Admin "Admit & Assign Fix" for Complaint: POST /api/v1/crm/complaints/:id/admit
    const admitMatch = /^complaints\/(\d+)\/admit$/.exec(pathname);
    if (admitMatch && method === 'POST') {
      const complaintId = Number(admitMatch[1]);
      const body = await parseRequestBody(req);
      const result = admitComplaintAndScheduleFix(store, complaintId, body);
      if (result.error) {
        return sendJson(result.status || 404, { success: false, message: result.error });
      }
      return sendJson(200, {
        success: true,
        message: `Complaint ${result.complaint.ticketId} admitted and technician ${result.complaint.assignedTechnician} assigned!`,
        data: result,
        version: store.version
      });
    }

    // 8. Sync / Bulk Import (for migrating any existing IndexedDB or SQL backup into Cloud Store)
    if (pathname === 'sync/import' && method === 'POST') {
      const body = await parseRequestBody(req);
      const mode = body?.mode || 'merge'; // 'merge' or 'replace'

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
        // Non-destructive merge of existing browser records by phone/id
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
      }

      runAutomationEngine(store, origin);
      saveStore(store);
      return sendJson(200, {
        success: true,
        message: 'Cloud database synchronized and automation updated.',
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

        // If a payment was manually recorded, also mark any active payment link as PAID and advance due date
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
        saveStore(store);
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
        saveStore(store);
        return sendJson(200, { success: true, data: list[idx], version: store.version });
      }

      if (method === 'DELETE' && itemId) {
        const idx = list.findIndex(x => Number(x.id) === itemId);
        if (idx !== -1) {
          list.splice(idx, 1);
          saveStore(store);
        }
        return sendJson(200, { success: true, version: store.version });
      }
    }

    return sendJson(404, { success: false, message: `Unknown CRM API route: ${pathname}` });
  } catch (err) {
    console.error('CRM API Error:', err);
    return sendJson(500, {
      success: false,
      message: 'Internal server error in real-time CRM engine'
    });
  }
};
